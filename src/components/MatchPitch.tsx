"use client";

// Fotbollsplan med utplacerade spelare. I läsläge visas bara dottar; i
// editläge kan en dot dras (pointer events, fungerar på touch) och tas bort.

import type { LineupSlot, Player } from "@/lib/briefing";

type Props = {
  lineup: LineupSlot[];
  players: Player[];
  // Editläge: anropas när en dot dras till en ny position (x/y 0–1)
  onMove?: (playerId: string, x: number, y: number) => void;
  // Editläge: anropas när en dot tas bort (tillbaka till bänken)
  onRemove?: (playerId: string) => void;
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

export default function MatchPitch({ lineup, players, onMove, onRemove }: Props) {
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
        // Mittlinje + diskret raster
        backgroundImage:
          "linear-gradient(0deg, rgba(242,237,217,.25) 1px, transparent 1px)",
        backgroundSize: "100% 25%",
      }}
    >
      {/* Mittcirkel */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper/30"
        aria-hidden
      />
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
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun font-[family-name:var(--font-display)] font-bold text-sm text-ink shadow-chip">
              {player.number ?? "–"}
            </span>
            <span className="mt-0.5 max-w-16 truncate rounded bg-ink/70 px-1 text-xs font-semibold text-paper">
              {player.name.split(" ")[0]}
            </span>
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
