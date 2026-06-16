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
import TeamMarker from "@/components/TeamMarker";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type CupEvent = Tables<"events">;
type Match = Tables<"matches">;
type Standing = Tables<"standings">;
type Player = Tables<"players">;

type Props = {
  initialTeams: Team[];
  initialEvents: CupEvent[];
  initialMatches: Match[];
  initialStandings: Standing[];
  initialPlayers: Player[];
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

/* Etiketter för placering: 1:a, 2:a, 3:e, 4:e */
function positionLabel(position: number) {
  return position <= 2 ? `${position}:a` : `${position}:e`;
}

export default function Dashboard({
  initialTeams,
  initialEvents,
  initialMatches,
  initialStandings,
  initialPlayers,
}: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [matches, setMatches] = useState(initialMatches);
  const [standings, setStandings] = useState(initialStandings);
  const [players, setPlayers] = useState(initialPlayers);
  const [teams] = useState(initialTeams);
  const now = useCurrentMinute();
  const [packed, packTotal] = usePackingProgress();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [eventsRes, matchesRes, standingsRes, playersRes] =
      await Promise.all([
        supabase.from("events").select("*"),
        supabase.from("matches").select("*"),
        supabase.from("standings").select("*").order("position"),
        supabase
          .from("players")
          .select("*")
          .order("number", { nullsFirst: false }),
      ]);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);
    if (standingsRes.data) setStandings(standingsRes.data);
    if (playersRes.data) setPlayers(playersRes.data);
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

  /* Spelade matcher, senast först */
  const results = useMemo(
    () =>
      matches
        .filter((m) => m.home_score !== null && m.away_score !== null)
        .sort((a, b) => ((a.starts_at ?? "") < (b.starts_at ?? "") ? 1 : -1))
        .slice(0, 3),
    [matches]
  );

  /* Våra placeringar ur tabellerna */
  const ourStandings = useMemo(
    () =>
      teams
        .map((team) => {
          const row = standings.find((s) => s.team_name === team.name);
          return row ? { team, row } : null;
        })
        .filter((x): x is { team: Team; row: Standing } => x !== null),
    [teams, standings]
  );

  const photoPlayers = players.filter((p) => p.photo_url !== null).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="hem" />

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

        {/* Senaste resultat */}
        {results.length > 0 && (
          <div
            className="rise rounded-xl bg-white p-4 shadow-card"
            style={{ animationDelay: "90ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Senaste resultat
            </p>
            <ul className="space-y-1.5">
              {results.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {m.home_team} – {m.away_team}
                  </span>
                  <span className="shrink-0 rounded-md bg-sun px-2 py-0.5 font-[family-name:var(--font-display)] font-bold shadow-chip">
                    {m.home_score}–{m.away_score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Tabelläge */}
          <Link
            href="/tabeller"
            className="rise rounded-xl bg-white p-4 shadow-card"
            style={{ animationDelay: "120ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Tabeller
            </p>
            {ourStandings.length === 0 ? (
              <p className="text-sm font-semibold text-ink/60">
                Kommer när gruppspelet startar.
              </p>
            ) : (
              <ul className="space-y-2">
                {ourStandings.map(({ team, row }) => (
                  <li key={team.id} className="text-sm">
                    <TeamMarker team={team} />
                    <p className="mt-0.5 text-xs font-semibold text-ink/60">
                      {positionLabel(row.position)} i {row.group_name} ·{" "}
                      {row.points} p
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Link>

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

          {/* Tjugan */}
          <Link
            href="/tjugan"
            className="rise rounded-xl bg-pine p-4 shadow-card"
            style={{ animationDelay: "210ms" }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-paper/60">
              Hemliga leken
            </p>
            <p className="text-2xl" aria-hidden>
              🪙
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] font-bold text-sm uppercase text-sun">
              Tjugan
            </p>
            <p className="mt-1 text-xs font-semibold text-paper/70">
              Vem har den? Läs reglerna →
            </p>
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
