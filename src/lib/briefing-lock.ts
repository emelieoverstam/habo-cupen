// Enkel klient-spärr för matchgenomgångarna: döljer dem tills rätt PIN angetts.
// OBS: detta är en mjuk spärr i gränssnittet — datan finns tekniskt i
// webbläsaren (matchgenomgångar är publikt läsbara). Den hindrar nyfikna, inte
// någon som verkligen gräver. PIN:en är hårdkodad här (ändras i koden) och
// låset minns per flik (sessionStorage).

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "f13:briefings-unlocked";
const PIN = "1932";

// Spärren är bara aktiv om en PIN är konfigurerad
export function pinEnabled(): boolean {
  return PIN.length > 0;
}

export function verifyPin(pin: string): boolean {
  return pinEnabled() && pin === PIN;
}

// Enkel prenumeration så att alla öppna spärrar reagerar när man låser upp
const listeners = new Set<() => void>();

function readUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockBriefings(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // sessionStorage kan vara blockerad — låset gäller då bara i minnet
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Hydration-säker läsning: servern (och första klientrenderingen) ser låst läge
export function useBriefingsUnlocked(): boolean {
  return useSyncExternalStore(subscribe, readUnlocked, () => false);
}
