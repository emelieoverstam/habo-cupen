// Hämtning och parsning av spelschema, resultat och tabeller från cupmate.nu
// (Habocupen 2026, klass F2013). Körs bara på servern.

import type { TablesInsert } from '@/types/database'

const CUP_ID = 15637
const CLASS_ID = 21644
const CUP_YEAR = 2026

// Grupperna vi följer: BK Zeros Vit i Grupp A, BK Zeros Grön i Grupp C,
// plus båda slutspelen (matcher dyker upp där när gruppspelet är klart)
export const CUPMATE_GROUPS = [
  { groupId: 107010, name: 'Grupp A', stage: 'group' as const },
  { groupId: 107012, name: 'Grupp C', stage: 'group' as const },
  { groupId: 107017, name: 'A-slutspel', stage: 'playoff' as const },
  { groupId: 107020, name: 'B-slutspel', stage: 'playoff' as const },
]

export const OUR_CLUB = 'BK Zeros'

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', maj: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dec: '12',
}

/* Avkoda de HTML-entiteter som förekommer i Cupmates lagnamn */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&ouml;/g, 'ö').replace(/&Ouml;/g, 'Ö')
    .replace(/&auml;/g, 'ä').replace(/&Auml;/g, 'Ä')
    .replace(/&aring;/g, 'å').replace(/&Aring;/g, 'Å')
    .replace(/&eacute;/g, 'é').replace(/&Eacute;/g, 'É')
    .replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

/* "Lö 28 jun 08.00" → ISO-tid med svensk sommartid samt dagens datum */
function parseStartTime(
  raw: string
): { startsAt: string; day: string } | null {
  const m = raw.match(/(\d{1,2})\s+([a-zåäö]{3})\s+(\d{1,2})\.(\d{2})/i)
  if (!m) return null
  const month = MONTHS[m[2].toLowerCase()]
  if (!month) return null
  const dayNum = m[1].padStart(2, '0')
  const day = `${CUP_YEAR}-${month}-${dayNum}`
  const time = `${m[3].padStart(2, '0')}:${m[4]}`
  return { startsAt: `${day}T${time}:00+02:00`, day }
}

export type ParsedMatch = TablesInsert<'matches'>
export type ParsedStanding = Omit<TablesInsert<'standings'>, 'id'>

export function parseMatches(
  html: string,
  groupName: string,
  stage: 'group' | 'playoff'
): ParsedMatch[] {
  const matches: ParsedMatch[] = []
  const items = html.match(
    /<li class="gameList_item[\s\S]*?<\/li>/g
  )
  if (!items) return matches

  for (const item of items) {
    const idMatch = item.match(/iMatchID=(\d+)/)
    if (!idMatch) continue

    const teams = [
      ...item.matchAll(
        /gameList_item-team\s*"[^>]*>(?:<div[^>]*><\/div>)?([^<]+)</g
      ),
    ].map((t) => decodeEntities(t[1]))
    if (teams.length < 2) continue

    const info = item.match(/#(\d+)\s*-\s*([^<]*)/)
    const matchNo = info ? Number(info[1]) : null
    const time = info ? parseStartTime(info[2]) : null

    const pitch = item.match(/places\.php[^>]*>\s*([^<]+?)\s*</)
    const result = item.match(
      /gameList_item-result[\s\S]*?>\s*(\d+)\s*-\s*(\d+)\s*</
    )

    matches.push({
      cupmate_match_id: Number(idMatch[1]),
      match_no: matchNo,
      group_name: groupName,
      stage,
      home_team: teams[0],
      away_team: teams[1],
      home_score: result ? Number(result[1]) : null,
      away_score: result ? Number(result[2]) : null,
      starts_at: time?.startsAt ?? null,
      day: time?.day ?? null,
      pitch: pitch ? decodeEntities(pitch[1]) : null,
    })
  }
  return matches
}

export function parseStandings(
  html: string,
  groupName: string
): ParsedStanding[] {
  const table = html.match(
    /<table class="table standings[\s\S]*?<\/table>/
  )
  if (!table) return []

  const rows: ParsedStanding[] = []
  for (const row of table[0].match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const cell = (cls: string) =>
      row.match(
        new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>\\s*(?:<a[^>]*>)?(?:<div[^>]*></div>)?([^<]*)`)
      )?.[1]

    const teamName = row.match(
      /class="teamname"><a[^>]*>(?:<div[^>]*><\/div>)?([^<]+)/
    )?.[1]
    if (!teamName) continue

    // Innan cupen startat saknar tabellen placeringskolumn — använd radordningen
    const position = cell('place')?.match(/\d+/)?.[0]

    rows.push({
      group_name: groupName,
      position: position ? Number(position) : rows.length + 1,
      team_name: decodeEntities(teamName),
      played: Number(cell('played') ?? 0),
      won: Number(cell('won') ?? 0),
      drawn: Number(cell('draw') ?? 0),
      lost: Number(cell('lost') ?? 0),
      goals: decodeEntities(cell('goals') ?? '') || null,
      goal_diff: Number(cell('goaldiff') ?? 0),
      points: Number(cell('points') ?? 0),
    })
  }
  return rows
}

export async function fetchGroupPage(groupId: number): Promise<string> {
  const url = `https://www.cupmate.nu/matcher.php?iCupID=${CUP_ID}&iClassID=${CLASS_ID}&iGroupID=${groupId}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Cupmate svarade ${res.status} för grupp ${groupId}`)
  }
  return res.text()
}
