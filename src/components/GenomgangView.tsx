"use client";

// Genomgång-fliken: visar nästa kommande match per lag och låter spelaren
// växla mellan lagen (Vit/Grön). Uppdateras live via schemakanalen.

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useScheduleLive } from "@/lib/use-schedule-live";
import { useCurrentMinute } from "@/lib/time";
import { type Briefing, parseBriefing, pickBriefing } from "@/lib/briefing";
import SiteHeader from "@/components/SiteHeader";
import MatchBriefing from "@/components/MatchBriefing";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type Player = Tables<"players">;
type Match = Tables<"matches">;

const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

export default function GenomgangView({
  initialTeams,
  initialPlayers,
  initialMatches,
  initialBriefings,
}: {
  initialTeams: Team[];
  initialPlayers: Player[];
  initialMatches: Match[];
  initialBriefings: Briefing[];
}) {
  const [teams] = useState(initialTeams);
  const [players, setPlayers] = useState(initialPlayers);
  const [matches, setMatches] = useState(initialMatches);
  const [briefings, setBriefings] = useState(initialBriefings);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(
    initialTeams[0]?.id ?? null
  );
  const now = useCurrentMinute();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [p, m, b] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("matches").select("*"),
      supabase.from("match_briefings").select("*"),
    ]);
    if (p.data) setPlayers(p.data);
    if (m.data) setMatches(m.data);
    if (b.data) setBriefings(b.data.map(parseBriefing));
  }, []);

  useScheduleLive(refresh);

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  // Nästa kommande match för det aktiva laget (matchnamn matchar Cupmates exakt)
  const nextMatch = useMemo(() => {
    if (!activeTeam || !now) return null;
    return (
      matches
        .filter(
          (m) =>
            (m.home_team === activeTeam.name || m.away_team === activeTeam.name) &&
            m.starts_at &&
            new Date(m.starts_at) > now
        )
        .sort((a, b) => (a.starts_at! < b.starts_at! ? -1 : 1))[0] ?? null
    );
  }, [matches, activeTeam, now]);

  const briefing = activeTeam
    ? pickBriefing(briefings, activeTeam.id, nextMatch?.id ?? null)
    : null;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="genomgang" />

      {teams.length > 1 && (
        <div className="mb-5 flex gap-2">
          {teams.map((team) => {
            const active = team.id === activeTeamId;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setActiveTeamId(team.id)}
                aria-pressed={active}
                className={`flex-1 rounded-xl border px-3 py-2 font-[family-name:var(--font-display)] font-bold text-base uppercase transition-transform active:scale-95 ${
                  active
                    ? "border-transparent bg-sun text-ink shadow-chip"
                    : "border-paper/30 bg-paper/10 text-paper hover:bg-paper/20"
                }`}
              >
                {team.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
        <h2 className="mb-1 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          {nextMatch
            ? `${nextMatch.home_team} – ${nextMatch.away_team}`
            : "Lagets upplägg"}
        </h2>
        {nextMatch?.starts_at && (
          <p className="mb-4 text-sm font-semibold text-ink/60">
            {dateFormat.format(new Date(nextMatch.starts_at))}
            {nextMatch.pitch && <> · Plan {nextMatch.pitch}</>}
          </p>
        )}
        <MatchBriefing briefing={briefing} players={players} />
      </div>
    </main>
  );
}
