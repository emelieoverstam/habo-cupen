// Trupperna som spelarkort i samlarkortsstil, med en "reveal" där
// korten vänds upp ett i taget — spelas upp automatiskt första gången
// och kan köras igen via knappen.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ClubCrest from "@/components/ClubCrest";
import {
  Confetti,
  makeConfetti,
  type ConfettiPiece,
} from "@/components/PackingList";
import { toPoints } from "@/lib/briefing";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type Player = Tables<"players">;

const REVEAL_KEY = "habocupen-trupp-reveal";
const REVEAL_STEP_MS = 2100;
const REVEAL_INTRO_MS = 2200;

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
    // Ms Madi är bred — krymp tidigt så att långa namn inte klipps
    size: name.length > 9 ? "text-2xl" : "text-3xl",
    // Baksidan har mer plats — där får namnet vara ett steg större
    sizeBack: name.length > 9 ? "text-3xl" : "text-4xl",
  };
}

/* Välj läsbar textfärg (mörk/ljus) mot en bakgrundsfärg utifrån enkel luminans. */
function readableTextColor(hex: string): string {
  const m = hex.replace("#", "");
  if (m.length < 6) return "var(--ink)";
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "var(--ink)" : "var(--paper)";
}

export default function SquadSection({
  players,
  teams,
  captainsRevealed,
}: {
  players: Player[];
  teams: Team[];
  captainsRevealed: boolean;
}) {
  const teamsWithPlayers = teams.filter((t) =>
    players.some((p) => p.team_id === t.id)
  );
  const totalPlayers = teamsWithPlayers.reduce(
    (sum, t) => sum + players.filter((p) => p.team_id === t.id).length,
    0
  );

  // idle = ingen reveal; intro = arenaintrot; playing = korten vänds
  const [phase, setPhase] = useState<"idle" | "intro" | "playing">("idle");
  // Hur många kort som vänts upp under uppspelningen
  const [revealStage, setRevealStage] = useState(0);
  // false tills mount-effekten avgjort om revealen ska spelas (döljer truppen
  // så den inte glimtar förbi innan introt)
  const [revealDecided, setRevealDecided] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startReveal() {
    if (totalPlayers === 0) return;

    // Med "minska rörelse" hoppar vi över hela uppspelningen
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        localStorage.setItem(REVEAL_KEY, "1");
      } catch {}
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Arenaintro i helskärm innan korten börjar vändas
    setPhase("intro");
    setRevealStage(0);
    window.scrollTo({ top: 0, behavior: "smooth" });

    timeoutRef.current = setTimeout(() => {
      setPhase("playing");

      // Vänd ett kort: scrolla fram det och räkna upp stage
      const flip = (stage: number) => {
        setRevealStage(stage);
        const card = document.querySelector(
          `[data-card-index="${stage - 1}"]`
        );
        card?.scrollIntoView({ behavior: "smooth", block: "center" });
      };

      // Första kortet vänds direkt så introt övergår sömlöst i showen
      let stage = 1;
      flip(stage);

      intervalRef.current = setInterval(() => {
        stage += 1;
        if (stage > totalPlayers) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPhase("idle");
          // Final: konfettiregn över hela truppen
          setConfetti(makeConfetti());
          timeoutRef.current = setTimeout(() => setConfetti(null), 5500);
          try {
            localStorage.setItem(REVEAL_KEY, "1");
          } catch {
            // privat läge — då spelas revealen helt enkelt vid varje besök
          }
          return;
        }
        flip(stage);
      }, REVEAL_STEP_MS);
    }, REVEAL_INTRO_MS);
  }

  // Avgör vid mount om revealen ska spelas — innan truppen hinner synas.
  // Defererat i en timer så att setState inte sker synkront i effekten.
  useEffect(() => {
    let seen = "1";
    try {
      seen = localStorage.getItem(REVEAL_KEY) ?? "";
    } catch {
      seen = "1";
    }
    const timer = setTimeout(() => {
      if (!seen) startReveal();
      setRevealDecided(true);
    }, 0);
    return () => clearTimeout(timer);
    // React-kompilatorn memoiserar startReveal åt oss — useCallback här
    // krockar med react-hooks/preserve-manual-memoization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Städa timers om sidan lämnas mitt i revealen
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  if (teamsWithPlayers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-paper/30 px-4 py-8 text-center font-semibold text-paper/70">
        Trupperna är inte publicerade ännu.
      </p>
    );
  }

  const revealActive = phase !== "idle";
  let globalIndex = 0;

  return (
    <>
      {confetti && <Confetti pieces={confetti} />}

      {/* Ridå tills mount-effekten avgjort om revealen ska spelas — döljer
          truppen så den inte glimtar förbi innan introt */}
      {!revealDecided && <div className="fixed inset-0 z-50 bg-pine" aria-hidden />}

      {/* Arenaintro innan korten vänds */}
      {phase === "intro" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-pine px-6 text-center">
          <p
            className="rise text-xs font-bold uppercase tracking-[0.35em] text-paper/70"
            style={{ animationDelay: "150ms" }}
          >
            Habo-cupen 2026
          </p>
          <p
            className="rise font-[family-name:var(--font-display)] font-bold text-2xl uppercase leading-tight text-sun sm:text-4xl"
            style={{ animationDelay: "450ms" }}
          >
            Laguppställningen
          </p>
          <p
            className="rise font-[family-name:var(--font-display)] font-bold text-xl uppercase text-paper sm:text-2xl"
            style={{ animationDelay: "850ms" }}
          >
            BK Zeros
          </p>
          <p className="rise text-3xl" style={{ animationDelay: "1200ms" }}>
            🥁
          </p>
        </div>
      )}

      <div className="mb-4 text-center">
        <button
          type="button"
          onClick={startReveal}
          disabled={revealActive}
          className="rounded-full border border-paper/30 bg-paper/10 px-4 py-1.5 text-sm font-bold text-paper transition-transform active:scale-95 disabled:opacity-50"
        >
          {revealActive ? "Presenterar…" : "🎬 Presentera lagen"}
        </button>
      </div>

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
              {squad.map((player, index) => {
                const cardIndex = globalIndex++;
                const shown = phase === "playing" && revealStage > cardIndex;
                const isCurrent =
                  phase === "playing" && revealStage - 1 === cardIndex;
                const isUpNext =
                  phase === "playing" && revealStage === cardIndex;
                return (
                  <li
                    key={player.id}
                    data-card-index={cardIndex}
                    className={`rise transition-all duration-300 ${
                      isCurrent ? "card-spotlight z-10 scale-105" : ""
                    } ${isUpNext ? "card-wobble" : ""} ${
                      revealActive && !shown && !isCurrent ? "opacity-50" : ""
                    }`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <PlayerCard
                      player={player}
                      teamLabel={team.name.replace("BK Zeros ", "")}
                      teamColor={team.color}
                      tilt={index % 2 === 0 ? "card-tilt-l" : "card-tilt-r"}
                      revealActive={revealActive}
                      revealShown={shown}
                      captainsRevealed={captainsRevealed}
                    />
                  </li>
                );
              })}
            </ul>

            {(() => {
              const leaders = toPoints(team.leaders);
              if (leaders.length === 0) return null;
              return (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-paper/55">
                    Ledare
                  </span>
                  {leaders.map((name, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-paper/15 px-2.5 py-0.5 text-sm font-semibold text-paper"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })}
    </>
  );
}

/* Spelarkort i samlarkortsstil: créme-ram med guldlinje, porträtt,
   nummerbricka och namnet som autograf. Tryck vänder kortet i 3D och
   visar baksidan i klubbgrönt; vid hover lyfter kortet med foil-glans.
   Under revealen styrs vändningen av sekvensen i stället. */
function PlayerCard({
  player,
  teamLabel,
  teamColor,
  tilt,
  revealActive,
  revealShown,
  captainsRevealed,
}: {
  player: Player;
  teamLabel: string;
  teamColor: string;
  tilt: string;
  revealActive: boolean;
  revealShown: boolean;
  captainsRevealed: boolean;
}) {
  const [userFlipped, setUserFlipped] = useState(false);
  const autograph = autographFor(player.id, player.name);
  const flipped = revealActive ? !revealShown : userFlipped;

  return (
    <button
      type="button"
      onClick={() => {
        if (!revealActive) setUserFlipped((f) => !f);
      }}
      aria-pressed={flipped}
      aria-label={`Vänd spelarkortet för ${player.name}`}
      className={`card-3d block w-full cursor-pointer text-left ${tilt}`}
    >
      <div
        className={`card-inner relative ${flipped ? "is-flipped" : ""} ${
          revealActive && revealShown ? "card-spin" : ""
        }`}
      >
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
                <span
                  className="absolute left-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 font-[family-name:var(--font-display)] font-bold text-sm shadow-chip"
                  style={{
                    backgroundColor: teamColor,
                    color: readableTextColor(teamColor),
                  }}
                >
                  {player.number}
                </span>
              )}
              {player.is_captain && captainsRevealed && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-sun bg-pine font-[family-name:var(--font-display)] font-bold text-base text-sun shadow-chip"
                  aria-label="Kapten"
                >
                  C
                </span>
              )}
              <span className="card-shine" aria-hidden />
            </div>
            <div className="px-1 pb-1 pt-1.5 text-center">
              {/* Namnet som autograf under fotot. Hela namnet i en autograf som
                  radbryts vid behov. Fast höjd så alla kort blir lika höga. */}
              <div className="flex h-16 items-center justify-center">
                <p
                  className={`line-clamp-2 ${autograph.size} ${autograph.tilt} leading-tight text-ink`}
                  style={{ fontFamily: autograph.font }}
                >
                  {player.name}
                </p>
              </div>
              {/* Klubbmärke + lagfärgs-plupp i stället för upprepad lag-text */}
              <div className="mt-1.5 flex items-center justify-center gap-2">
                <ClubCrest className="h-6 w-auto opacity-80" />
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-ink/30"
                  style={{ backgroundColor: teamColor }}
                  aria-label={`Lag ${teamLabel}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Baksida */}
        <div className="card-face card-back absolute inset-0 rounded-xl bg-pine p-1.5 shadow-card">
          <div className="card-back-pattern flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-sun/70 px-2 text-center">
            <ClubCrest className="h-14 w-auto" />
            {/* Under revealen avslöjar baksidan inget om spelaren — då står
                klubbmärket ensamt */}
            {!revealActive && (
              <>
                {player.number !== null && (
                  <p className="font-[family-name:var(--font-display)] font-bold text-6xl leading-none text-paper">
                    {player.number}
                  </p>
                )}
                <p
                  className={`line-clamp-2 w-full ${autograph.sizeBack} ${autograph.tilt} leading-tight text-sun`}
                  style={{ fontFamily: autograph.font }}
                >
                  {player.name}
                </p>
              </>
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/60">
              Habo-cupen 2026 · {teamLabel}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
