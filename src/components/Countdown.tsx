"use client";

// Live-nedräkning som tickar varje sekund (dagar/timmar/minuter/sekunder).
// Egen sekundklocka så att bara den här lilla biten renderas om varje sekund.

import { useCurrentSecond, formatCountdownClock } from "@/lib/time";

export default function Countdown({ target }: { target: string }) {
  const now = useCurrentSecond();
  if (!now) return null;
  return <>{formatCountdownClock(new Date(target).getTime() - now.getTime())}</>;
}
