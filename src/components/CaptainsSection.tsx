// Kaptenssektion på Trupperna-sidan: lagens utvalda kaptener och de gemensamma
// ansvarspunkterna. Serverrenderad — kaptener och ansvar ändras sällan.

import Image from "next/image";
import { toPoints, type Player } from "@/lib/briefing";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;

export default function CaptainsSection({
  teams,
  players,
  responsibilities,
  revealed,
}: {
  teams: Team[];
  players: Player[];
  responsibilities: string | null;
  // false = kaptenerna är valda men hålls hemliga ("presenteras senare")
  revealed: boolean;
}) {
  const points = toPoints(responsibilities);
  const perTeam = teams
    .map((team) => ({
      team,
      captains: players.filter((p) => p.team_id === team.id && p.is_captain),
    }))
    .filter((t) => t.captains.length > 0);

  const hasCaptains = perTeam.length > 0;

  // Visa inget alls om varken kaptener eller ansvar är inlagt
  if (!hasCaptains && points.length === 0) return null;

  return (
    <section className="mb-8 rounded-2xl bg-white p-4 shadow-card sm:p-5">
      <h2 className="mb-3 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
        Kaptener
      </h2>

      {/* Hemliga tills ledaren väljer att presentera dem */}
      {hasCaptains && !revealed && (
        <div className="mb-4 rounded-xl border border-dashed border-ink/20 bg-paper px-4 py-5 text-center">
          <p className="text-2xl" aria-hidden>
            🤫
          </p>
          <p className="mt-1 text-sm font-bold">Kaptenerna presenteras senare</p>
        </div>
      )}

      {hasCaptains && revealed && (
        <div className="mb-4 space-y-2">
          {perTeam.map(({ team, captains }) => (
            <div key={team.id} className="flex flex-wrap items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full border border-ink/40"
                style={{ backgroundColor: team.color }}
                aria-hidden
              />
              <span className="text-sm font-bold uppercase tracking-wide text-ink/60">
                {team.name}
              </span>
              {captains.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-2 rounded-full bg-pine py-1 pl-1 pr-3 text-sm font-semibold text-paper"
                >
                  <span className="relative shrink-0">
                    {c.photo_url ? (
                      <Image
                        src={c.photo_url}
                        alt={c.name}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-paper/20 text-base"
                        aria-hidden
                      >
                        ⚽
                      </span>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-pine bg-sun text-[9px] font-bold text-ink">
                      C
                    </span>
                  </span>
                  {c.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {points.length > 0 && (
        <div className="rounded-xl bg-paper p-3">
          <p className="mb-1 font-[family-name:var(--font-display)] font-bold text-sm uppercase text-grass">
            Kaptenens ansvar
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
