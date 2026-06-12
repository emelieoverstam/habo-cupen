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

type CupEvent = Tables<"events">;
type Team = Tables<"teams">;
type Player = Tables<"players">;
type EventStatus = Enums<"event_status">;

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
}: {
  initialEvents: CupEvent[];
  initialTeams: Team[];
  initialPlayers: Player[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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
        <h1 className="font-[family-name:var(--font-display)] text-4xl uppercase leading-none">
          Ledar-admin
        </h1>
        <p className="mt-2 text-sm font-semibold text-ink/70">
          Hålltider för Habo-cupen 2026 ·{" "}
          <Link href="/" className="underline decoration-grass decoration-2">
            Till schemat
          </Link>
        </p>
      </header>

      {!authChecked ? null : user ? (
        <>
          <EventManager
            supabase={supabase}
            userEmail={user.email ?? ""}
            initialEvents={initialEvents}
            initialTeams={initialTeams}
          />
          <PlayersManager
            supabase={supabase}
            teams={initialTeams}
            initialPlayers={initialPlayers}
          />
        </>
      ) : (
        <LoginForm supabase={supabase} />
      )}
    </main>
  );
}

function LoginForm({
  supabase,
}: {
  supabase: ReturnType<typeof createClient>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError("Fel e-post eller lösenord.");
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rise rounded-xl border-2 border-ink bg-white p-5 shadow-hard"
    >
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl uppercase">
        Logga in
      </h2>
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-bold">E-post</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-bold">Lösenord</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
        />
      </label>
      {error && (
        <p className="mb-3 rounded-lg border-2 border-ink bg-coral px-3 py-2 text-sm font-bold">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl border-2 border-ink bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] text-lg uppercase shadow-hard-sm transition-transform active:scale-95 disabled:opacity-50"
      >
        {busy ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}

function EventManager({
  supabase,
  userEmail,
  initialEvents,
  initialTeams,
}: {
  supabase: ReturnType<typeof createClient>;
  userEmail: string;
  initialEvents: CupEvent[];
  initialTeams: Team[];
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
      <div className="mb-5 flex items-center justify-between text-sm font-semibold text-ink/70">
        <span>Inloggad som {userEmail}</span>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="rounded-full border-2 border-ink bg-paper px-3 py-1 font-bold transition-transform active:scale-95"
        >
          Logga ut
        </button>
      </div>

      {/* Formulär för ny/ändrad hålltid */}
      <form
        onSubmit={handleSubmit}
        className="rise mb-8 rounded-xl border-2 border-ink bg-white p-5 shadow-hard"
      >
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl uppercase">
          {editingId ? "Ändra hålltid" : "Ny hålltid"}
        </h2>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Typ</span>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as EventType)}
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
            className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Status</span>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as EventStatus)}
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
            className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
          />
        </label>

        {message && (
          <p className="mb-3 rounded-lg border-2 border-ink bg-sun px-3 py-2 text-sm font-bold">
            {message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl border-2 border-ink bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] text-lg uppercase shadow-hard-sm transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "Sparar…" : editingId ? "Spara ändringar" : "Lägg till"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border-2 border-ink bg-paper px-4 py-2.5 font-bold transition-transform active:scale-95"
            >
              Avbryt
            </button>
          )}
        </div>
      </form>

      {/* Befintliga hålltider */}
      <h2 className="mb-3 inline-block border-b-4 border-grass pb-0.5 font-[family-name:var(--font-display)] text-2xl uppercase">
        Inlagda hålltider
      </h2>
      {events.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-ink/40 px-4 py-6 text-center font-semibold text-ink/60">
          Inga hålltider inlagda ännu.
        </p>
      ) : (
        days.map((day) => (
          <div key={day} className="mb-5">
            <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg uppercase">
              {dayFormat.format(new Date(`${day}T12:00:00`))}
            </h3>
            <ul className="space-y-2">
              {events
                .filter((e) => e.day === day)
                .map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2 shadow-hard-sm"
                  >
                    <span aria-hidden>{EVENT_META[event.type].emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
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
                    <button
                      type="button"
                      onClick={() => startEdit(event)}
                      className="rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 text-xs font-bold transition-transform active:scale-95"
                    >
                      Ändra
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(event)}
                      className="rounded-full border-2 border-ink bg-coral px-2.5 py-0.5 text-xs font-bold transition-transform active:scale-95"
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
    setForm((f) => ({ teamId: f.teamId, name: "", number: "" }));
    setPhotoFile(null);
    setFileKey((k) => k + 1); // nollställer filväljaren
  }

  function startEdit(player: Player) {
    setEditingId(player.id);
    setForm({
      teamId: player.team_id ?? "",
      name: player.name,
      number: player.number?.toString() ?? "",
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

  return (
    <section className="mt-10">
      <h2 className="mb-3 inline-block border-b-4 border-grass pb-0.5 font-[family-name:var(--font-display)] text-2xl uppercase">
        Trupperna
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-xl border-2 border-ink bg-white p-5 shadow-hard"
      >
        <h3 className="mb-4 font-[family-name:var(--font-display)] text-xl uppercase">
          {editingId ? "Ändra spelare" : "Ny spelare"}
        </h3>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Lag</span>
            <select
              value={form.teamId}
              onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
            className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
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
            className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm"
          />
        </label>

        {message && (
          <p className="mb-3 rounded-lg border-2 border-ink bg-sun px-3 py-2 text-sm font-bold">
            {message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl border-2 border-ink bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] text-lg uppercase shadow-hard-sm transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "Sparar…" : editingId ? "Spara ändringar" : "Lägg till"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border-2 border-ink bg-paper px-4 py-2.5 font-bold transition-transform active:scale-95"
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
      <h3 className="mb-2 flex items-center gap-2 font-[family-name:var(--font-display)] text-lg uppercase">
        <span
          className="inline-block h-3 w-3 rounded-full border-2 border-ink"
          style={{ backgroundColor: color ?? "var(--paper)" }}
          aria-hidden
        />
        {title} ({players.length})
      </h3>
      {players.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-ink/40 px-4 py-4 text-center text-sm font-semibold text-ink/60">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2 shadow-hard-sm"
            >
              {player.photo_url ? (
                <Image
                  src={player.photo_url}
                  alt={player.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-lg border-2 border-ink object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink bg-paper">
                  ⚽
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {player.number !== null && (
                  <strong className="mr-1.5 font-[family-name:var(--font-display)]">
                    #{player.number}
                  </strong>
                )}
                {player.name}
              </span>
              <button
                type="button"
                onClick={() => onEdit(player)}
                className="rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 text-xs font-bold transition-transform active:scale-95"
              >
                Ändra
              </button>
              <button
                type="button"
                onClick={() => onDelete(player)}
                className="rounded-full border-2 border-ink bg-coral px-2.5 py-0.5 text-xs font-bold transition-transform active:scale-95"
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
