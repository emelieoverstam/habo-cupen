"use client";

// Delade tidshjälpare för nedräkning och "härnäst"-logik

import { useSyncExternalStore } from "react";

/* Minutklocka som är hydration-säker: servern renderar null, klienten tickar varje minut */
function subscribeMinute(callback: () => void) {
  const timer = setInterval(callback, 60_000);
  return () => clearInterval(timer);
}

export function useCurrentMinute() {
  const minuteStamp = useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60_000),
    () => null
  );
  return minuteStamp === null ? null : new Date(minuteStamp * 60_000);
}

/* "om 9 dagar", "om 1 dag 4 tim", "om 3 tim 12 min", "om 5 min" eller "nu".
   Långt bort (2+ dagar) visas bara dagar — timmarna är ändå brus och tar
   onödig plats i härnäst-rutan på mobil. */
export function formatCountdown(ms: number) {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return "nu";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 2) return `om ${days} dagar`;
  if (days === 1) return `om 1 dag ${hours} tim`;
  if (hours > 0) return `om ${hours} tim ${minutes} min`;
  return `om ${minutes} min`;
}
