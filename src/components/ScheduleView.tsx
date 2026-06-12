"use client";

// Publik schemavy: dagflikar, lagfilter, eventlista och cupmatcher med
// resultat och tabeller. Initial data kommer från servern; uppdateringar
// kommer live via Supabase Realtime (broadcast från databasen). Klienten
// pingar dessutom /api/sync så att Cupmate-datat hålls färskt.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { EVENT_META } from "@/lib/event-meta";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type CupEvent = Tables<"events">;
type Match = Tables<"matches">;
type Standing = Tables<"standings">;
type Player = Tables<"players">;

type TimelineItem =
  | { kind: "event"; time: string | null; event: CupEvent }
  | { kind: "match"; time: string | null; match: Match };

type Props = {
  initialTeams: Team[];
  initialEvents: CupEvent[];
  initialMatches: Match[];
  initialStandings: Standing[];
  initialPlayers: Player[];
  today: string;
};

const SYNC_INTERVAL_MS = 3 * 60 * 1000;

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

const rangeFormat = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
});

/* Tolka en dag (ÅÅÅÅ-MM-DD) mitt på dagen så att veckodagen blir rätt oavsett tidszon */
function dayToDate(day: string) {
  return new Date(`${day}T12:00:00`);
}

/* Datumintervall för rubriken, t.ex. "27–28 juni" eller "30 maj – 1 juni" */
function dateRangeLabel(days: string[]) {
  if (days.length === 0) return null;
  const first = dayToDate(days[0]);
  const last = dayToDate(days[days.length - 1]);
  if (days.length === 1) return rangeFormat.format(first);
  return first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${rangeFormat.format(last)}`
    : `${rangeFormat.format(first)} – ${rangeFormat.format(last)}`;
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
  initialStandings,
  initialPlayers,
  today,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState(initialEvents);
  const [matches, setMatches] = useState(initialMatches);
  const [standings, setStandings] = useState(initialStandings);
  const [players, setPlayers] = useState(initialPlayers);
  const [teams] = useState(initialTeams);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  // null under SSR/hydration, därefter aktuell tid som tickar varje minut
  const now = useCurrentMinute();

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

  // Hämta om all data — anropas när databasen broadcastar en ändring
  const refreshData = useCallback(async () => {
    const [eventsRes, matchesRes, standingsRes, playersRes] =
      await Promise.all([
        supabase.from("events").select("*"),
        supabase.from("matches").select("*"),
        supabase.from("standings").select("*").order("position"),
        supabase
          .from("players")
          .select("*")
          .order("number", { nullsFirst: false })
          .order("name"),
      ]);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);
    if (standingsRes.data) setStandings(standingsRes.data);
    if (playersRes.data) setPlayers(playersRes.data);
  }, [supabase]);

  // Samla ihop broadcast-skurar (synken rör många rader) till en omhämtning
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refreshData, 400);
  }, [refreshData]);

  useEffect(() => {
    // Databasen sänder ändringar till topicen "schedule" via triggrar
    // (realtime.broadcast_changes). Kanalen är privat, så klienten måste
    // först autentisera sig mot Realtime — anon räcker enligt RLS-policyn.
    const channel = supabase.channel("schedule", {
      config: { private: true },
    });

    supabase.realtime.setAuth().then(() => {
      channel
        .on("broadcast", { event: "*" }, () => {
          queueRefresh();
        })
        .subscribe();
    });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, queueRefresh]);

  // Pinga synken: servern hämtar bara från Cupmate om datat är äldre än 2 min
  useEffect(() => {
    const ping = () => {
      fetch("/api/sync", { method: "POST" }).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      {/* Affischrubrik */}
      <header className="pt-8 pb-6 text-center">
        {days.length > 0 && (
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-sun">
            {dateRangeLabel(days)}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-display)] font-bold text-4xl uppercase leading-tight text-paper sm:text-5xl">
          Habo-cupen
          <span className="ml-3 inline-block -rotate-6 rounded-lg bg-sun px-2 py-1 align-middle text-lg text-ink shadow-chip sm:text-xl">
            2026
          </span>
        </h1>
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-paper">
          <span
            className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-mint"
            aria-hidden
          />
          Schema, resultat och tabeller uppdateras live
        </p>
      </header>

      {days.length === 0 ? (
        <EmptyState />
      ) : (
        <>
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

          <StandingsSection standings={standings} teams={teams} />

          <SquadSection
            players={players}
            teams={teams}
            teamFilter={teamFilter}
          />
        </>
      )}

      <footer className="mt-12 text-center text-sm font-semibold text-paper/50">
        <a href="/admin" className="hover:text-paper">
          Ledarinloggning
        </a>
      </footer>
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

function TeamMarker({ team }: { team?: Tables<"teams"> }) {
  if (!team) return <span className="font-semibold">Båda lagen</span>;
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      <span
        className="inline-block h-2 w-2 rounded-full border border-ink/40"
        style={{ backgroundColor: team.color }}
        aria-hidden
      />
      {team.name.replace("BK Zeros ", "")}
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

function StandingsSection({
  standings,
  teams,
}: {
  standings: Standing[];
  teams: Team[];
}) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, Standing[]>();
    for (const row of standings) {
      const list = byGroup.get(row.group_name) ?? [];
      list.push(row);
      byGroup.set(row.group_name, list);
    }
    for (const list of byGroup.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b, "sv"));
  }, [standings]);

  if (groups.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-xl uppercase text-paper">
        Tabeller
      </h2>
      <div className="space-y-4">
        {groups.map(([groupName, rows]) => {
          const ourTeam = teams.find((t) =>
            rows.some((r) => r.team_name === t.name)
          );
          return (
            <div
              key={groupName}
              className="rise overflow-hidden rounded-xl bg-white shadow-card"
            >
              <p className="flex items-center justify-between bg-grass px-4 py-2 font-[family-name:var(--font-display)] font-bold text-base uppercase">
                {groupName}
                {ourTeam && (
                  <span className="text-sm normal-case">
                    <TeamMarker team={ourTeam} />
                  </span>
                )}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/20 text-left text-xs uppercase text-ink/60">
                    <th className="py-1.5 pl-4 pr-2 font-bold">Lag</th>
                    <th className="px-1.5 text-center font-bold">S</th>
                    <th className="px-1.5 text-center font-bold">V</th>
                    <th className="px-1.5 text-center font-bold">O</th>
                    <th className="px-1.5 text-center font-bold">F</th>
                    <th className="px-1.5 text-center font-bold">+/−</th>
                    <th className="py-1.5 pl-1.5 pr-4 text-center font-bold">
                      P
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const ours = teams.some((t) => t.name === row.team_name);
                    return (
                      <tr
                        key={row.team_name}
                        className={`border-b border-ink/10 last:border-0 ${
                          ours ? "bg-sun/30 font-bold" : ""
                        }`}
                      >
                        <td className="truncate py-2 pl-4 pr-2">
                          {row.position}. {row.team_name}
                        </td>
                        <td className="px-1.5 text-center tabular-nums">
                          {row.played}
                        </td>
                        <td className="px-1.5 text-center tabular-nums">
                          {row.won}
                        </td>
                        <td className="px-1.5 text-center tabular-nums">
                          {row.drawn}
                        </td>
                        <td className="px-1.5 text-center tabular-nums">
                          {row.lost}
                        </td>
                        <td className="px-1.5 text-center tabular-nums">
                          {row.goal_diff}
                        </td>
                        <td className="py-2 pl-1.5 pr-4 text-center font-bold tabular-nums">
                          {row.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SquadSection({
  players,
  teams,
  teamFilter,
}: {
  players: Player[];
  teams: Team[];
  teamFilter: string | null;
}) {
  const visibleTeams = teamFilter
    ? teams.filter((t) => t.id === teamFilter)
    : teams;
  const hasPlayers = visibleTeams.some((t) =>
    players.some((p) => p.team_id === t.id)
  );
  if (!hasPlayers) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-xl uppercase text-paper">
        Trupperna
      </h2>

      {visibleTeams.map((team) => {
        const squad = players.filter((p) => p.team_id === team.id);
        if (squad.length === 0) return null;
        return (
          <div key={team.id} className="mb-7">
            <h3 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-lg uppercase text-paper">
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-ink/40"
                style={{ backgroundColor: team.color }}
                aria-hidden
              />
              {team.name}
            </h3>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {squad.map((player, index) => (
                <li
                  key={player.id}
                  className="rise"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <PlayerCard
                    player={player}
                    teamLabel={team.name.replace("BK Zeros ", "")}
                    tilt={index % 2 === 0 ? "card-tilt-l" : "card-tilt-r"}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/* Autografen växlar mellan två skrivstilar och får en lätt individuell
   lutning (stabilt utifrån spelarens id). Långa namn blir mindre. */
const AUTOGRAPH_FONTS = ["var(--font-autograph-1)"];
const AUTOGRAPH_TILTS = ["-rotate-3", "rotate-2", "-rotate-2", "rotate-3"];

function autographFor(id: string, name: string) {
  let hash = 0;
  for (const ch of id) hash = (hash + ch.charCodeAt(0)) % 997;
  return {
    font: AUTOGRAPH_FONTS[hash % AUTOGRAPH_FONTS.length],
    tilt: AUTOGRAPH_TILTS[hash % AUTOGRAPH_TILTS.length],
    size: name.length > 14 ? "text-2xl" : "text-3xl",
  };
}

/* Spelarkort i samlarkortsstil: créme-ram med guldlinje, porträtt,
   nummerbricka och namnet som autograf. Tryck vänder kortet i 3D och
   visar baksidan i klubbgrönt; vid hover lyfter kortet med foil-glans. */
function PlayerCard({
  player,
  teamLabel,
  tilt,
}: {
  player: Player;
  teamLabel: string;
  tilt: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const autograph = autographFor(player.id, player.name);

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      aria-label={`Vänd spelarkortet för ${player.name}`}
      className={`card-3d block w-full cursor-pointer text-left ${tilt}`}
    >
      <div className={`card-inner relative ${flipped ? "is-flipped" : ""}`}>
        {/* Framsida */}
        <div className="card-face rounded-xl bg-paper p-1.5 shadow-card">
          <div className="rounded-lg border border-sun p-1">
            <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-pine/15">
              {player.photo_url ? (
                <Image
                  src={player.photo_url}
                  alt={player.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl">
                  <span aria-hidden>⚽</span>
                </div>
              )}
              {player.number !== null && (
                <span className="absolute left-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-sun font-[family-name:var(--font-display)] font-bold text-sm text-ink shadow-chip">
                  {player.number}
                </span>
              )}
              <span className="card-shine" aria-hidden />
            </div>
            <div className="px-1 pb-1 pt-1.5 text-center">
              {/* Namnet som autograf under fotot */}
              <p
                className={`truncate ${autograph.size} ${autograph.tilt} leading-tight text-ink`}
                style={{ fontFamily: autograph.font }}
              >
                {player.name}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50">
                BK Zeros · {teamLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Baksida */}
        <div className="card-face card-back absolute inset-0 rounded-xl bg-pine p-1.5 shadow-card">
          <div className="card-back-pattern flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-sun/70 px-2 text-center">
            <p className="font-[family-name:var(--font-display)] font-bold text-xs tracking-[0.3em] text-sun">
              BK ZEROS
            </p>
            <p className="font-[family-name:var(--font-display)] font-bold text-6xl leading-none text-paper">
              {player.number ?? "⚽"}
            </p>
            <p
              className={`w-full truncate ${autograph.size} ${autograph.tilt} leading-tight text-sun`}
              style={{ fontFamily: autograph.font }}
            >
              {player.name}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/60">
              Habo-cupen 2026 · {teamLabel}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rise mt-8 rounded-xl bg-white px-6 py-12 text-center shadow-card">
      <p className="text-5xl" aria-hidden>
        ⚽
      </p>
      <h2 className="mt-4 font-[family-name:var(--font-display)] font-bold text-2xl uppercase">
        Schemat är inte publicerat ännu
      </h2>
      <p className="mt-2 font-semibold text-ink/70">
        Titta tillbaka snart — sidan uppdateras automatiskt så fort något
        läggs in.
      </p>
    </div>
  );
}
