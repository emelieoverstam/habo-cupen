"use client";

// Startsidan som dashboard: nedräkning, nästa händelser, resultat,
// tabelläge, packstatus och snabblänkar. Uppdateras live.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useScheduleLive } from "@/lib/use-schedule-live";
import { useCurrentMinute } from "@/lib/time";
import Countdown from "@/components/Countdown";
import { usePackingProgress } from "@/components/PackingList";
import { EVENT_META } from "@/lib/event-meta";
import SiteHeader from "@/components/SiteHeader";
import NoticeBanner from "@/components/NoticeBanner";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type CupEvent = Tables<"events">;
type Match = Tables<"matches">;
type Player = Tables<"players">;
type Notice = Tables<"notices">;

type Props = {
  initialTeams: Team[];
  initialEvents: CupEvent[];
  initialMatches: Match[];
  initialPlayers: Player[];
  initialNotices: Notice[];
};

const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

const dayFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  timeZone: "Europe/Stockholm",
});

export default function Dashboard({
  initialTeams,
  initialEvents,
  initialMatches,
  initialPlayers,
  initialNotices,
}: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [matches, setMatches] = useState(initialMatches);
  const [players, setPlayers] = useState(initialPlayers);
  const [teams] = useState(initialTeams);
  const [notices, setNotices] = useState(initialNotices);
  const now = useCurrentMinute();
  const [packed, packTotal] = usePackingProgress();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [eventsRes, matchesRes, playersRes, noticesRes] =
      await Promise.all([
        supabase.from("events").select("*"),
        supabase.from("matches").select("*"),
        supabase
          .from("players")
          .select("*")
          .order("number", { nullsFirst: false }),
        supabase
          .from("notices")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);
    if (playersRes.data) setPlayers(playersRes.data);
    if (noticesRes.data) setNotices(noticesRes.data);
  }, []);

  useScheduleLive(refresh);

  /* Alla kommande punkter i tidsordning */
  const upcoming = useMemo(() => {
    if (!now) return [];
    const all: {
      time: string;
      label: string;
      emoji: string;
      meta: string;
    }[] = [];
    for (const e of events) {
      if (e.starts_at && e.status !== "cancelled") {
        all.push({
          time: e.starts_at,
          label: e.title,
          emoji: EVENT_META[e.type].emoji,
          meta: e.location ?? EVENT_META[e.type].label,
        });
      }
    }
    for (const m of matches) {
      if (m.starts_at && m.home_score === null) {
        all.push({
          time: m.starts_at,
          label: `${m.home_team} – ${m.away_team}`,
          emoji: "⚽",
          meta: m.pitch ? `${m.group_name} · Plan ${m.pitch}` : m.group_name,
        });
      }
    }
    all.sort((a, b) => (a.time < b.time ? -1 : 1));
    return all.filter((u) => new Date(u.time) > now);
  }, [events, matches, now]);

  const next = upcoming[0] ?? null;

  const photoPlayers = players.filter((p) => p.photo_url !== null).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="hem" />

      <NoticeBanner notices={notices} teams={teams} />

      <div className="space-y-4">
        {/* Hjältekort: nästa händelse med stor nedräkning */}
        {next && now && (
          <Link
            href="/schema"
            className="rise block rounded-xl bg-white p-5 text-center shadow-card"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Härnäst
            </p>
            <p className="mt-1 text-lg font-bold leading-snug">
              {next.emoji} {next.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink/60">
              {dayFormat.format(new Date(next.time))}{" "}
              {timeFormat.format(new Date(next.time))} · {next.meta}
            </p>
            <p className="mt-3 inline-block rounded-lg bg-sun px-4 py-1.5 font-[family-name:var(--font-display)] font-bold text-lg shadow-chip tabular-nums">
              <Countdown target={next.time} />
            </p>
          </Link>
        )}

        {/* Kommande punkter */}
        {upcoming.length > 1 && (
          <Link
            href="/schema"
            className="rise block rounded-xl bg-white p-4 shadow-card"
            style={{ animationDelay: "60ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Sen då?
            </p>
            <ul className="space-y-1.5">
              {upcoming.slice(1, 4).map((item) => (
                <li
                  key={item.time + item.label}
                  className="flex items-baseline gap-2 text-sm"
                >
                  <span className="w-12 shrink-0 font-[family-name:var(--font-display)] font-bold">
                    {timeFormat.format(new Date(item.time))}
                  </span>
                  <span aria-hidden className="shrink-0">
                    {item.emoji}
                  </span>
                  <span className="truncate font-semibold">{item.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-ink/50">
                    {dayFormat.format(new Date(item.time)).slice(0, 3)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-xs font-bold text-grass">
              Hela schemat →
            </p>
          </Link>
        )}

        {/* Resultat & tabeller (live på Cupmate) */}
        <Link
          href="/tabeller"
          className="rise block rounded-xl bg-white p-4 shadow-card"
          style={{ animationDelay: "90ms" }}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
            Resultat &amp; tabeller
          </p>
          <div className="flex items-center gap-3">
            <p className="text-2xl" aria-hidden>
              📊
            </p>
            <p className="text-sm font-semibold text-ink/70">
              Se ställningen i era grupper – live på Cupmate →
            </p>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-4">
          {/* Packstatus */}
          <Link
            href="/packlista"
            className="rise rounded-xl bg-white p-4 shadow-card"
            style={{ animationDelay: "150ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Packlistan
            </p>
            <p className="font-[family-name:var(--font-display)] font-bold text-2xl">
              {packed}
              <span className="text-base text-ink/50">/{packTotal}</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-grass transition-[width] duration-500"
                style={{ width: `${(packed / packTotal) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-ink/60">
              {packed === packTotal ? "Allt packat! 🎉" : "packat hittills"}
            </p>
          </Link>

          {/* Trupperna */}
          <Link
            href="/trupperna"
            className="rise rounded-xl bg-white p-4 shadow-card"
            style={{ animationDelay: "180ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Trupperna
            </p>
            {photoPlayers.length > 0 ? (
              <div className="flex -space-x-3">
                {photoPlayers.map((p) => (
                  <Image
                    key={p.id}
                    src={p.photo_url!}
                    alt={p.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full border-2 border-white object-cover"
                  />
                ))}
              </div>
            ) : (
              <p className="text-2xl" aria-hidden>
                ⚽
              </p>
            )}
            <p className="mt-2 text-xs font-semibold text-ink/60">
              {players.length} spelare · se korten →
            </p>
          </Link>

          {/* Matchgenomgångar */}
          <Link
            href="/genomgang"
            className="rise rounded-xl bg-white p-4 shadow-card"
            style={{ animationDelay: "210ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Matchgenomgångar
            </p>
            <p className="text-2xl" aria-hidden>
              📋
            </p>
            <p className="mt-2 text-xs font-semibold text-ink/60">
              Uppställning &amp; taktik →
            </p>
          </Link>

          {/* Poängjakt */}
          <Link
            href="/poangjakt"
            className="rise rounded-xl bg-white p-4 shadow-card"
            style={{ animationDelay: "240ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Poängjakt
            </p>
            <p className="text-2xl" aria-hidden>
              🎯
            </p>
            <p className="mt-2 text-xs font-semibold text-ink/60">
              Lördag kväll →
            </p>
          </Link>

          {/* Musik */}
          <Link
            href="/musik"
            className="rise rounded-xl bg-white p-4 shadow-card"
            style={{ animationDelay: "270ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Musik
            </p>
            <p className="text-2xl" aria-hidden>
              🎵
            </p>
            <p className="mt-2 text-xs font-semibold text-ink/60">
              Lagets spellista →
            </p>
          </Link>

          {/* Tjugan – bred rad längst ner */}
          <Link
            href="/tjugan"
            className="rise col-span-2 rounded-xl bg-pine p-4 shadow-card"
            style={{ animationDelay: "300ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-paper/60">
              Hemliga leken
            </p>
            <div className="flex items-center gap-3">
              <p className="text-3xl" aria-hidden>
                🪙
              </p>
              <div>
                <p className="font-[family-name:var(--font-display)] font-bold text-sm uppercase text-sun">
                  Tjugan
                </p>
                <p className="mt-0.5 text-xs font-semibold text-paper/70">
                  Vem har den? Läs reglerna →
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <footer className="mt-10 text-center text-sm font-semibold text-paper/50">
        <Link href="/admin" className="hover:text-paper">
          Ledarinloggning
        </Link>
      </footer>
    </main>
  );
}
