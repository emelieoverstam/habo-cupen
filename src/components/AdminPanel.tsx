"use client";

// Ledar-admin: inloggning via Supabase Auth och hantering av hålltider
// (events). Matcher, resultat och tabeller sköts av Cupmate-synken och
// hanteras inte här.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { EVENT_META, type EventType } from "@/lib/event-meta";
import { resizeImage } from "@/lib/image";
import type { Enums, Tables } from "@/types/database";
import {
  type Briefing,
  type LineupSlot,
  type Position,
  parseBriefing,
} from "@/lib/briefing";
import MatchPitch from "@/components/MatchPitch";
import PoangjaktManager from "@/components/PoangjaktManager";
import type {
  QuestCompletion,
  QuestGroup,
  QuestState,
  QuestTask,
} from "@/lib/poangjakt";

type CupEvent = Tables<"events">;
type Team = Tables<"teams">;
type Player = Tables<"players">;
type EventStatus = Enums<"event_status">;
type Match = Tables<"matches">;
type CaptainInfo = Tables<"captain_info">;
type Profile = Tables<"profiles">;

// Flikar i admin så att hålltider, trupp och genomgång inte ligger på samma
// långa sida
type AdminTab = "events" | "players" | "briefings" | "poangjakt";
const TABS: { id: AdminTab; label: string }[] = [
  { id: "events", label: "Hålltider" },
  { id: "players", label: "Trupperna" },
  { id: "briefings", label: "Genomgång" },
  { id: "poangjakt", label: "Poängjakt" },
];

const STATUS_LABELS: Record<EventStatus, string> = {
  confirmed: "Bekräftad",
  tbd: "Preliminär tid",
  cancelled: "Inställd",
};

const DEFAULT_DAY = "2026-06-27";

const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

const dayFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

type FormState = {
  type: EventType;
  title: string;
  day: string;
  time: string;
  teamId: string;
  location: string;
  note: string;
  status: EventStatus;
};

const EMPTY_FORM: FormState = {
  type: "samling",
  title: "",
  day: DEFAULT_DAY,
  time: "",
  teamId: "",
  location: "",
  note: "",
  status: "confirmed",
};

/* Fyll formuläret från ett befintligt event */
function formFromEvent(event: CupEvent): FormState {
  return {
    type: event.type,
    title: event.title,
    day: event.day,
    time: event.starts_at
      ? timeFormat.format(new Date(event.starts_at))
      : "",
    teamId: event.team_id ?? "",
    location: event.location ?? "",
    note: event.note ?? "",
    status: event.status,
  };
}

export default function AdminPanel({
  initialEvents,
  initialTeams,
  initialPlayers,
  initialMatches,
  initialBriefings,
  initialCaptainInfo,
  initialProfiles,
  initialQuestTasks,
  initialQuestGroups,
  initialQuestCompletions,
  initialQuestState,
}: {
  initialEvents: CupEvent[];
  initialTeams: Team[];
  initialPlayers: Player[];
  initialMatches: Match[];
  initialBriefings: Briefing[];
  initialCaptainInfo: CaptainInfo | null;
  initialProfiles: Profile[];
  initialQuestTasks: QuestTask[];
  initialQuestGroups: QuestGroup[];
  initialQuestCompletions: QuestCompletion[];
  initialQuestState: QuestState | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<AdminTab>("events");

  // Konto-id → ledarens namn (för "inloggad som" och "senast ändrad av")
  const profileName = useMemo(
    () => new Map(initialProfiles.map((p) => [p.id, p.name])),
    [initialProfiles]
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <header className="pt-8 pb-6 text-center">
        <h1 className="font-[family-name:var(--font-display)] font-bold text-3xl uppercase leading-tight text-paper">
          Ledar-admin
        </h1>
        <p className="mt-2 text-sm font-semibold text-paper/80">
          Hålltider för Habo-cupen 2026 ·{" "}
          <Link href="/" className="underline decoration-sun decoration-2">
            Till schemat
          </Link>
        </p>
      </header>

      {!authChecked ? null : user ? (
        <>
          <div className="mb-5 flex items-center justify-between text-sm font-semibold text-paper/80">
            <span>Inloggad som {profileName.get(user.id) ?? user.email}</span>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="rounded-full border border-paper/30 bg-paper/10 px-3 py-1 font-bold text-paper transition-transform active:scale-95"
            >
              Logga ut
            </button>
          </div>

          {/* Flikar för att växla mellan sektionerna */}
          <nav aria-label="Välj sektion" className="mb-6 flex gap-2">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={active}
                  className={`flex-1 rounded-xl border px-3 py-2 font-[family-name:var(--font-display)] font-bold text-sm uppercase transition-transform active:scale-95 ${
                    active
                      ? "border-transparent bg-sun text-ink shadow-chip"
                      : "border-paper/30 bg-paper/10 text-paper hover:bg-paper/20"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>

          {tab === "events" && (
            <EventManager
              supabase={supabase}
              initialEvents={initialEvents}
              initialTeams={initialTeams}
              profileName={profileName}
            />
          )}
          {tab === "players" && (
            <>
              <PlayersManager
                supabase={supabase}
                teams={initialTeams}
                initialPlayers={initialPlayers}
              />
              <LeadersManager supabase={supabase} teams={initialTeams} />
              <CaptainInfoManager
                supabase={supabase}
                initial={initialCaptainInfo}
              />
            </>
          )}
          {tab === "briefings" && (
            <BriefingManager
              supabase={supabase}
              teams={initialTeams}
              players={initialPlayers}
              matches={initialMatches}
              initialBriefings={initialBriefings}
              profileName={profileName}
            />
          )}
          {tab === "poangjakt" && (
            <PoangjaktManager
              supabase={supabase}
              initialTasks={initialQuestTasks}
              initialGroups={initialQuestGroups}
              initialCompletions={initialQuestCompletions}
              initialState={initialQuestState}
              players={initialPlayers}
            />
          )}
        </>
      ) : (
        <LoginForm supabase={supabase} profiles={initialProfiles} />
      )}
    </main>
  );
}

function LoginForm({
  supabase,
  profiles,
}: {
  supabase: ReturnType<typeof createClient>;
  profiles: Profile[];
}) {
  const sorted = useMemo(
    () => [...profiles].sort((a, b) => a.name.localeCompare(b.name, "sv")),
    [profiles]
  );
  const [email, setEmail] = useState(sorted[0]?.login_email ?? "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    });
    if (authError) {
      setError("Fel PIN-kod. Försök igen.");
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rise rounded-xl bg-white p-5 shadow-card"
    >
      <h2 className="mb-4 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
        Logga in
      </h2>
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-bold">Vem är du?</span>
        <select
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
        >
          {sorted.map((p) => (
            <option key={p.id} value={p.login_email}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-bold">PIN-kod</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2 tracking-[0.3em]"
        />
      </label>
      {error && (
        <p className="mb-3 rounded-lg bg-falu px-3 py-2 text-sm font-bold text-paper">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !email}
        className="w-full rounded-xl bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
      >
        {busy ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}

function EventManager({
  supabase,
  initialEvents,
  initialTeams,
  profileName,
}: {
  supabase: ReturnType<typeof createClient>;
  initialEvents: CupEvent[];
  initialTeams: Team[];
  profileName: Map<string, string>;
}) {
  const [events, setEvents] = useState<CupEvent[]>(initialEvents);
  const [teams] = useState<Team[]>(initialTeams);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Hämtas om efter spara/ta bort — initialdatat kommer från servern
  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("day")
      .order("starts_at", { nullsFirst: false });
    if (data) setEvents(data);
  }, [supabase]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(event: CupEvent) {
    setEditingId(event.id);
    setForm(formFromEvent(event));
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    // Cupen spelas i juni — svensk sommartid (+02:00)
    const payload = {
      type: form.type,
      title: form.title.trim(),
      day: form.day,
      starts_at: form.time ? `${form.day}T${form.time}:00+02:00` : null,
      team_id: form.teamId || null,
      location: form.location.trim() || null,
      note: form.note.trim() || null,
      status: form.status,
    };

    const { error } = editingId
      ? await supabase.from("events").update(payload).eq("id", editingId)
      : await supabase.from("events").insert(payload);

    if (error) {
      setMessage(`Kunde inte spara: ${error.message}`);
    } else {
      setMessage(editingId ? "Hålltiden är uppdaterad." : "Hålltiden är tillagd.");
      resetForm();
      await loadData();
    }
    setBusy(false);
  }

  async function handleDelete(event: CupEvent) {
    if (!window.confirm(`Ta bort "${event.title}"?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      setMessage(`Kunde inte ta bort: ${error.message}`);
    } else {
      if (editingId === event.id) resetForm();
      await loadData();
    }
  }

  const days = [...new Set(events.map((e) => e.day))].sort();

  return (
    <>
      {/* Formulär för ny/ändrad hålltid */}
      <form
        onSubmit={handleSubmit}
        className="rise mb-8 rounded-xl bg-white p-5 shadow-card"
      >
        <h2 className="mb-4 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          {editingId ? "Ändra hålltid" : "Ny hålltid"}
        </h2>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Typ</span>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as EventType)}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            >
              {(Object.keys(EVENT_META) as EventType[]).map((type) => (
                <option key={type} value={type}>
                  {EVENT_META[type].emoji} {EVENT_META[type].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Lag</span>
            <select
              value={form.teamId}
              onChange={(e) => set("teamId", e.target.value)}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            >
              <option value="">Båda lagen</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">Titel</span>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="t.ex. Lunch i matsalen"
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Dag</span>
            <input
              type="date"
              required
              value={form.day}
              onChange={(e) => set("day", e.target.value)}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">
              Tid <span className="font-normal text-ink/60">(valfri)</span>
            </span>
            <input
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            />
          </label>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">
              Plats <span className="font-normal text-ink/60">(valfri)</span>
            </span>
            <input
              type="text"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="t.ex. Habo skola"
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Status</span>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as EventStatus)}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            >
              {(Object.keys(STATUS_LABELS) as EventStatus[]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-bold">
            Notering <span className="font-normal text-ink/60">(valfri)</span>
          </span>
          <textarea
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            rows={2}
            placeholder="t.ex. Samling 30 min innan"
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        {message && (
          <p className="mb-3 rounded-lg bg-sun px-3 py-2 text-sm font-bold">
            {message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "Sparar…" : editingId ? "Spara ändringar" : "Lägg till"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-ink/25 bg-paper px-4 py-2.5 font-bold transition-transform active:scale-95"
            >
              Avbryt
            </button>
          )}
        </div>
      </form>

      {/* Befintliga hålltider */}
      <h2 className="mb-3 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
        Inlagda hålltider
      </h2>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-paper/30 px-4 py-6 text-center font-semibold text-paper/70">
          Inga hålltider inlagda ännu.
        </p>
      ) : (
        days.map((day) => (
          <div key={day} className="mb-5">
            <h3 className="mb-2 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
              {dayFormat.format(new Date(`${day}T12:00:00`))}
            </h3>
            <ul className="space-y-2">
              {events
                .filter((e) => e.day === day)
                .map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-chip"
                  >
                    <span aria-hidden>{EVENT_META[event.type].emoji}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate">
                        <strong>
                          {event.starts_at
                            ? timeFormat.format(new Date(event.starts_at))
                            : "–"}
                        </strong>{" "}
                        {event.title}
                        {event.status !== "confirmed" && (
                          <em className="text-ink/60">
                            {" "}
                            ({STATUS_LABELS[event.status].toLowerCase()})
                          </em>
                        )}
                      </span>
                      {event.updated_by && profileName.get(event.updated_by) && (
                        <span className="block truncate text-[11px] font-normal text-ink/45">
                          Ändrad av {profileName.get(event.updated_by)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(event)}
                      className="rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold transition-transform active:scale-95"
                    >
                      Ändra
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(event)}
                      className="rounded-full bg-falu px-2.5 py-0.5 text-xs font-bold text-paper transition-transform active:scale-95"
                    >
                      Ta bort
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </>
  );
}

/* Truppform: namn, nummer, lag och valfri bild som laddas upp till storage */
type PlayerFormState = {
  teamId: string;
  name: string;
  number: string;
  isCaptain: boolean;
};

/* Plocka ut lagringsvägen ur en publik storage-URL (för borttagning) */
function storagePathFromUrl(url: string): string | null {
  const marker = "/object/public/spelare/";
  const index = url.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
}

function PlayersManager({
  supabase,
  teams,
  initialPlayers,
}: {
  supabase: ReturnType<typeof createClient>;
  teams: Team[];
  initialPlayers: Player[];
}) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  // Tomt teamId = "inget lag ännu" — spelaren placeras senare
  const [form, setForm] = useState<PlayerFormState>({
    teamId: "",
    name: "",
    number: "",
    isCaptain: false,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .order("number", { nullsFirst: false })
      .order("name");
    if (data) setPlayers(data);
  }, [supabase]);

  function resetForm() {
    setEditingId(null);
    setForm((f) => ({ teamId: f.teamId, name: "", number: "", isCaptain: false }));
    setPhotoFile(null);
    setFileKey((k) => k + 1); // nollställer filväljaren
  }

  function startEdit(player: Player) {
    setEditingId(player.id);
    setForm({
      teamId: player.team_id ?? "",
      name: player.name,
      number: player.number?.toString() ?? "",
      isCaptain: player.is_captain,
    });
    setPhotoFile(null);
    setFileKey((k) => k + 1);
    setMessage(null);
  }

  async function uploadPhoto(file: File, teamId: string): Promise<string> {
    const blob = await resizeImage(file);
    const path = `${teamId || "pool"}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("spelare")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error(error.message);
    return supabase.storage.from("spelare").getPublicUrl(path).data.publicUrl;
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const editing = editingId
        ? players.find((p) => p.id === editingId)
        : undefined;

      let photoUrl = editing?.photo_url ?? null;
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile, form.teamId);
        // Städa bort den gamla bilden när en ny laddats upp
        const oldPath = editing?.photo_url
          ? storagePathFromUrl(editing.photo_url)
          : null;
        if (oldPath) await supabase.storage.from("spelare").remove([oldPath]);
      }

      const payload = {
        team_id: form.teamId || null,
        name: form.name.trim(),
        number: form.number ? Number(form.number) : null,
        photo_url: photoUrl,
        is_captain: form.isCaptain,
      };

      const { error } = editingId
        ? await supabase.from("players").update(payload).eq("id", editingId)
        : await supabase.from("players").insert(payload);
      if (error) throw new Error(error.message);

      setMessage(editingId ? "Spelaren är uppdaterad." : "Spelaren är tillagd.");
      resetForm();
      await loadPlayers();
    } catch (err) {
      setMessage(
        `Kunde inte spara: ${err instanceof Error ? err.message : "okänt fel"}`
      );
    }
    setBusy(false);
  }

  async function handleDelete(player: Player) {
    if (!window.confirm(`Ta bort ${player.name}?`)) return;
    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", player.id);
    if (error) {
      setMessage(`Kunde inte ta bort: ${error.message}`);
      return;
    }
    const path = player.photo_url ? storagePathFromUrl(player.photo_url) : null;
    if (path) await supabase.storage.from("spelare").remove([path]);
    if (editingId === player.id) resetForm();
    await loadPlayers();
  }

  // Andra kaptener i samma lag (exkl. den som redigeras) — för den mjuka varningen
  const otherCaptains = players.filter(
    (p) => p.team_id === form.teamId && p.is_captain && p.id !== editingId
  ).length;

  return (
    <section className="mt-10">
      <h2 className="mb-3 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
        Trupperna
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-xl bg-white p-5 shadow-card"
      >
        <h3 className="mb-4 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          {editingId ? "Ändra spelare" : "Ny spelare"}
        </h3>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Lag</span>
            <select
              value={form.teamId}
              onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            >
              <option value="">Inget lag ännu</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">
              Nummer <span className="font-normal text-ink/60">(valfri)</span>
            </span>
            <input
              type="number"
              min={0}
              max={99}
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            />
          </label>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">Namn</span>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="t.ex. Liv Hallin"
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-bold">
            Bild{" "}
            <span className="font-normal text-ink/60">
              (valfri — skalas ner automatiskt)
            </span>
          </span>
          <input
            key={fileKey}
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2 text-sm"
          />
        </label>

        <label className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isCaptain}
            onChange={(e) =>
              setForm((f) => ({ ...f, isCaptain: e.target.checked }))
            }
            className="h-4 w-4"
          />
          <span className="text-sm font-bold">Kapten</span>
        </label>
        {form.isCaptain && form.teamId && otherCaptains >= 2 && (
          <p className="mb-4 rounded-lg bg-sun/40 px-3 py-2 text-sm font-semibold">
            Laget har redan två kaptener. Det går att spara fler, men tanken är
            att de delar på rollen två och två.
          </p>
        )}

        {message && (
          <p className="mb-3 rounded-lg bg-sun px-3 py-2 text-sm font-bold">
            {message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "Sparar…" : editingId ? "Spara ändringar" : "Lägg till"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-ink/25 bg-paper px-4 py-2.5 font-bold transition-transform active:scale-95"
            >
              Avbryt
            </button>
          )}
        </div>
      </form>

      {/* Ej placerade spelare först — arbetspoolen under förberedelserna */}
      <PlayerGroup
        title="Ej placerade"
        emptyText="Inga oplacerade spelare."
        players={players.filter((p) => p.team_id === null)}
        onEdit={startEdit}
        onDelete={handleDelete}
      />

      {teams.map((team) => (
        <PlayerGroup
          key={team.id}
          title={team.name}
          color={team.color}
          emptyText="Inga spelare inlagda ännu."
          players={players.filter((p) => p.team_id === team.id)}
          onEdit={startEdit}
          onDelete={handleDelete}
        />
      ))}
    </section>
  );
}

function PlayerGroup({
  title,
  color,
  emptyText,
  players,
  onEdit,
  onDelete,
}: {
  title: string;
  color?: string;
  emptyText: string;
  players: Player[];
  onEdit: (player: Player) => void;
  onDelete: (player: Player) => void;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
        <span
          className="inline-block h-3 w-3 rounded-full border border-ink/40"
          style={{ backgroundColor: color ?? "var(--paper)" }}
          aria-hidden
        />
        {title} ({players.length})
      </h3>
      {players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-paper/30 px-4 py-4 text-center text-sm font-semibold text-paper/70">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-chip"
            >
              {player.photo_url ? (
                <Image
                  src={player.photo_url}
                  alt={player.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-paper">
                  ⚽
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {player.number !== null && (
                  <strong className="mr-1.5 font-[family-name:var(--font-display)] font-bold">
                    #{player.number}
                  </strong>
                )}
                {player.name}
              </span>
              {player.is_captain && (
                <span className="shrink-0 rounded-full bg-pine px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sun">
                  Kapten
                </span>
              )}
              <button
                type="button"
                onClick={() => onEdit(player)}
                className="rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold transition-transform active:scale-95"
              >
                Ändra
              </button>
              <button
                type="button"
                onClick={() => onDelete(player)}
                className="rounded-full bg-falu px-2.5 py-0.5 text-xs font-bold text-paper transition-transform active:scale-95"
              >
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Matchgenomgång ----------------------------------------------------

type BriefingFormState = {
  formation: string;
  lineup: LineupSlot[];
  bench: string[];
  offensive: string;
  defensive: string;
  note: string;
  captainId: string | null;
};

const EMPTY_BRIEFING_FORM: BriefingFormState = {
  formation: "",
  lineup: [],
  bench: [],
  offensive: "",
  defensive: "",
  note: "",
  captainId: null,
};

const briefingTimeFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

/* Lagets första match i schemat (matchnamn matchar Cupmates exakt). */
function firstMatchIdFor(team: Team | undefined, matches: Match[]): string {
  if (!team) return "";
  const m = matches.find(
    (mm) => mm.home_team === team.name || mm.away_team === team.name
  );
  return m?.id ?? "";
}

/* Fyll formuläret från en befintlig genomgång (för redigering/förifyllning). */
function formFromBriefing(b: Briefing): BriefingFormState {
  return {
    formation: b.formation ?? "",
    lineup: b.lineup,
    bench: b.bench,
    offensive: b.offensive ?? "",
    defensive: b.defensive ?? "",
    note: b.note ?? "",
    captainId: b.captain_id,
  };
}

function BriefingManager({
  supabase,
  teams,
  players,
  matches,
  initialBriefings,
  profileName,
}: {
  supabase: ReturnType<typeof createClient>;
  teams: Team[];
  players: Player[];
  matches: Match[];
  initialBriefings: Briefing[];
  profileName: Map<string, string>;
}) {
  const [briefings, setBriefings] = useState<Briefing[]>(initialBriefings);
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  // Varje match har sin egen genomgång — matchId är alltid ett match-id
  const [matchId, setMatchId] = useState<string>(() =>
    firstMatchIdFor(teams[0], matches)
  );
  // Förfyll direkt med den sparade genomgången för förvald match (annars tomt)
  const [form, setForm] = useState<BriefingFormState>(() => {
    const firstMatch = firstMatchIdFor(teams[0], matches);
    const row = initialBriefings.find(
      (b) => b.team_id === (teams[0]?.id ?? "") && b.match_id === (firstMatch || null)
    );
    return row ? formFromBriefing(row) : EMPTY_BRIEFING_FORM;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const team = teams.find((t) => t.id === teamId) ?? null;

  // Spelarna i valt lag — väljs in i uppställningen
  const squad = useMemo(
    () => players.filter((p) => p.team_id === teamId),
    [players, teamId]
  );

  // Lagets matcher (matchnamn matchar Cupmates exakt)
  const teamMatches = useMemo(
    () =>
      team
        ? matches.filter(
            (m) => m.home_team === team.name || m.away_team === team.name
          )
        : [],
    [matches, team]
  );

  // Hämtar om genomgångarna och returnerar den uppdaterade listan
  const loadBriefings = useCallback(async (): Promise<Briefing[]> => {
    const { data } = await supabase.from("match_briefings").select("*");
    const parsed = data ? data.map(parseBriefing) : [];
    setBriefings(parsed);
    return parsed;
  }, [supabase]);

  // Den sparade raden för valt lag+mål (om någon finns) — styr Ta bort-knappen
  const currentRow = useMemo(
    () =>
      briefings.find(
        (b) => b.team_id === teamId && (b.match_id ?? "") === matchId
      ) ?? null,
    [briefings, teamId, matchId]
  );

  // Återställ formuläret till den sparade raden (eller tomt) — anropas vid val av lag/mål
  function resetFormForSelection(
    newTeamId: string,
    newMatchId: string,
    source: Briefing[]
  ) {
    const row = source.find(
      (b) => b.team_id === newTeamId && (b.match_id ?? "") === newMatchId
    );
    setForm(row ? formFromBriefing(row) : EMPTY_BRIEFING_FORM);
    setMessage(null);
  }

  // Spelare som inte är placerade på planen → kan väljas in
  const placedIds = new Set(form.lineup.map((s) => s.player_id));
  const available = squad.filter((p) => !placedIds.has(p.id));

  // Matchkaptenen väljs bland lagets utvalda kaptener som står på planen
  const anyCaptainDesignated = squad.some((p) => p.is_captain);
  const captainsOnPitch = squad.filter(
    (p) => p.is_captain && placedIds.has(p.id)
  );

  function addToPitch(playerId: string) {
    // Placeras mitt på planen; ledaren drar sedan dit hon vill
    setForm((f) => ({
      ...f,
      lineup: [...f.lineup, { player_id: playerId, x: 0.5, y: 0.5 }],
      bench: f.bench.filter((id) => id !== playerId),
    }));
  }

  function moveOnPitch(playerId: string, x: number, y: number) {
    setForm((f) => ({
      ...f,
      lineup: f.lineup.map((s) =>
        s.player_id === playerId ? { ...s, x, y } : s
      ),
    }));
  }

  function removeFromPitch(playerId: string) {
    setForm((f) => ({
      ...f,
      lineup: f.lineup.filter((s) => s.player_id !== playerId),
      // Tas matchkaptenen bort från planen nollställs kaptensvalet
      captainId: f.captainId === playerId ? null : f.captainId,
    }));
  }

  // Ledaren väljer position själv per spelare (frikopplat från placeringen)
  function setPosition(playerId: string, position: Position) {
    setForm((f) => ({
      ...f,
      lineup: f.lineup.map((s) =>
        s.player_id === playerId ? { ...s, position } : s
      ),
    }));
  }

  function toggleBench(playerId: string) {
    setForm((f) => ({
      ...f,
      bench: f.bench.includes(playerId)
        ? f.bench.filter((id) => id !== playerId)
        : [...f.bench, playerId],
    }));
  }

  // Förifyll från en annan av lagets genomgångar (mall eller match)
  function prefillFrom(sourceMatchId: string) {
    const source = briefings.find(
      (b) => b.team_id === teamId && (b.match_id ?? "") === sourceMatchId
    );
    if (source) {
      setForm(formFromBriefing(source));
      setMessage("Förifyllt — kom ihåg att spara.");
    }
  }

  // setPublished: true = publicera, false = avpublicera, undefined = behåll läget
  async function handleSave(setPublished?: boolean) {
    if (!matchId) {
      setMessage("Välj en match först.");
      return;
    }
    setBusy(true);
    setMessage(null);

    // Finns redan en rad för lag+match → uppdatera, annars infoga
    const existing = briefings.find(
      (b) => b.team_id === teamId && (b.match_id ?? "") === matchId
    );
    const published = setPublished ?? existing?.published ?? false;

    const payload = {
      team_id: teamId,
      match_id: matchId,
      formation: form.formation.trim() || null,
      lineup: form.lineup as unknown as Tables<"match_briefings">["lineup"],
      bench: form.bench as unknown as Tables<"match_briefings">["bench"],
      offensive: form.offensive.trim() || null,
      defensive: form.defensive.trim() || null,
      note: form.note.trim() || null,
      captain_id: form.captainId,
      published,
    };
    // updated_at sätts av databastriggern set_updated_at — inte här.

    const { error } = existing
      ? await supabase
          .from("match_briefings")
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("match_briefings").insert(payload);

    if (error) {
      setMessage(`Kunde inte spara: ${error.message}`);
    } else {
      setMessage(
        setPublished === true
          ? "Genomgången är publicerad – nu syns den för spelarna."
          : setPublished === false
            ? "Genomgången är avpublicerad – sparad som utkast."
            : "Genomgången är sparad."
      );
      const fresh = await loadBriefings();
      resetFormForSelection(teamId, matchId, fresh);
    }
    setBusy(false);
  }

  async function handleDelete() {
    const existing = briefings.find(
      (b) => b.team_id === teamId && (b.match_id ?? "") === matchId
    );
    if (!existing) return;
    if (!window.confirm("Ta bort den här genomgången?")) return;
    const { error } = await supabase
      .from("match_briefings")
      .delete()
      .eq("id", existing.id);
    if (error) {
      setMessage(`Kunde inte ta bort: ${error.message}`);
      return;
    }
    setForm(EMPTY_BRIEFING_FORM);
    setMessage(null);
    await loadBriefings();
  }

  if (teams.length === 0) return null;

  // Finns en sparad genomgång för ett visst lag+mål? (för ✓ i listorna)
  const hasBriefing = (tId: string, mId: string) =>
    briefings.some((b) => b.team_id === tId && (b.match_id ?? "") === mId);
  const teamHasAnyBriefing = (tId: string) =>
    briefings.some((b) => b.team_id === tId);

  // Källor att förifylla från (lagets mall + matcher som har en genomgång),
  // exklusive det mål som redigeras just nu
  const prefillSources = briefings
    .filter(
      (b) => b.team_id === teamId && b.match_id !== null && b.match_id !== matchId
    )
    .map((b) => {
      const m = matches.find((mm) => mm.id === b.match_id);
      return {
        value: b.match_id as string,
        label: m ? `${m.home_team} – ${m.away_team}` : "Match",
      };
    });

  return (
    <section className="mt-10">
      <h2 className="mb-3 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
        Matchgenomgång
      </h2>

      <div className="rounded-xl bg-white p-5 shadow-card">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Lag</span>
            <select
              value={teamId}
              onChange={(e) => {
                const newTeamId = e.target.value;
                const newTeam = teams.find((t) => t.id === newTeamId);
                const newMatchId = firstMatchIdFor(newTeam, matches);
                setTeamId(newTeamId);
                setMatchId(newMatchId);
                resetFormForSelection(newTeamId, newMatchId, briefings);
              }}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {teamHasAnyBriefing(t.id) ? " ✓" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Match</span>
            <select
              value={matchId}
              onChange={(e) => {
                const newMatchId = e.target.value;
                setMatchId(newMatchId);
                resetFormForSelection(teamId, newMatchId, briefings);
              }}
              disabled={teamMatches.length === 0}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2 disabled:opacity-60"
            >
              {teamMatches.length === 0 && (
                <option value="">Inga matcher i schemat</option>
              )}
              {teamMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.home_team} – {m.away_team}
                  {m.starts_at
                    ? ` (${briefingTimeFormat.format(new Date(m.starts_at))})`
                    : ""}
                  {hasBriefing(teamId, m.id) ? " ✓" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="-mt-2 mb-3 text-xs text-ink/55">
          ✓ = matchen har redan en sparad genomgång. Välj match för att ändra i den.
        </p>

        <div className="mb-4 flex items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wide text-ink/55">
            Status:
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-bold ${
              !currentRow
                ? "bg-ink/10 text-ink/70"
                : currentRow.published
                  ? "bg-grass text-ink"
                  : "bg-sun text-ink"
            }`}
          >
            {!currentRow
              ? "Ny – inte sparad"
              : currentRow.published
                ? "Publicerad (syns för spelarna)"
                : "Utkast (dold för spelarna)"}
          </span>
        </div>

        {currentRow?.updated_by && profileName.get(currentRow.updated_by) && (
          <p className="-mt-2 mb-4 text-xs text-ink/45">
            Senast ändrad av {profileName.get(currentRow.updated_by)}
          </p>
        )}

        {prefillSources.length > 0 && (
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-bold">
              Förifyll från{" "}
              <span className="font-normal text-ink/60">(kopierar, sparar inte)</span>
            </span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value !== "__none__") prefillFrom(e.target.value);
              }}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            >
              <option value="__none__">Välj källa…</option>
              {prefillSources.map((s) => (
                <option key={s.value || "mall"} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-bold">
            Formation{" "}
            <span className="font-normal text-ink/60">(valfri, t.ex. 1-3-2-3)</span>
          </span>
          <input
            type="text"
            value={form.formation}
            onChange={(e) =>
              setForm((f) => ({ ...f, formation: e.target.value }))
            }
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        {/* Planeditor */}
        <p className="mb-1 text-sm font-bold">Uppställning (dra spelarna på plats)</p>
        <div className="mb-3">
          <MatchPitch
            lineup={form.lineup}
            players={squad}
            onMove={moveOnPitch}
            onRemove={removeFromPitch}
            onSetPosition={setPosition}
            captainId={form.captainId}
          />
        </div>

        {/* Tillgängliga spelare att placera på planen */}
        <p className="mb-1 text-sm font-bold">Lägg till på planen</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {available.length === 0 ? (
            <span className="text-sm text-ink/60">Alla i truppen är placerade.</span>
          ) : (
            available.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToPitch(p.id)}
                className="rounded-full border border-ink/25 bg-paper px-2.5 py-1 text-sm font-semibold transition-transform active:scale-95"
              >
                {p.number != null && (
                  <span className="mr-1 text-ink/60">{p.number}</span>
                )}
                {p.name}
              </button>
            ))
          )}
        </div>

        {/* Avbytare */}
        <p className="mb-1 text-sm font-bold">
          Avbytare{" "}
          <span className="font-normal text-ink/60">(markera vilka som är med)</span>
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {available.length === 0 ? (
            <span className="text-sm text-ink/60">
              Placera färre på planen för att välja avbytare.
            </span>
          ) : (
            available.map((p) => {
              const on = form.bench.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleBench(p.id)}
                  aria-pressed={on}
                  className={`rounded-full border px-2.5 py-1 text-sm font-semibold transition-transform active:scale-95 ${
                    on
                      ? "border-transparent bg-grass text-ink"
                      : "border-ink/25 bg-paper"
                  }`}
                >
                  {p.name}
                </button>
              );
            })
          )}
        </div>

        {/* Matchkapten — bär bindeln den här matchen, visas som C på planen */}
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-bold">
            Matchkapten{" "}
            <span className="font-normal text-ink/60">(visas som C på planen)</span>
          </span>
          {!anyCaptainDesignated ? (
            <p className="text-sm text-ink/60">
              Inga kaptener utvalda än — markera kaptener under Trupperna.
            </p>
          ) : (
            <>
              <select
                value={form.captainId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, captainId: e.target.value || null }))
                }
                className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
              >
                <option value="">Ingen</option>
                {captainsOnPitch.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {captainsOnPitch.length === 0 && (
                <p className="mt-1 text-xs text-ink/55">
                  Placera en av lagets kaptener på planen för att välja matchkapten.
                </p>
              )}
            </>
          )}
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">
            Offensivt <span className="font-normal text-ink/60">(en punkt per rad)</span>
          </span>
          <textarea
            rows={3}
            value={form.offensive}
            onChange={(e) =>
              setForm((f) => ({ ...f, offensive: e.target.value }))
            }
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">
            Defensivt <span className="font-normal text-ink/60">(en punkt per rad)</span>
          </span>
          <textarea
            rows={3}
            value={form.defensive}
            onChange={(e) =>
              setForm((f) => ({ ...f, defensive: e.target.value }))
            }
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-bold">
            Anteckning <span className="font-normal text-ink/60">(valfri)</span>
          </span>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        {message && (
          <p className="mb-3 rounded-lg bg-sun px-3 py-2 text-sm font-bold">
            {message}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={busy || !matchId}
              className="flex-1 rounded-xl border border-ink/25 bg-paper px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase transition-transform active:scale-95 disabled:opacity-50"
            >
              {busy ? "Sparar…" : "Spara"}
            </button>
            <button
              type="button"
              onClick={() => handleSave(!currentRow?.published)}
              disabled={busy || !matchId}
              className={`flex-1 rounded-xl px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50 ${
                currentRow?.published
                  ? "border border-ink/25 bg-paper"
                  : "bg-grass"
              }`}
            >
              {currentRow?.published ? "Avpublicera" : "Publicera"}
            </button>
          </div>
          {currentRow && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full rounded-xl border border-falu/40 bg-paper px-4 py-2 font-bold text-falu transition-transform active:scale-95"
            >
              Ta bort genomgång
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ---- Kaptensansvar -----------------------------------------------------

/* Ledare per lag: en enkel namnlista (en rad per namn) som sparas i
   teams.leaders och visas på Trupperna-sidan. */
function LeadersManager({
  supabase,
  teams,
}: {
  supabase: ReturnType<typeof createClient>;
  teams: Team[];
}) {
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(teams.map((t) => [t.id, t.leaders ?? ""]))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    const results = await Promise.all(
      teams.map((t) =>
        supabase
          .from("teams")
          .update({ leaders: texts[t.id]?.trim() || null })
          .eq("id", t.id)
      )
    );
    const failed = results.find((r) => r.error);
    setMessage(
      failed?.error
        ? `Kunde inte spara: ${failed.error.message}`
        : "Ledarna är sparade."
    );
    setBusy(false);
  }

  if (teams.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
        Ledare
      </h2>

      <div className="rounded-xl bg-white p-5 shadow-card">
        {teams.map((t) => (
          <label key={t.id} className="mb-3 block">
            <span className="mb-1 block text-sm font-bold">
              {t.name}{" "}
              <span className="font-normal text-ink/60">(ett namn per rad)</span>
            </span>
            <textarea
              rows={3}
              value={texts[t.id] ?? ""}
              onChange={(e) =>
                setTexts((s) => ({ ...s, [t.id]: e.target.value }))
              }
              placeholder={"t.ex.\nAnna Andersson\nBjörn Björsson"}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            />
          </label>
        ))}

        {message && (
          <p className="mb-3 rounded-lg bg-sun px-3 py-2 text-sm font-bold">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="w-full rounded-xl bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? "Sparar…" : "Spara"}
        </button>
      </div>
    </section>
  );
}

/* Redigerar den gemensamma texten om vad lagkaptenen ansvarar för (en punkt
   per rad). En singleton-rad i captain_info — skapas vid första sparningen. */
function CaptainInfoManager({
  supabase,
  initial,
}: {
  supabase: ReturnType<typeof createClient>;
  initial: CaptainInfo | null;
}) {
  const [rowId, setRowId] = useState<string | null>(initial?.id ?? null);
  const [text, setText] = useState(initial?.responsibilities ?? "");
  const [revealed, setRevealed] = useState(initial?.captains_revealed ?? false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // nextRevealed utelämnad = behåll nuvarande läge
  async function handleSave(nextRevealed?: boolean) {
    setBusy(true);
    setMessage(null);
    const value = text.trim() || null;
    const published = nextRevealed ?? revealed;
    const payload = { responsibilities: value, captains_revealed: published };

    const { data, error } = rowId
      ? await supabase
          .from("captain_info")
          .update(payload)
          .eq("id", rowId)
          .select()
          .single()
      : await supabase.from("captain_info").insert(payload).select().single();

    if (error) {
      setMessage(`Kunde inte spara: ${error.message}`);
    } else {
      if (data) setRowId(data.id);
      setRevealed(published);
      setMessage(
        nextRevealed === true
          ? "Kaptenerna är nu presenterade för spelarna."
          : nextRevealed === false
            ? "Kaptenerna är dolda – visas som ”presenteras senare”."
            : "Kaptensansvaret är sparat."
      );
    }
    setBusy(false);
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
        Kaptensansvar
      </h2>

      <div className="rounded-xl bg-white p-5 shadow-card">
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">
            Ansvarspunkter{" "}
            <span className="font-normal text-ink/60">
              (en punkt per rad — visas på Trupperna-sidan)
            </span>
          </span>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"t.ex.\nVara en god förebild på och utanför plan\nPrata med domaren vid behov\nPeppa laget när det är tungt"}
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2">
          <span className="text-sm font-bold">
            {revealed
              ? "Kaptenerna visas för spelarna"
              : "Dolda – visas som ”presenteras senare”"}
          </span>
          <button
            type="button"
            onClick={() => handleSave(!revealed)}
            disabled={busy}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50 ${
              revealed ? "border border-ink/25 bg-white" : "bg-grass"
            }`}
          >
            {revealed ? "Dölj" : "Presentera"}
          </button>
        </div>

        {message && (
          <p className="mb-3 rounded-lg bg-sun px-3 py-2 text-sm font-bold">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => handleSave()}
          disabled={busy}
          className="w-full rounded-xl bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? "Sparar…" : "Spara"}
        </button>
      </div>
    </section>
  );
}
