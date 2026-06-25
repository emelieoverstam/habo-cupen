"use client";

// Diskret notis-banner högst upp på startsidan. Hopfälld visar senaste
// notisen; utfälld visar de senaste fem. Olästa märks med en räknare —
// vilka som setts sparas per enhet i localStorage (samma teknik som
// packlistans avbockning, hydration-säkert via useSyncExternalStore).

import { useMemo, useState, useSyncExternalStore } from "react";
import TeamMarker from "@/components/TeamMarker";
import { useCurrentMinute } from "@/lib/time";
import type { Tables } from "@/types/database";

type Notice = Tables<"notices">;
type Team = Tables<"teams">;

const STORAGE_KEY = "habocupen-notiser-sedda";
const MAX_SHOWN = 5;

/* Liten localStorage-store för sedda notis-id. Servern ser inga sedda
   (getServerSnapshot = "[]"), klienten läser sparat läge efter hydrering. */
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

function markSeen(ids: string[]) {
  const seen = new Set<string>(JSON.parse(getSnapshot()));
  let changed = false;
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // localStorage kan vara avstängt (privat läge) — bannern funkar ändå
  }
  listeners.forEach((l) => l());
}

const absoluteFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});
const relativeFormat = new Intl.RelativeTimeFormat("sv-SE", { numeric: "auto" });

/* Relativ tid när vi vet "nu" (efter hydrering), annars absolut tid. */
function formatTime(iso: string, nowMs: number | null): string {
  if (nowMs === null) return absoluteFormat.format(new Date(iso));
  const min = Math.round((nowMs - new Date(iso).getTime()) / 60000);
  if (min < 1) return "nyss";
  if (min < 60) return relativeFormat.format(-min, "minute");
  const hours = Math.round(min / 60);
  if (hours < 24) return relativeFormat.format(-hours, "hour");
  return absoluteFormat.format(new Date(iso));
}

export default function NoticeBanner({
  notices,
  teams,
}: {
  notices: Notice[];
  teams: Team[];
}) {
  const now = useCurrentMinute();
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const seen = useMemo(() => new Set<string>(JSON.parse(raw)), [raw]);
  const [open, setOpen] = useState(false);

  // Nyast först, kapad till de senaste
  const recent = useMemo(
    () =>
      [...notices]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, MAX_SHOWN),
    [notices]
  );

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  if (recent.length === 0) return null;

  const unseen = recent.filter((n) => !seen.has(n.id));
  const latest = recent[0];
  const nowMs = now?.getTime() ?? null;

  function toggle() {
    const next = !open;
    setOpen(next);
    // När man öppnar bannern räknas de visade notiserna som sedda
    if (next) markSeen(recent.map((n) => n.id));
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-left shadow-card transition-transform active:scale-[0.99]"
      >
        <span aria-hidden className="shrink-0 text-base">
          📣
        </span>
        {open ? (
          <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
            Notiser
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {latest.body}
          </span>
        )}
        {!open && unseen.length > 0 && (
          <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-falu px-1.5 text-[11px] font-bold text-paper">
            {unseen.length}
          </span>
        )}
        <span aria-hidden className="shrink-0 text-xs text-ink/40">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {recent.map((n) => (
            <li
              key={n.id}
              className="rounded-xl bg-white px-4 py-3 shadow-chip"
            >
              <p className="whitespace-pre-wrap text-sm font-semibold">
                {n.body}
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-xs text-ink/55">
                <TeamMarker
                  team={n.team_id ? teamById.get(n.team_id) : undefined}
                />
                <span aria-hidden>·</span>
                <span>{formatTime(n.created_at, nowMs)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
