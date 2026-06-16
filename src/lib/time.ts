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

/* Sekundklocka, hydration-säker — för nedräkningar som tickar varje sekund */
function subscribeSecond(callback: () => void) {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
}

export function useCurrentSecond() {
  const secondStamp = useSyncExternalStore(
    subscribeSecond,
    () => Math.floor(Date.now() / 1000),
    () => null
  );
  return secondStamp === null ? null : new Date(secondStamp * 1000);
}

/* Nedräkning i klockformat: "9d 04:12:30" långt bort, "04:12:30" inom dygnet
   och "12:30" sista timmen. "nu" när tiden gått ut. */
export function formatCountdownClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total === 0) return "nu";
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
