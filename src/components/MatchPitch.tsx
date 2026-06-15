"use client";

// Fotbollsplan med utplacerade spelare. I läsläge visas bara dottar; i
// editläge kan en dot dras (pointer events, fungerar på touch) och tas bort.

import Image from "next/image";
import { POSITIONS, type LineupSlot, type Player, type Position } from "@/lib/briefing";

type Props = {
  lineup: LineupSlot[];
  players: Player[];
  // Editläge: anropas när en dot dras till en ny position (x/y 0–1)
  onMove?: (playerId: string, x: number, y: number) => void;
  // Editläge: anropas när en dot tas bort (tillbaka till bänken)
  onRemove?: (playerId: string) => void;
  // Editläge: anropas när ledaren väljer position för en spelare
  onSetPosition?: (playerId: string, position: Position) => void;
  // Matchkaptenen ritas med ett "C" på sin dott
  captainId?: string | null;
};

/* Räkna om en pekarposition till andel (0–1) av planens bredd/höjd. */
function fractionFromPointer(
  clientX: number,
  clientY: number,
  el: HTMLElement
) {
  const rect = el.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return { x: clamp(x), y: clamp(y) };
}

// Linjefärg: dämpad créme som syns tydligt mot gräset
const LINE = "rgba(242,237,217,0.65)";
const GOAL_FILL = "rgba(242,237,217,0.14)";

/* Planlinjering ritad i SVG (viewBox 300×400 = samma 3:4 som planen).
   y=0 är överkant (motståndarmål), y=400 underkant (eget mål). */
function PitchLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 300 400"
      fill="none"
      stroke={LINE}
      strokeWidth={2.2}
      aria-hidden
    >
      {/* Yttre begränsningslinjer */}
      <rect x="12" y="12" width="276" height="376" rx="2" />
      {/* Mittlinje, mittcirkel och mittprick */}
      <line x1="12" y1="200" x2="288" y2="200" />
      <circle cx="150" cy="200" r="42" />
      <circle cx="150" cy="200" r="2.5" fill={LINE} stroke="none" />

      {/* Övre planhalva: straffområde, målområde, straffprick och båge */}
      <rect x="70" y="12" width="160" height="58" />
      <rect x="105" y="12" width="90" height="26" />
      <circle cx="150" cy="50" r="2.5" fill={LINE} stroke="none" />
      <path d="M121,70 A36 36 0 0 0 179 70" />

      {/* Nedre planhalva */}
      <rect x="70" y="330" width="160" height="58" />
      <rect x="105" y="362" width="90" height="26" />
      <circle cx="150" cy="350" r="2.5" fill={LINE} stroke="none" />
      <path d="M121,330 A36 36 0 0 1 179 330" />

      {/* Hörnbågar */}
      <path d="M12 19 A7 7 0 0 0 19 12" />
      <path d="M281 12 A7 7 0 0 0 288 19" />
      <path d="M12 381 A7 7 0 0 1 19 388" />
      <path d="M281 388 A7 7 0 0 1 288 381" />

      {/* Mål – sticker ut en aning utanför mållinjerna */}
      <rect x="123" y="4" width="54" height="8" fill={GOAL_FILL} />
      <line x1="136.5" y1="4" x2="136.5" y2="12" strokeWidth="1.2" />
      <line x1="150" y1="4" x2="150" y2="12" strokeWidth="1.2" />
      <line x1="163.5" y1="4" x2="163.5" y2="12" strokeWidth="1.2" />
      <rect x="123" y="388" width="54" height="8" fill={GOAL_FILL} />
      <line x1="136.5" y1="388" x2="136.5" y2="396" strokeWidth="1.2" />
      <line x1="150" y1="388" x2="150" y2="396" strokeWidth="1.2" />
      <line x1="163.5" y1="388" x2="163.5" y2="396" strokeWidth="1.2" />
    </svg>
  );
}

export default function MatchPitch({
  lineup,
  players,
  onMove,
  onRemove,
  onSetPosition,
  captainId,
}: Props) {
  const editable = !!onMove;
  const byId = new Map(players.map((p) => [p.id, p]));

  function handlePointerDown(e: React.PointerEvent, playerId: string) {
    if (!onMove) return;
    e.preventDefault();
    const pitch = e.currentTarget.parentElement;
    if (!pitch) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const { x, y } = fractionFromPointer(ev.clientX, ev.clientY, pitch);
      onMove(playerId, x, y);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border-2 border-paper/30 bg-grass"
      style={{
        aspectRatio: "3 / 4",
        // Diskreta klippränder för plankänsla
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 12.5%, transparent 12.5%, transparent 25%)",
      }}
    >
      <PitchLines />
      {lineup.map((slot) => {
        const player = byId.get(slot.player_id);
        if (!player) return null;
        return (
          <div
            key={slot.player_id}
            onPointerDown={(e) => handlePointerDown(e, slot.player_id)}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
              editable ? "cursor-grab touch-none active:cursor-grabbing" : ""
            }`}
            style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
          >
            <span className="relative">
              {player.photo_url ? (
                <span className="relative block h-9 w-9 overflow-hidden rounded-full bg-sun shadow-chip">
                  <Image
                    src={player.photo_url}
                    alt={player.name}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </span>
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun font-[family-name:var(--font-display)] font-bold text-sm text-ink shadow-chip">
                  {player.number ?? "–"}
                </span>
              )}
              {player.photo_url && player.number != null && (
                <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-paper bg-pine px-1 text-[9px] font-bold leading-none text-paper">
                  {player.number}
                </span>
              )}
              {captainId === slot.player_id && (
                <span
                  className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-paper bg-pine text-[9px] font-bold leading-none text-sun"
                  aria-label="Kapten"
                >
                  C
                </span>
              )}
            </span>
            <span className="mt-0.5 max-w-16 truncate rounded bg-ink/70 px-1 text-xs font-semibold text-paper">
              {player.name.split(" ")[0]}
            </span>
            {editable && onSetPosition ? (
              <select
                value={slot.position ?? ""}
                onChange={(e) =>
                  onSetPosition(slot.player_id, e.target.value as Position)
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Position för ${player.name}`}
                className="mt-0.5 rounded bg-pine px-1 py-0.5 text-[10px] font-bold text-paper"
              >
                <option value="" disabled>
                  Pos
                </option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              slot.position && (
                <span className="mt-0.5 rounded bg-pine px-1 text-[10px] font-bold text-paper">
                  {slot.position}
                </span>
              )
            )}
            {editable && onRemove && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onRemove(slot.player_id)}
                aria-label={`Ta bort ${player.name} från planen`}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-falu text-xs font-bold text-paper"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
