// Trupperna som spelarkort i samlarkortsstil
import { useState } from "react";
import Image from "next/image";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type Player = Tables<"players">;

/* Autografen får en lätt individuell lutning (stabil utifrån spelarens
   id). Långa namn blir mindre så att de inte klipps. */
const AUTOGRAPH_FONTS = ["var(--font-autograph-1)"];
const AUTOGRAPH_TILTS = ["-rotate-3", "rotate-2", "-rotate-2", "rotate-3"];

function autographFor(id: string, name: string) {
  let hash = 0;
  for (const ch of id) hash = (hash + ch.charCodeAt(0)) % 997;
  return {
    font: AUTOGRAPH_FONTS[hash % AUTOGRAPH_FONTS.length],
    tilt: AUTOGRAPH_TILTS[hash % AUTOGRAPH_TILTS.length],
    // Ms Madi är bred — krymp tidigt så att namnen inte klipps
    size: name.length > 12 ? "text-xl" : "text-2xl",
  };
}

export default function SquadSection({
  players,
  teams,
}: {
  players: Player[];
  teams: Team[];
}) {
  const teamsWithPlayers = teams.filter((t) =>
    players.some((p) => p.team_id === t.id)
  );

  if (teamsWithPlayers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-paper/30 px-4 py-8 text-center font-semibold text-paper/70">
        Trupperna är inte publicerade ännu.
      </p>
    );
  }

  return (
    <>
      {teamsWithPlayers.map((team) => {
        const squad = players.filter((p) => p.team_id === team.id);
        return (
          <div key={team.id} className="mb-7">
            <h2 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-lg uppercase text-paper">
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-ink/40"
                style={{ backgroundColor: team.color }}
                aria-hidden
              />
              {team.name}
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {squad.map((player, index) => (
                <li
                  key={player.id}
                  className="rise"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <PlayerCard
                    player={player}
                    teamLabel={team.name.replace("BK Zeros ", "")}
                    tilt={index % 2 === 0 ? "card-tilt-l" : "card-tilt-r"}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/* Spelarkort i samlarkortsstil: créme-ram med guldlinje, porträtt,
   nummerbricka och namnet som autograf. Tryck vänder kortet i 3D och
   visar baksidan i klubbgrönt; vid hover lyfter kortet med foil-glans. */
function PlayerCard({
  player,
  teamLabel,
  tilt,
}: {
  player: Player;
  teamLabel: string;
  tilt: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const autograph = autographFor(player.id, player.name);

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      aria-label={`Vänd spelarkortet för ${player.name}`}
      className={`card-3d block w-full cursor-pointer text-left ${tilt}`}
    >
      <div className={`card-inner relative ${flipped ? "is-flipped" : ""}`}>
        {/* Framsida */}
        <div className="card-face rounded-xl bg-paper p-1.5 shadow-card">
          <div className="rounded-lg border border-sun p-1">
            <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-pine/15">
              {player.photo_url ? (
                <Image
                  src={player.photo_url}
                  alt={player.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl">
                  <span aria-hidden>⚽</span>
                </div>
              )}
              {player.number !== null && (
                <span className="absolute left-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-sun font-[family-name:var(--font-display)] font-bold text-sm text-ink shadow-chip">
                  {player.number}
                </span>
              )}
              <span className="card-shine" aria-hidden />
            </div>
            <div className="px-1 pb-1 pt-1.5 text-center">
              {/* Namnet som autograf under fotot */}
              <p
                className={`truncate ${autograph.size} ${autograph.tilt} leading-tight text-ink`}
                style={{ fontFamily: autograph.font }}
              >
                {player.name}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50">
                BK Zeros · {teamLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Baksida */}
        <div className="card-face card-back absolute inset-0 rounded-xl bg-pine p-1.5 shadow-card">
          <div className="card-back-pattern flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-sun/70 px-2 text-center">
            <p className="font-[family-name:var(--font-display)] font-bold text-xs tracking-[0.3em] text-sun">
              BK ZEROS
            </p>
            <p className="font-[family-name:var(--font-display)] font-bold text-6xl leading-none text-paper">
              {player.number ?? "⚽"}
            </p>
            <p
              className={`w-full truncate ${autograph.size} ${autograph.tilt} leading-tight text-sun`}
              style={{ fontFamily: autograph.font }}
            >
              {player.name}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/60">
              Habo-cupen 2026 · {teamLabel}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
