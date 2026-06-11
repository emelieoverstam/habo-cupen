"use client";

// Publik schemavy: dagflikar, lagfilter och eventlista som uppdateras live
// via Supabase Realtime. Initial data kommer från servern.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { EVENT_META } from "@/lib/event-meta";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type CupEvent = Tables<"events">;

type Props = {
  initialTeams: Team[];
  initialEvents: CupEvent[];
  today: string;
};

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

const rangeFormat = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
});

/* Datumintervall för rubriken, t.ex. "12–14 juni" eller "30 maj – 1 juni" */
function dateRangeLabel(days: string[]) {
  if (days.length === 0) return null;
  const first = dayToDate(days[0]);
  const last = dayToDate(days[days.length - 1]);
  if (days.length === 1) return rangeFormat.format(first);
  return first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${rangeFormat.format(last)}`
    : `${rangeFormat.format(first)} – ${rangeFormat.format(last)}`;
}

/* Tolka en dag (ÅÅÅÅ-MM-DD) mitt på dagen så att veckodagen blir rätt oavsett tidszon */
function dayToDate(day: string) {
  return new Date(`${day}T12:00:00`);
}

/* Minutklocka som är hydration-säker: servern renderar null, klienten tickar varje minut */
function subscribeMinute(callback: () => void) {
  const timer = setInterval(callback, 60_000);
  return () => clearInterval(timer);
}

function useCurrentMinute() {
  const minuteStamp = useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60_000),
    () => null
  );
  return minuteStamp === null ? null : new Date(minuteStamp * 60_000);
}

function sortEvents(a: CupEvent, b: CupEvent) {
  if (a.starts_at && b.starts_at && a.starts_at !== b.starts_at) {
    return a.starts_at < b.starts_at ? -1 : 1;
  }
  if (!!a.starts_at !== !!b.starts_at) return a.starts_at ? -1 : 1;
  return (a.sort_hint ?? 0) - (b.sort_hint ?? 0);
}

export default function ScheduleView({
  initialTeams,
  initialEvents,
  today,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState(initialEvents);
  const [teams] = useState(initialTeams);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  // null under SSR/hydration, därefter aktuell tid som tickar varje minut
  const now = useCurrentMinute();

  const days = useMemo(
    () => [...new Set(events.map((e) => e.day))].sort(),
    [events]
  );

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const activeDay =
    selectedDay && days.includes(selectedDay)
      ? selectedDay
      : days.includes(today)
        ? today
        : days[0];

  // Prenumerera på ändringar i events och hämta om listan vid varje ändring
  const refreshEvents = useCallback(async () => {
    const { data } = await supabase.from("events").select("*");
    if (data) setEvents(data);
  }, [supabase]);

  useEffect(() => {
    // Databasen sänder ändringar till topicen "schedule" via en trigger
    // (realtime.broadcast_changes). Kanalen är privat, så klienten måste
    // först autentisera sig mot Realtime — anon räcker enligt RLS-policyn.
    const channel = supabase.channel("schedule", {
      config: { private: true },
    });

    supabase.realtime.setAuth().then(() => {
      channel
        .on("broadcast", { event: "*" }, () => {
          refreshEvents();
        })
        .subscribe();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refreshEvents]);

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const dayEvents = useMemo(() => {
    return events
      .filter((e) => e.day === activeDay)
      .filter(
        (e) => !teamFilter || e.team_id === null || e.team_id === teamFilter
      )
      .sort(sortEvents);
  }, [events, activeDay, teamFilter]);

  // Nästa kommande event i dag — markeras med "Härnäst"
  const nextEventId = useMemo(() => {
    if (!now || activeDay !== today) return null;
    return (
      dayEvents.find(
        (e) =>
          e.status !== "cancelled" &&
          e.starts_at &&
          new Date(e.starts_at) > now
      )?.id ?? null
    );
  }, [dayEvents, now, activeDay, today]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      {/* Affischrubrik */}
      <header className="pt-8 pb-6 text-center">
        {days.length > 0 && (
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.3em]">
            {dateRangeLabel(days)}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-display)] text-5xl uppercase leading-none sm:text-6xl">
          Habo-cupen
          <span className="ml-3 inline-block -rotate-6 rounded-lg border-2 border-ink bg-sun px-2 py-1 align-middle text-2xl shadow-hard-sm sm:text-3xl">
            2026
          </span>
        </h1>
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
          <span
            className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-grass"
            aria-hidden
          />
          Schemat uppdateras live
        </p>
      </header>

      {days.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Dagflikar */}
          <nav
            aria-label="Välj dag"
            className="sticky top-0 z-10 -mx-4 mb-5 border-y-2 border-ink bg-paper px-4 py-3"
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
                    className={`flex-1 rounded-xl border-2 border-ink px-3 py-2 font-[family-name:var(--font-display)] text-lg uppercase transition-transform active:scale-95 ${
                      active
                        ? "bg-ink text-sun shadow-hard-sm"
                        : "bg-paper hover:bg-sun/40"
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

          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl uppercase">
            {headingFormat.format(dayToDate(activeDay))}
          </h2>

          {dayEvents.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-ink/40 px-4 py-8 text-center font-semibold text-ink/60">
              Inget inplanerat den här dagen ännu.
            </p>
          ) : (
            <ol className="space-y-3">
              {dayEvents.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  team={event.team_id ? teamById.get(event.team_id) : undefined}
                  isNext={event.id === nextEventId}
                  delayMs={index * 40}
                />
              ))}
            </ol>
          )}
        </>
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
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold transition-transform active:scale-95 ${
        active ? "bg-ink text-paper shadow-hard-sm" : "bg-paper hover:bg-sun/40"
      }`}
    >
      {color && (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border border-ink"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {label}
    </button>
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
      className={`rise relative overflow-hidden rounded-xl border-2 border-ink bg-white shadow-hard ${
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
          <p className="font-[family-name:var(--font-display)] text-xl leading-tight">
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
            {isNext && (
              <span className="rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-xs font-bold uppercase">
                Härnäst
              </span>
            )}
            {event.status === "tbd" && (
              <span className="rounded-full border-2 border-ink bg-sky px-2 py-0.5 text-xs font-bold uppercase">
                Prel. tid
              </span>
            )}
            {cancelled && (
              <span className="rounded-full border-2 border-ink bg-coral px-2 py-0.5 text-xs font-bold uppercase">
                Inställd
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm text-ink/70">
            {meta.label}
            {event.location && <> · {event.location}</>}
            {" · "}
            {team ? (
              <span className="inline-flex items-center gap-1 font-semibold">
                <span
                  className="inline-block h-2 w-2 rounded-full border border-ink"
                  style={{ backgroundColor: team.color }}
                  aria-hidden
                />
                {team.name}
              </span>
            ) : (
              <span className="font-semibold">Båda lagen</span>
            )}
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

function EmptyState() {
  return (
    <div className="rise mt-8 rounded-xl border-2 border-ink bg-white px-6 py-12 text-center shadow-hard">
      <p className="text-5xl" aria-hidden>
        ⚽
      </p>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl uppercase">
        Schemat är inte publicerat ännu
      </h2>
      <p className="mt-2 font-semibold text-ink/70">
        Titta tillbaka snart — sidan uppdateras automatiskt så fort något
        läggs in.
      </p>
    </div>
  );
}
