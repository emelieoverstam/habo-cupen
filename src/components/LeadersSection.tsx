// Ledarsektion på Trupperna-sidan: lagens ledare som en enkel namnlista.
// Serverrenderad — ändras sällan. Namnen lagras radvis i teams.leaders.

import { toPoints } from "@/lib/briefing";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;

export default function LeadersSection({ teams }: { teams: Team[] }) {
  const perTeam = teams
    .map((team) => ({ team, names: toPoints(team.leaders) }))
    .filter((t) => t.names.length > 0);

  if (perTeam.length === 0) return null;

  return (
    <section className="mb-8 rounded-2xl bg-white p-4 shadow-card sm:p-5">
      <h2 className="mb-3 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
        Ledare
      </h2>

      <div className="space-y-2">
        {perTeam.map(({ team, names }) => (
          <div key={team.id} className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full border border-ink/40"
              style={{ backgroundColor: team.color }}
              aria-hidden
            />
            <span className="text-sm font-bold uppercase tracking-wide text-ink/60">
              {team.name}
            </span>
            {names.map((name, i) => (
              <span
                key={i}
                className="rounded-full bg-paper px-2.5 py-1 text-sm font-semibold"
              >
                {name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
