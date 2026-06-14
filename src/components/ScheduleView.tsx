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
import { type Briefing, parseBriefing, pickBriefing, briefingHasContent } from "@/lib/briefing";
import MatchBriefing from "@/components/MatchBriefing";

type Team = Tables<"teams">;
type CupEvent = Tables<"events">;
type Match = Tables<"matches">;
type Player = Tables<"players">;

type TimelineItem =
  | { kind: "event"; time: string | null; event: CupEvent }
  | { kind: "match"; time: string | null; match: Match };

type Props = {
  initialTeams: Team[];
  initialEvents: CupEvent[];
  initialMatches: Match[];
  initialPlayers: Player[];
  initialBriefings: Briefing[];
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

type Tip = { emoji: string; text: string };

type Upcoming = {
  time: string;
  day: string;
  label: string;
  emoji: string;
  dayLabel: string;
  isToday: boolean;
};

export default function ScheduleView({
  initialTeams,
  initialEvents,
  initialMatches,
  initialPlayers,
  initialBriefings,
  today,
}: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [matches, setMatches] = useState(initialMatches);
  const [teams] = useState(initialTeams);
  const [players, setPlayers] = useState(initialPlayers);
  const [briefings, setBriefings] = useState(initialBriefings);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  // null under SSR/hydration, därefter aktuell tid som tickar varje minut
  const now = useCurrentMinute();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [eventsRes, matchesRes, playersRes, briefingsRes] = await Promise.all([
      supabase.from("events").select("*"),
      supabase.from("matches").select("*"),
      supabase.from("players").select("*"),
      supabase.from("match_briefings").select("*"),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);
    if (playersRes.data) setPlayers(playersRes.data);
    if (briefingsRes.data) setBriefings(briefingsRes.data.map(parseBriefing));
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

  const isToday = activeDay === today;

  /* En punkt räknas som passerad när den börjat (matcher: när de spelats
     klart, ~45 min). Bara på innevarande dag tonas/fälls passerat ihop. */
  const { pastItems, restItems } = useMemo(() => {
    if (!now || !isToday) {
      return { pastItems: [] as TimelineItem[], restItems: dayItems };
    }
    const past: TimelineItem[] = [];
    const rest: TimelineItem[] = [];
    for (const item of dayItems) {
      const t = item.time ? new Date(item.time).getTime() : null;
      const dur = item.kind === "match" ? 45 * 60_000 : 0;
      if (t !== null && t + dur < now.getTime()) past.push(item);
      else rest.push(item);
    }
    return { pastItems: past, restItems: rest };
  }, [dayItems, now, isToday]);

  const [showEarlier, setShowEarlier] = useState(false);
  // Visa max två passerade punkter, äldre fälls ihop bakom en knapp
  const visiblePast = showEarlier ? pastItems : pastItems.slice(-2);
  const hiddenCount = pastItems.length - visiblePast.length;

  // Tidsstyrt tips högst upp — ändras efter läget just nu
  const currentTip = useMemo<Tip | null>(() => {
    if (!now) return null;
    const nowMs = now.getTime();

    // Match avslutad inom 30 min → återhämtning
    const justEnded = matches.some((m) => {
      if (!m.starts_at) return false;
      const end = new Date(m.starts_at).getTime() + 45 * 60_000;
      return end <= nowMs && nowMs - end <= 30 * 60_000;
    });
    if (justEnded) {
      return {
        emoji: "🍎",
        text: "Stoppa snabbt i dig något att äta och fyll vattenflaskan.",
      };
    }

    // Nästa kommande punkt (match eller event)
    const ups: { ms: number; kind: "match" | "event"; etype?: CupEvent["type"] }[] = [];
    for (const e of events) {
      if (e.starts_at && e.status !== "cancelled") {
        ups.push({ ms: new Date(e.starts_at).getTime(), kind: "event", etype: e.type });
      }
    }
    for (const m of matches) {
      if (m.starts_at) ups.push({ ms: new Date(m.starts_at).getTime(), kind: "match" });
    }
    const next = ups
      .filter((u) => u.ms > nowMs)
      .sort((a, b) => a.ms - b.ms)[0];
    if (!next) return null;
    const minsTo = (next.ms - nowMs) / 60_000;

    // Snart match → förberedelse
    if (next.kind === "match" && minsTo <= 70) {
      return {
        emoji: "💧",
        text: "Snart match – fyll vattenflaskan och kolla benskydd, skor och matchtröja.",
      };
    }
    // Snart läggdags → kvällsrutin
    if (next.kind === "event" && next.etype === "somn" && minsTo <= 60) {
      return {
        emoji: "🪥",
        text: "Snart läggdags – borsta tänderna, ladda mobilen och plocka fram morgondagens grejer.",
      };
    }
    // Allmän påminnelse mitt på en cupdag
    if (isToday && now.getHours() >= 9 && now.getHours() < 20) {
      return {
        emoji: "💧",
        text: "Drick vatten ofta – det är lätt att glömma en cupdag!",
      };
    }
    return null;
  }, [now, events, matches, isToday]);

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

  // Nästa händelse över alla dagar — för den tydliga nedräkningen högst upp
  const nextUpcoming = useMemo(() => {
    if (!now) return null;
    const upcoming: Upcoming[] = [];
    for (const e of events) {
      if (e.starts_at && e.status !== "cancelled") {
        upcoming.push({
          time: e.starts_at,
          day: e.day,
          label: e.title,
          emoji: EVENT_META[e.type].emoji,
          dayLabel: tabFormat.format(dayToDate(e.day)),
          isToday: e.day === today,
        });
      }
    }
    for (const m of matches) {
      if (m.starts_at && m.day) {
        upcoming.push({
          time: m.starts_at,
          day: m.day,
          label: `${m.home_team} – ${m.away_team}`,
          emoji: "⚽",
          dayLabel: tabFormat.format(dayToDate(m.day)),
          isToday: m.day === today,
        });
      }
    }
    upcoming.sort((a, b) => (a.time < b.time ? -1 : 1));
    return upcoming.find((u) => new Date(u.time) > now) ?? null;
  }, [events, matches, now, today]);

  const renderItem = (item: TimelineItem, index: number, dimmed: boolean) =>
    item.kind === "event" ? (
      <EventCard
        key={item.event.id}
        event={item.event}
        team={item.event.team_id ? teamById.get(item.event.team_id) : undefined}
        isNext={itemKey(item) === nextItemKey}
        delayMs={index * 40}
        dimmed={dimmed}
      />
    ) : (
      <MatchCard
        key={item.match.id}
        match={item.match}
        team={matchTeam(item.match)}
        briefing={
          matchTeam(item.match)
            ? pickBriefing(
                briefings,
                matchTeam(item.match)!.id,
                item.match.id
              )
            : null
        }
        players={players}
        isNext={itemKey(item) === nextItemKey}
        delayMs={index * 40}
        dimmed={dimmed}
      />
    );

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="schema" />

      {/* Tydlig nedräkning till nästa händelse – tryck för att hoppa dit */}
      {nextUpcoming && now && (
        <button
          type="button"
          onClick={() => setSelectedDay(nextUpcoming.day)}
          className="mb-5 flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-card"
        >
          <span className="text-2xl" aria-hidden>
            {nextUpcoming.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
              Härnäst{!nextUpcoming.isToday && ` · ${nextUpcoming.dayLabel}`}
            </span>
            <span className="block truncate text-base font-bold leading-tight">
              {nextUpcoming.label}
            </span>
          </span>
          <span className="shrink-0 rounded-lg bg-sun px-3 py-1.5 text-center font-[family-name:var(--font-display)] font-bold text-lg leading-none shadow-chip">
            {formatCountdown(
              new Date(nextUpcoming.time).getTime() - now.getTime()
            )}
          </span>
        </button>
      )}

      {/* Tidsstyrt matnyttigt tips */}
      {currentTip && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-paper/10 px-4 py-2.5 text-sm font-medium text-paper/85">
          <span className="text-base" aria-hidden>
            {currentTip.emoji}
          </span>
          <span>{currentTip.text}</span>
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
          {/* Äldre passerade punkter fälls ihop bakom en knapp */}
          {hiddenCount > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowEarlier(true)}
                className="w-full rounded-xl border border-dashed border-paper/30 px-4 py-2 text-sm font-bold text-paper/70 transition-colors hover:text-paper"
              >
                Visa {hiddenCount} tidigare{" "}
                {hiddenCount === 1 ? "punkt" : "punkter"}
              </button>
            </li>
          )}

          {/* Passerade punkter (nertonade) */}
          {visiblePast.map((item, index) => renderItem(item, index, true))}

          {/* Kommande punkter */}
          {restItems.map((item, index) =>
            renderItem(item, visiblePast.length + index, false)
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
  dimmed,
}: {
  event: CupEvent;
  team?: Team;
  isNext: boolean;
  delayMs: number;
  dimmed?: boolean;
}) {
  const meta = EVENT_META[event.type];
  const cancelled = event.status === "cancelled";

  return (
    <li
      className={`rise relative overflow-hidden rounded-xl bg-white shadow-card transition-opacity ${
        dimmed ? "opacity-45" : cancelled ? "opacity-60" : ""
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
  briefing,
  players,
  isNext,
  delayMs,
  dimmed,
}: {
  match: Match;
  team?: Team;
  briefing: Briefing | null;
  players: Player[];
  isNext: boolean;
  delayMs: number;
  dimmed?: boolean;
}) {
  const meta = EVENT_META.match;
  const played = match.home_score !== null && match.away_score !== null;
  const [open, setOpen] = useState(false);
  const hasBriefing = !!team && briefingHasContent(briefing);

  return (
    <li
      className={`rise relative overflow-hidden rounded-xl bg-white shadow-card transition-opacity ${
        dimmed ? "opacity-45" : ""
      }`}
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

      {hasBriefing && (
        <div className="border-t border-ink/10 px-5 pb-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between py-2.5 text-sm font-bold text-grass"
          >
            Matchgenomgång
            <span aria-hidden className={open ? "rotate-180" : ""}>
              ▾
            </span>
          </button>
          {open && (
            <div className="pb-4">
              <MatchBriefing briefing={briefing} players={players} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
