"use client";

// Flytande chatt-bubbla som ligger i hörnet på alla sidor – men bara för
// inloggade ledare. Sköter inloggningskoll och hämtar den data chatten behöver
// (lazy, vid första öppning). Själva chatten ligger i LeaderChat; den hålls
// monterad när panelen stängs så att konversationen finns kvar.

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { parseBriefing, type Briefing } from "@/lib/briefing";
import type { Tables } from "@/types/database";
import LeaderChat from "@/components/LeaderChat";

type Team = Tables<"teams">;
type CupEvent = Tables<"events">;
type Match = Tables<"matches">;

type ChatData = {
  teams: Team[];
  events: CupEvent[];
  matches: Match[];
  briefings: Briefing[];
};

export default function LeaderChatWidget() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChatData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Följ inloggningsstatus – bubblan visas bara för inloggade ledare
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Hämta data första gången panelen öppnas
  useEffect(() => {
    if (!open || !user || data) return;
    let cancelled = false;
    (async () => {
      setLoadError(null);
      const [{ data: teams }, { data: events }, { data: matches }, { data: briefings }] =
        await Promise.all([
          supabase.from("teams").select("*").order("name"),
          supabase
            .from("events")
            .select("*")
            .order("day")
            .order("starts_at", { nullsFirst: false }),
          supabase.from("matches").select("*").order("starts_at"),
          supabase.from("match_briefings").select("*"),
        ]);
      if (cancelled) return;
      if (!teams || !events || !matches || !briefings) {
        setLoadError("Kunde inte hämta data. Försök igen.");
        return;
      }
      setData({
        teams,
        events,
        matches,
        briefings: briefings.map(parseBriefing),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, data, supabase]);

  // Inte inloggad → ingen bubbla alls (publika besökare ser inget)
  if (!user) return null;

  return (
    <>
      {/* Öppna-knapp */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Öppna assistenten"
          className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-grass text-2xl shadow-lg transition-transform active:scale-95"
        >
          💬
        </button>
      )}

      {/* Chattpanel – hålls monterad (dold) så konversationen finns kvar */}
      <div
        className={`fixed bottom-4 right-4 left-4 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:left-auto sm:w-[380px] ${
          open ? "" : "hidden"
        }`}
        style={{ height: "min(70vh, 560px)" }}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between bg-pine px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
            💬 Assistenten
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Stäng"
            className="rounded-full px-2 text-xl font-bold text-paper/80 transition-transform active:scale-90"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1">
          {loadError ? (
            <p className="p-4 text-sm font-semibold text-falu">{loadError}</p>
          ) : data ? (
            <LeaderChat
              supabase={supabase}
              teams={data.teams}
              initialEvents={data.events}
              matches={data.matches}
              initialBriefings={data.briefings}
            />
          ) : (
            <p className="p-4 text-sm font-semibold text-ink/50">Laddar…</p>
          )}
        </div>
      </div>
    </>
  );
}
