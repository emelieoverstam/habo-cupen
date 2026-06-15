"use client";

// Spärr runt en matchgenomgång: visar en PIN-ruta tills rätt kod angetts.
// När man låst upp en gång gäller det alla genomgångar resten av sessionen.

import { useState } from "react";
import {
  pinEnabled,
  unlockBriefings,
  useBriefingsUnlocked,
  verifyPin,
} from "@/lib/briefing-lock";

export default function BriefingGate({ children }: { children: React.ReactNode }) {
  const unlocked = useBriefingsUnlocked();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  // Ingen PIN konfigurerad eller redan upplåst → visa innehållet
  if (!pinEnabled() || unlocked) return <>{children}</>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (verifyPin(pin)) {
      unlockBriefings();
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <div className="rounded-xl bg-paper px-4 py-5 text-center">
      <p className="mb-1 text-2xl" aria-hidden>
        🔒
      </p>
      <p className="mb-3 text-sm font-semibold text-ink/80">
        Matchgenomgångarna är låsta. Ange PIN-koden för att visa dem.
      </p>
      <form onSubmit={handleSubmit} className="flex items-center justify-center gap-2">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
            setError(false);
          }}
          placeholder="••••"
          aria-label="PIN-kod"
          className="w-24 rounded-lg border border-ink/25 bg-white px-3 py-2 text-center text-lg tracking-[0.4em]"
        />
        <button
          type="submit"
          disabled={pin.length < 4}
          className="rounded-xl bg-grass px-4 py-2 font-[family-name:var(--font-display)] font-bold text-sm uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
        >
          Visa
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm font-bold text-falu">Fel kod, försök igen.</p>
      )}
    </div>
  );
}
