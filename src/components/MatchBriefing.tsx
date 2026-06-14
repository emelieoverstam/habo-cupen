"use client";

// Läsvy för en matchgenomgång. Visar plan-vy + grupperad startelva +
// avbytare + offensiva/defensiva punkter. Används både i Genomgång-fliken
// och utfällt på en match i schemat.

import {
  type Briefing,
  type Player,
  benchPlayers,
  briefingHasContent,
  groupLineup,
  toPoints,
} from "@/lib/briefing";
import MatchPitch from "@/components/MatchPitch";

export default function MatchBriefing({
  briefing,
  players,
}: {
  briefing: Briefing | null;
  players: Player[];
}) {
  if (!briefingHasContent(briefing) || !briefing) {
    return (
      <p className="rounded-xl border border-dashed border-ink/20 px-4 py-6 text-center text-sm font-semibold text-ink/60">
        Ingen genomgång inlagd ännu.
      </p>
    );
  }

  const groups = groupLineup(briefing.lineup, players);
  const bench = benchPlayers(briefing.bench, players);
  const offensive = toPoints(briefing.offensive);
  const defensive = toPoints(briefing.defensive);

  return (
    <div className="space-y-5">
      {briefing.formation && (
        <p className="text-center text-xs font-bold uppercase tracking-[0.15em] text-ink/60">
          Start 9:a · {briefing.formation}
        </p>
      )}

      {briefing.lineup.length > 0 && (
        <MatchPitch lineup={briefing.lineup} players={players} />
      )}

      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.role}>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/55">
                {group.role}
              </p>
              <ul className="space-y-1">
                {group.entries.map(({ player }) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine text-xs font-bold text-paper">
                      {player.number ?? "–"}
                    </span>
                    <span className="text-sm font-semibold">{player.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {bench.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/55">
            Avbytare
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {bench.map((player) => (
              <li
                key={player.id}
                className="rounded-full bg-paper px-2.5 py-1 text-sm font-semibold"
              >
                {player.number != null && (
                  <span className="mr-1 text-ink/60">{player.number}</span>
                )}
                {player.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(offensive.length > 0 || defensive.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {offensive.length > 0 && (
            <div className="rounded-xl bg-paper p-3">
              <p className="mb-1 font-[family-name:var(--font-display)] font-bold text-sm uppercase text-grass">
                ⚽ Offensivt
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {offensive.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {defensive.length > 0 && (
            <div className="rounded-xl bg-paper p-3">
              <p className="mb-1 font-[family-name:var(--font-display)] font-bold text-sm uppercase text-falu">
                🛡️ Defensivt
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {defensive.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {briefing.note && (
        <p className="rounded-lg bg-paper px-3 py-2 text-sm">{briefing.note}</p>
      )}
    </div>
  );
}
