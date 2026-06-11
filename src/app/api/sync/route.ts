// Synkar matcher, resultat och tabeller från Cupmate till Supabase.
// Anropas av klienterna (på sidladdning och med jämna mellanrum) men
// hämtar bara från Cupmate om det gått mer än 2 minuter sedan sist —
// sync_state fungerar som lås så att samtidiga anrop inte stormkör.

import { createAdminClient } from '@/lib/supabase/admin'
import {
  CUPMATE_GROUPS,
  OUR_CLUB,
  fetchGroupPage,
  parseMatches,
  parseStandings,
} from '@/lib/cupmate'

const MIN_INTERVAL_MS = 2 * 60 * 1000

export async function POST() {
  // Utan secret-nyckel kan synken inte skriva — svara lugnt i stället för att krascha
  if (!process.env.SUPABASE_SECRET_KEY) {
    return Response.json(
      { ok: false, error: 'SUPABASE_SECRET_KEY saknas i miljövariablerna' },
      { status: 503 }
    )
  }

  const supabase = createAdminClient()

  // Försök ta låset: uppdatera bara om förra synken är äldre än intervallet.
  // Får vi ingen rad tillbaka kör en annan synk nyss — hoppa över.
  const cutoff = new Date(Date.now() - MIN_INTERVAL_MS).toISOString()
  const { data: lock } = await supabase
    .from('sync_state')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', 1)
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .select()

  if (!lock || lock.length === 0) {
    return Response.json({ skipped: true })
  }

  try {
    let matchCount = 0
    let standingCount = 0

    for (const group of CUPMATE_GROUPS) {
      const html = await fetchGroupPage(group.groupId)

      // Bara våra lags matcher sparas
      const ours = parseMatches(html, group.name, group.stage).filter(
        (m) => m.home_team.includes(OUR_CLUB) || m.away_team.includes(OUR_CLUB)
      )
      if (ours.length > 0) {
        const { error } = await supabase
          .from('matches')
          .upsert(ours, { onConflict: 'cupmate_match_id' })
        if (error) throw new Error(`matches: ${error.message}`)
        matchCount += ours.length
      }

      // Hela tabellen sparas för våra grupper (slutspel har ingen tabell)
      if (group.stage === 'group') {
        const standings = parseStandings(html, group.name)
        if (standings.length > 0) {
          const { error } = await supabase
            .from('standings')
            .upsert(standings, { onConflict: 'group_name,team_name' })
          if (error) throw new Error(`standings: ${error.message}`)
          standingCount += standings.length
        }
      }
    }

    await supabase
      .from('sync_state')
      .update({ last_status: `ok: ${matchCount} matcher, ${standingCount} tabellrader` })
      .eq('id', 1)

    return Response.json({ ok: true, matchCount, standingCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'okänt fel'
    await supabase
      .from('sync_state')
      .update({ last_status: `fel: ${message}` })
      .eq('id', 1)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
