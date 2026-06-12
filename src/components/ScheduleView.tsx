"use client";

// Schemavyn: dagflikar, lagfilter och tidslinje med hålltider och
// cupmatcher. Initial data kommer från servern; uppdateringar kommer
// live via Supabase Realtime (broadcast från databasen).

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EVENT_META } from "@/lib/event-meta";
import { useScheduleLive } from "@/lib/use-schedule-live";
import { useCurrentMinute, formatCountdown } from "@/lib/time";
import SiteHeader from "@/components/SiteHeader";
import TeamMarker from "@/components/TeamMarker";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type CupEvent = Tables<"events">;
type Match = Tables<"matches">;

type TimelineItem =
  | { kind: "event"; time: string | null; event: CupEvent }
  | { kind: "match"; time: string | null; match: Match };

type Props = {
  initialTeams: Team[];
  initialEvents: CupEvent[];
  initialMatches: Match[];
  today: string;
};

// Cupens dagar visas alltid som flikar, även innan något är inlagt
// (avresedag fredag + matchdagarna lördag och söndag)
const CUP_DAYS = ["2026-06-26", "2026-06-27", "2026-06-28"];

const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

const tabFormat = new Intl.DateTimeFormat("sv-SE", { weekday: "short" });

const headingFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/* Tolka en dag (ÅÅÅÅ-MM-DD) mitt på dagen så att veckodagen blir rätt oavsett tidszon */
function dayToDate(day: string) {
  return new Date(`${day}T12:00:00`);
}

function sortItems(a: TimelineItem, b: TimelineItem) {
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (!!a.time !== !!b.time) return a.time ? -1 : 1;
  const hintA = a.kind === "event" ? (a.event.sort_hint ?? 0) : 0;
  const hintB = b.kind === "event" ? (b.event.sort_hint ?? 0) : 0;
  return hintA - hintB;
}

function itemKey(item: TimelineItem) {
  return item.kind === "event" ? item.event.id : item.match.id;
}

export default function ScheduleView({
  initialTeams,
  initialEvents,
  initialMatches,
  today,
}: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [matches, setMatches] = useState(initialMatches);
  const [teams] = useState(initialTeams);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  // null under SSR/hydration, därefter aktuell tid som tickar varje minut
  const now = useCurrentMinute();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [eventsRes, matchesRes] = await Promise.all([
      supabase.from("events").select("*"),
      supabase.from("matches").select("*"),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);
  }, []);

  useScheduleLive(refresh);

  const days = useMemo(() => {
    const all = [
      ...CUP_DAYS,
      ...events.map((e) => e.day),
      ...matches.map((m) => m.day),
    ].filter((d): d is string => d !== null);
    return [...new Set(all)].sort();
  }, [events, matches]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const activeDay =
    selectedDay && days.includes(selectedDay)
      ? selectedDay
      : days.includes(today)
        ? today
        : days[0];

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  /* Vilket av våra lag spelar i en match? Lagnamnen matchar Cupmates exakt. */
  const matchTeam = useCallback(
    (match: Match) =>
      teams.find(
        (t) => t.name === match.home_team || t.name === match.away_team
      ),
    [teams]
  );

  const dayItems = useMemo(() => {
    const eventItems: TimelineItem[] = events
      .filter((e) => e.day === activeDay)
      .filter(
        (e) => !teamFilter || e.team_id === null || e.team_id === teamFilter
      )
      .map((e) => ({ kind: "event", time: e.starts_at, event: e }));

    const matchItems: TimelineItem[] = matches
      .filter((m) => m.day === activeDay)
      .filter((m) => {
        if (!teamFilter) return true;
        const team = teamById.get(teamFilter);
        return (
          !!team &&
          (m.home_team === team.name || m.away_team === team.name)
        );
      })
      .map((m) => ({ kind: "match", time: m.starts_at, match: m }));

    return [...eventItems, ...matchItems].sort(sortItems);
  }, [events, matches, activeDay, teamFilter, teamById]);

  // Nästa kommande punkt i dag — markeras med "Härnäst"
  const nextItemKey = useMemo(() => {
    if (!now || activeDay !== today) return null;
    const next = dayItems.find((item) => {
      if (item.kind === "event" && item.event.status === "cancelled")
        return false;
      return !!item.time && new Date(item.time) > now;
    });
    return next ? itemKey(next) : null;
  }, [dayItems, now, activeDay, today]);

  // Nästa händelse över alla dagar — för nedräkningen under rubriken
  const nextUpcoming = useMemo(() => {
    if (!now) return null;
    const upcoming: { time: string; day: string; label: string }[] = [];
    for (const e of events) {
      if (e.starts_at && e.status !== "cancelled") {
        upcoming.push({ time: e.starts_at, day: e.day, label: e.title });
      }
    }
    for (const m of matches) {
      if (m.starts_at && m.day) {
        upcoming.push({
          time: m.starts_at,
          day: m.day,
          label: `${m.home_team} – ${m.away_team}`,
        });
      }
    }
    upcoming.sort((a, b) => (a.time < b.time ? -1 : 1));
    return upcoming.find((u) => new Date(u.time) > now) ?? null;
  }, [events, matches, now]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="schema" />

      {/* Nedräkning till nästa händelse — tryck för att hoppa till dagen */}
      {nextUpcoming && now && (
        <div className="-mt-1 mb-4 text-center">
          <button
            type="button"
            onClick={() => setSelectedDay(nextUpcoming.day)}
            className="inline-flex max-w-full items-baseline gap-2 rounded-full border border-paper/30 bg-paper/10 px-4 py-2 text-sm font-semibold text-paper transition-transform active:scale-95"
          >
            <span className="truncate">{nextUpcoming.label}</span>
            <span className="shrink-0 font-[family-name:var(--font-display)] font-bold text-sun">
              {formatCountdown(
                new Date(nextUpcoming.time).getTime() - now.getTime()
              )}
            </span>
          </button>
        </div>
      )}

      {/* Dagflikar */}
      <nav
        aria-label="Välj dag"
        className="sticky top-0 z-10 -mx-4 mb-5 border-b border-paper/15 bg-pine px-4 py-3"
      >
        <div className="flex gap-2">
          {days.map((day) => {
            const active = day === activeDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-pressed={active}
                className={`flex-1 rounded-xl border px-3 py-2 font-[family-name:var(--font-display)] font-bold text-base uppercase transition-transform active:scale-95 ${
                  active
                    ? "border-transparent bg-sun text-ink shadow-chip"
                    : "border-paper/30 bg-paper/10 text-paper hover:bg-paper/20"
                }`}
              >
                {tabFormat.format(dayToDate(day))}
                <span className="ml-1.5 text-sm opacity-70">
                  {dayToDate(day).getDate()}/{dayToDate(day).getMonth() + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Lagfilter visas bara om det finns lag */}
        {teams.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip
              label="Båda lagen"
              active={teamFilter === null}
              onClick={() => setTeamFilter(null)}
            />
            {teams.map((team) => (
              <FilterChip
                key={team.id}
                label={team.name}
                color={team.color}
                active={teamFilter === team.id}
                onClick={() => setTeamFilter(team.id)}
              />
            ))}
          </div>
        )}
      </nav>

      <h2 className="mb-4 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-xl uppercase text-paper">
        {headingFormat.format(dayToDate(activeDay))}
      </h2>

      {dayItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-paper/30 px-4 py-8 text-center font-semibold text-paper/70">
          Inget inplanerat den här dagen ännu.
        </p>
      ) : (
        <ol className="space-y-3">
          {dayItems.map((item, index) =>
            item.kind === "event" ? (
              <EventCard
                key={item.event.id}
                event={item.event}
                team={
                  item.event.team_id
                    ? teamById.get(item.event.team_id)
                    : undefined
                }
                isNext={itemKey(item) === nextItemKey}
                delayMs={index * 40}
              />
            ) : (
              <MatchCard
                key={item.match.id}
                match={item.match}
                team={matchTeam(item.match)}
                isNext={itemKey(item) === nextItemKey}
                delayMs={index * 40}
              />
            )
          )}
        </ol>
      )}
    </main>
  );
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold transition-transform active:scale-95 ${
        active
          ? "border-transparent bg-sun text-ink shadow-chip"
          : "border-paper/30 bg-paper/10 text-paper hover:bg-paper/20"
      }`}
    >
      {color && (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border border-ink/40"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {label}
    </button>
  );
}

function NextBadge() {
  return (
    <span className="rounded-full bg-grass px-2 py-0.5 text-xs font-bold uppercase">
      Härnäst
    </span>
  );
}

function EventCard({
  event,
  team,
  isNext,
  delayMs,
}: {
  event: CupEvent;
  team?: Team;
  isNext: boolean;
  delayMs: number;
}) {
  const meta = EVENT_META[event.type];
  const cancelled = event.status === "cancelled";

  return (
    <li
      className={`rise relative overflow-hidden rounded-xl bg-white shadow-card ${
        cancelled ? "opacity-60" : ""
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* Färgkant som visar eventtypen */}
      <div
        className="absolute inset-y-0 left-0 w-2"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      <div className="flex items-start gap-3 py-3 pl-5 pr-4">
        <div className="w-14 shrink-0 text-center">
          <p className="font-[family-name:var(--font-display)] font-bold text-lg leading-tight">
            {event.starts_at
              ? timeFormat.format(new Date(event.starts_at))
              : "–"}
          </p>
          <p className="text-lg" aria-hidden>
            {meta.emoji}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className={`text-base font-bold leading-snug ${
                cancelled ? "line-through" : ""
              }`}
            >
              {event.title}
            </h3>
            {isNext && <NextBadge />}
            {event.status === "tbd" && (
              <span className="rounded-full bg-petrol px-2 py-0.5 text-xs font-bold uppercase text-paper">
                Prel. tid
              </span>
            )}
            {cancelled && (
              <span className="rounded-full bg-falu px-2 py-0.5 text-xs font-bold uppercase text-paper">
                Inställd
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm text-ink/70">
            {meta.label}
            {event.location && <> · {event.location}</>}
            {" · "}
            <TeamMarker team={team} />
          </p>

          {event.note && (
            <p className="mt-1.5 rounded-lg bg-paper px-2.5 py-1.5 text-sm">
              {event.note}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function MatchCard({
  match,
  team,
  isNext,
  delayMs,
}: {
  match: Match;
  team?: Team;
  isNext: boolean;
  delayMs: number;
}) {
  const meta = EVENT_META.match;
  const played = match.home_score !== null && match.away_score !== null;

  return (
    <li
      className="rise relative overflow-hidden rounded-xl bg-white shadow-card"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div
        className="absolute inset-y-0 left-0 w-2"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      <div className="flex items-start gap-3 py-3 pl-5 pr-4">
        <div className="w-14 shrink-0 text-center">
          <p className="font-[family-name:var(--font-display)] font-bold text-lg leading-tight">
            {match.starts_at
              ? timeFormat.format(new Date(match.starts_at))
              : "–"}
          </p>
          <p className="text-lg" aria-hidden>
            {meta.emoji}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-bold leading-snug">
              {match.home_team} – {match.away_team}
            </h3>
            {isNext && <NextBadge />}
          </div>

          <p className="mt-0.5 text-sm text-ink/70">
            {match.group_name}
            {match.pitch && <> · Plan {match.pitch}</>}
            {" · "}
            <TeamMarker team={team} />
          </p>
        </div>

        {played && (
          <div className="shrink-0 self-center rounded-lg bg-sun px-2.5 py-1 font-[family-name:var(--font-display)] font-bold text-lg shadow-chip">
            {match.home_score}–{match.away_score}
          </div>
        )}
      </div>
    </li>
  );
}
