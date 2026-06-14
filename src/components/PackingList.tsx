"use client";

// Packlista för cuphelgen (från förra årets sajt). Avbockningen sparas
// i localStorage så varje familj har sin egen lista på sin enhet.
// När allt är ibockat regnar det konfetti!

import { useMemo, useState, useSyncExternalStore } from "react";

const ITEMS = [
  { emoji: "⚽", text: "Matchdress" },
  { emoji: "🧦", text: "Matchstrumpor (gärna fler par om man har)" },
  { emoji: "🛡️", text: "Benskydd" },
  { emoji: "👟", text: "Fotbollsskor" },
  { emoji: "🚰", text: "Vattenflaska" },
  { emoji: "🧥", text: "Överdragskläder (tröja/byxa)" },
  {
    emoji: "🎒",
    text: "Ryggsäck/Gympapåse som man kan använda till och från matcher",
  },
  { emoji: "🛁", text: "Handduk" },
  {
    emoji: "🧼",
    text: "Hygienartiklar (schampo, balsam, tandborste, tandkräm, solkräm, mindre handduk, hårborste)",
  },
  {
    emoji: "🩹",
    text: "Skavsårsplåster, benskyddstejp, huvudvärkstabletter och liknande",
  },
  {
    emoji: "🧵",
    text: "Galge (för att hänga upp matchdressen på mellan matcher)",
  },
  { emoji: "🧢", text: "Keps/Solhatt" },
  {
    emoji: "🛏️",
    text: "Luftmadrass (enkel, ej dubbel pga platsbrist) och pump (eller liknande)",
  },
  { emoji: "🛌", text: "Täcke, kudde, sängkläder" },
  { emoji: "😴", text: "Sovkläder" },
  { emoji: "🩴", text: "Tofflor (för att använda mellan matcher)" },
  { emoji: "👟", text: "Gymnastikskor (för promenad och lek utomhus)" },
  { emoji: "📱", text: "Mobil om man har" },
  { emoji: "🎧", text: "Hörlurar om man har" },
  { emoji: "🔌", text: "Laddare till mobilen" },
  { emoji: "🔋", text: "Powerbank" },
  { emoji: "👚", text: "Ombyte för kvällar/dagtid utanför match" },
  { emoji: "🕺", text: "Discokläder" },
  { emoji: "🌧️", text: "Regnkläder" },
  {
    emoji: "🍬",
    text: "Snacks/Godis/Dryck till lördag kväll (absolut förbjudet med någon form av nötter!)",
  },
  { emoji: "💳", text: "Fickpeng 150 kr (kort/swish – cupen är kontantfri)" },
];

const STORAGE_KEY = "habocupen-packlista";
const CONFETTI_COLORS = [
  "var(--sun)",
  "var(--grass)",
  "var(--mint)",
  "var(--paper)",
  "var(--ochre)",
  "var(--falu)",
];

/* Liten localStorage-store så att avbockningen är hydration-säker
   (servern renderar oavbockat, klienten läser sparat läge) */
let listeners: (() => void)[] = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function toggleItem(index: number) {
  const checked = new Set<number>(JSON.parse(getSnapshot()));
  if (checked.has(index)) {
    checked.delete(index);
  } else {
    checked.add(index);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]));
  } catch {
    // localStorage kan vara avstängt (privat läge) — listan funkar ändå
  }
  listeners.forEach((l) => l());
}

export type ConfettiPiece = {
  left: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  color: string;
};

/* Slumpas fram i en händelsehanterare (aldrig under rendering).
   Delas med trupp-revealen. */
export function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 120 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.8,
    duration: 2.4 + Math.random() * 2,
    width: 6 + Math.random() * 5,
    height: 10 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));
}

/* Fullskärms konfettiregn */
export function Confetti({ pieces }: { pieces: ConfettiPiece[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: piece.width,
            height: piece.height,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* Packstatus för dashboard-widgeten: [antal ibockade, totalt] */
export function usePackingProgress(): [number, number] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const count = useMemo(
    () => new Set<number>(JSON.parse(raw)).size,
    [raw]
  );
  return [count, ITEMS.length];
}

export default function PackingList() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const checked = useMemo(() => new Set<number>(JSON.parse(raw)), [raw]);
  const allDone = checked.size === ITEMS.length;
  const [confetti, setConfetti] = useState<ConfettiPiece[] | null>(null);

  function handleToggle(index: number, wasDone: boolean) {
    toggleItem(index);
    // Konfetti när sista saken bockas i
    if (!wasDone && checked.size + 1 === ITEMS.length) {
      setConfetti(makeConfetti());
      window.setTimeout(() => setConfetti(null), 5500);
    }
  }

  return (
    <>
      {confetti && <Confetti pieces={confetti} />}

      <div className="rounded-xl bg-white p-4 shadow-card">
        {/* Packstatus */}
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold">
            {checked.size} av {ITEMS.length} packat
          </p>
          {checked.size > 0 && !allDone && (
            <p className="text-xs font-semibold text-ink/50">Kör på!</p>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper">
          <div
            className="h-full rounded-full bg-grass transition-[width] duration-500"
            style={{ width: `${(checked.size / ITEMS.length) * 100}%` }}
          />
        </div>

        {allDone && (
          <p className="mt-3 rounded-lg bg-sun px-3 py-2 text-center text-sm font-bold">
            ✅ Allt är klart – grymt jobbat!
          </p>
        )}

        <ul className="mt-3 divide-y divide-ink/10">
          {ITEMS.map((item, index) => {
            const done = checked.has(index);
            return (
              <li key={item.text}>
                <button
                  type="button"
                  onClick={() => handleToggle(index, done)}
                  aria-pressed={done}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                      done
                        ? "border-grass bg-grass text-paper"
                        : "border-ink/30 bg-paper"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span aria-hidden className="shrink-0">
                    {item.emoji}
                  </span>
                  <span
                    className={`text-sm ${
                      done ? "text-ink/40 line-through" : "font-semibold"
                    }`}
                  >
                    {item.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-2 text-center text-xs font-semibold text-paper/50">
        Avbockningen sparas bara på den här enheten.
      </p>
    </>
  );
}
