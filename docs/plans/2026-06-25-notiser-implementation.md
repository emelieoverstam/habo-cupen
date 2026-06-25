# Notiser (anslagstavla) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Låt ledare posta korta fria notiser i admin som visas live i en diskret, expanderbar banner högst upp på startsidan, med "nytt"-markering per enhet.

**Architecture:** Egen `notices`-tabell som speglar `events`, med en broadcast-trigger på den befintliga `schedule`-topicen så att dashboarden uppdateras live via det redan existerande `useScheduleLive`. Lässidan är en klientkomponent som markerar sedda notiser i localStorage (samma teknik som packlistan). Författande sker i en ny admin-flik byggd som `EventManager`.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + RLS + Realtime broadcast), Tailwind CSS, TypeScript.

## Global Constraints

- All användarvänd text på svenska; korrekt å/ä/ö. Kommentarer på svenska.
- Funktions-/variabelnamn på engelska, tekniska termer på engelska.
- Indentering 2 spaces (TS/TSX). SQL-filer följer befintlig stil (tabs, som övriga migrationer).
- Inga nya beroenden. Inget test-ramverk finns — verifiering sker via `npx tsc --noEmit`, `npm run lint`, `npm run build` och manuell kontroll.
- RLS på alla nya tabeller: öppen läsning, skrivning endast `authenticated`.
- Realtime sker via **broadcast** (inte `postgres_changes`). Återanvänd `broadcast_events_changes()` → topic `schedule`.
- Hydration-säker localStorage: `useSyncExternalStore` med `getServerSnapshot = () => "[]"` (undvik ESLint `react-hooks/set-state-in-effect`).
- Designkälla: `docs/plans/2026-06-25-notiser-design.md`. Färg-/typsnittsklasser ska matcha befintliga komponenter (`bg-white`, `shadow-card`, `shadow-chip`, `bg-falu`, `text-ink/55`, `font-[family-name:var(--font-display)]` m.fl.).
- Git: committa lokalt efter varje task. Pusha aldrig utan att be om lov.

---

### Task 1: Databasmigration + datatyper för `notices`

**Files:**
- Create: `supabase/migrations/0014_notices.sql`
- Modify: `src/types/database.ts` (lägg till `notices` under `public.Tables`, alfabetiskt nära `match_briefings`)

**Interfaces:**
- Produces: tabellen `notices` med kolumnerna `id uuid`, `team_id uuid | null`, `body text`, `created_at timestamptz`, `updated_at timestamptz`. TS-typen nås via `Tables<"notices">` (Row), `TablesInsert<"notices">` etc.

- [ ] **Step 1: Skapa migrationsfilen**

`supabase/migrations/0014_notices.sql`:

```sql
-- Notiser: en anslagstavla där ledarna postar korta meddelanden under cupen.
-- team_id = null betyder att notisen gäller båda lagen (etikett, inte filter).

create table notices (
	id uuid primary key default gen_random_uuid(),
	team_id uuid references teams(id) on delete cascade,
	body text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index notices_created_idx on notices (created_at desc);

alter table notices enable row level security;

create policy "Alla får läsa notiser" on notices
	for select using (true);

create policy "Inloggade får ändra notiser" on notices
	for all to authenticated using (true) with check (true);

-- Håll updated_at aktuell vid ändringar (samma mönster som events)
create trigger notices_updated_at
	before update on notices
	for each row execute function set_updated_at();

-- Live-uppdatering: sänd ändringar till schemakanalen (återanvänder den
-- generiska broadcast-funktionen). Ingen publication-ändring behövs.
create trigger notices_broadcast
	after insert or update or delete on notices
	for each row execute function broadcast_events_changes();
```

- [ ] **Step 2: Applicera migrationen mot Supabase-projektet**

Använd Supabase MCP `apply_migration` (name: `0014_notices`, query = filinnehållet) eller `supabase db push` om CLI används. Tabellen är additiv och tom → låg risk, men gör en snabb DB-backup först om projektets rutin kräver det.

Verifiera att tabellen finns: `list_tables` (MCP) eller `select * from notices;` (förväntat: 0 rader, inga fel).

- [ ] **Step 3: Lägg till `notices`-typen i `src/types/database.ts`**

Föredra regenerering: Supabase MCP `generate_typescript_types` och ersätt filen. Om manuellt — lägg in detta block under `public.Tables` (samma stil som `events`):

```ts
      notices: {
        Row: {
          body: string
          created_at: string
          id: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 4: Verifiera att typen kompilerar**

Run: `npx tsc --noEmit`
Expected: Inga nya fel relaterade till `notices`. (Förbefintliga fel i orörda filer ignoreras, men notera dem.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0014_notices.sql src/types/database.ts
git commit -m "Lägger till notices-tabell med broadcast och datatyp"
```

---

### Task 2: Banner-komponent med localStorage-"nytt"

**Files:**
- Create: `src/components/NoticeBanner.tsx`

**Interfaces:**
- Consumes: `Tables<"notices">` och `Tables<"teams">` (Task 1), `useCurrentMinute` från `@/lib/time`, `TeamMarker` från `@/components/TeamMarker`.
- Produces: default export `NoticeBanner({ notices, teams }: { notices: Tables<"notices">[]; teams: Tables<"teams">[] })`. Returnerar `null` när `notices` är tom.

- [ ] **Step 1: Skriv komponenten**

`src/components/NoticeBanner.tsx`:

```tsx
"use client";

// Diskret notis-banner högst upp på startsidan. Hopfälld visar senaste
// notisen; utfälld visar de senaste fem. Olästa märks med en räknare —
// vilka som setts sparas per enhet i localStorage (samma teknik som
// packlistans avbockning, hydration-säkert via useSyncExternalStore).

import { useMemo, useState, useSyncExternalStore } from "react";
import TeamMarker from "@/components/TeamMarker";
import { useCurrentMinute } from "@/lib/time";
import type { Tables } from "@/types/database";

type Notice = Tables<"notices">;
type Team = Tables<"teams">;

const STORAGE_KEY = "habocupen-notiser-sedda";
const MAX_SHOWN = 5;

/* Liten localStorage-store för sedda notis-id. Servern ser inga sedda
   (getServerSnapshot = "[]"), klienten läser sparat läge efter hydrering. */
let listeners: (() => void)[] = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function markSeen(ids: string[]) {
  const seen = new Set<string>(JSON.parse(getSnapshot()));
  let changed = false;
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // localStorage kan vara avstängt (privat läge) — bannern funkar ändå
  }
  listeners.forEach((l) => l());
}

const absoluteFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});
const relativeFormat = new Intl.RelativeTimeFormat("sv-SE", { numeric: "auto" });

/* Relativ tid när vi vet "nu" (efter hydrering), annars absolut tid. */
function formatTime(iso: string, nowMs: number | null): string {
  if (nowMs === null) return absoluteFormat.format(new Date(iso));
  const min = Math.round((nowMs - new Date(iso).getTime()) / 60000);
  if (min < 1) return "nyss";
  if (min < 60) return relativeFormat.format(-min, "minute");
  const hours = Math.round(min / 60);
  if (hours < 24) return relativeFormat.format(-hours, "hour");
  return absoluteFormat.format(new Date(iso));
}

export default function NoticeBanner({
  notices,
  teams,
}: {
  notices: Notice[];
  teams: Team[];
}) {
  const now = useCurrentMinute();
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const seen = useMemo(() => new Set<string>(JSON.parse(raw)), [raw]);
  const [open, setOpen] = useState(false);

  // Nyast först, kapad till de senaste
  const recent = useMemo(
    () =>
      [...notices]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, MAX_SHOWN),
    [notices]
  );

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  if (recent.length === 0) return null;

  const unseen = recent.filter((n) => !seen.has(n.id));
  const latest = recent[0];
  const nowMs = now?.getTime() ?? null;

  function toggle() {
    const next = !open;
    setOpen(next);
    // När man öppnar bannern räknas de visade notiserna som sedda
    if (next) markSeen(recent.map((n) => n.id));
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-left shadow-card transition-transform active:scale-[0.99]"
      >
        <span aria-hidden className="shrink-0 text-base">
          📣
        </span>
        {open ? (
          <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.25em] text-ink/50">
            Notiser
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {latest.body}
          </span>
        )}
        {!open && unseen.length > 0 && (
          <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-falu px-1.5 text-[11px] font-bold text-paper">
            {unseen.length}
          </span>
        )}
        <span aria-hidden className="shrink-0 text-xs text-ink/40">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {recent.map((n) => (
            <li
              key={n.id}
              className="rounded-xl bg-white px-4 py-3 shadow-chip"
            >
              <p className="whitespace-pre-wrap text-sm font-semibold">
                {n.body}
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-xs text-ink/55">
                <TeamMarker
                  team={n.team_id ? teamById.get(n.team_id) : undefined}
                />
                <span aria-hidden>·</span>
                <span>{formatTime(n.created_at, nowMs)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifiera typer och lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Inga fel i `src/components/NoticeBanner.tsx`. Särskilt ingen `react-hooks/set-state-in-effect` (vi använder ingen `useEffect` för state).

- [ ] **Step 3: Commit**

```bash
git add src/components/NoticeBanner.tsx
git commit -m "Lägger till notis-banner med nytt-markering"
```

---

### Task 3: Koppla in notiser på startsidan (server-fetch + Dashboard)

**Files:**
- Modify: `src/app/page.tsx` (hämta notiser, skicka `initialNotices`)
- Modify: `src/components/Dashboard.tsx` (ny prop, state, refresh-fetch, rendera bannern)

**Interfaces:**
- Consumes: `NoticeBanner` (Task 2), `Tables<"notices">` (Task 1).
- Produces: `Dashboard` tar emot ny prop `initialNotices: Tables<"notices">[]`.

- [ ] **Step 1: Hämta notiser i `src/app/page.tsx`**

Lägg till hämtningen i `Promise.all`-arrayen och destructuringen, och skicka in prop:en. Resultat:

```tsx
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const supabase = await createClient();

  const [
    { data: teams },
    { data: events },
    { data: matches },
    { data: standings },
    { data: players },
    { data: notices },
  ] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("events")
      .select("*")
      .order("day")
      .order("starts_at", { nullsFirst: false }),
    supabase.from("matches").select("*").order("starts_at"),
    supabase.from("standings").select("*").order("position"),
    supabase
      .from("players")
      .select("*")
      .order("number", { nullsFirst: false }),
    supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <Dashboard
      initialTeams={teams ?? []}
      initialEvents={events ?? []}
      initialMatches={matches ?? []}
      initialStandings={standings ?? []}
      initialPlayers={players ?? []}
      initialNotices={notices ?? []}
    />
  );
}
```

- [ ] **Step 2: Lägg till typ, prop och state i `src/components/Dashboard.tsx`**

Lägg till typ-aliaset (nära de övriga, ca rad 23):

```tsx
type Notice = Tables<"notices">;
```

Lägg till i `Props` (efter `initialPlayers`):

```tsx
  initialPlayers: Player[];
  initialNotices: Notice[];
```

Ta emot prop:en i destructureringen (efter `initialPlayers`):

```tsx
  initialPlayers,
  initialNotices,
```

Lägg till state (efter `const [players, setPlayers] = useState(initialPlayers);`):

```tsx
  const [notices, setNotices] = useState(initialNotices);
```

- [ ] **Step 3: Hämta om notiser i `refresh()` i `src/components/Dashboard.tsx`**

Utöka `Promise.all` i `refresh` med en notis-hämtning och sätt state. Den uppdaterade `refresh`:

```tsx
  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [eventsRes, matchesRes, standingsRes, playersRes, noticesRes] =
      await Promise.all([
        supabase.from("events").select("*"),
        supabase.from("matches").select("*"),
        supabase.from("standings").select("*").order("position"),
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
    if (standingsRes.data) setStandings(standingsRes.data);
    if (playersRes.data) setPlayers(playersRes.data);
    if (noticesRes.data) setNotices(noticesRes.data);
  }, []);
```

- [ ] **Step 4: Importera och rendera bannern i `src/components/Dashboard.tsx`**

Lägg till importen bland komponentimporterna (nära `import SiteHeader`):

```tsx
import NoticeBanner from "@/components/NoticeBanner";
```

Rendera bannern direkt efter `<SiteHeader active="hem" />` och före `<div className="space-y-4">`:

```tsx
      <SiteHeader active="hem" />

      <NoticeBanner notices={notices} teams={teams} />

      <div className="space-y-4">
```

- [ ] **Step 5: Verifiera typer, lint och bygge**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: Bygget går igenom. Inga fel i `page.tsx` eller `Dashboard.tsx`.

- [ ] **Step 6: Manuell verifiering (live + nytt-markering)**

1. `npm run dev`, öppna `/`. Med 0 notiser i DB: ingen banner syns.
2. Lägg in en rad via SQL/Supabase: `insert into notices (body) values ('Testnotis – samling 17:00');`
3. Inom någon sekund (eller efter reload): bannern dyker upp med texten och en räknare `1`.
4. Tryck på bannern → den fälls ut, visar notisen med "Båda lagen" + relativ tid. Räknaren försvinner.
5. Ladda om sidan → ingen räknare (sedd sparad i localStorage). Lägg in en till notis → räknaren visar `1` igen.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/Dashboard.tsx
git commit -m "Visar notis-banner på startsidan med live-uppdatering"
```

---

### Task 4: Admin-flik för att skriva notiser

**Files:**
- Modify: `src/app/admin/page.tsx` (hämta notiser, skicka `initialNotices`)
- Modify: `src/components/AdminPanel.tsx` (ny flik, ny prop, `NoticeManager`-komponent)

**Interfaces:**
- Consumes: `Tables<"notices">` (Task 1), `createClient`, `useState`, `useMemo`, `useCallback`, `Tables` (alla redan importerade i `AdminPanel.tsx`), `Team`-aliaset (definierat i `AdminPanel.tsx`).
- Produces: `AdminPanel` tar emot ny prop `initialNotices: Tables<"notices">[]`. Ny flik `{ id: "notices", label: "Notiser" }`.

- [ ] **Step 1: Hämta notiser i `src/app/admin/page.tsx`**

Lägg till en hämtning i `Promise.all` och destructuringen, och skicka in prop:en till `<AdminPanel>`. Lägg till i arrayen (t.ex. efter `profiles`-hämtningen):

```tsx
    supabase.from("notices").select("*").order("created_at", { ascending: false }),
```

Lägg till i destructureringen (matchande position):

```tsx
    { data: notices },
```

Lägg till prop:en i JSX:en:

```tsx
      initialNotices={notices ?? []}
```

- [ ] **Step 2: Lägg till flik och prop i `AdminPanel`**

I `AdminPanel.tsx`, utöka `AdminTab`-typen och `TABS`:

```tsx
type AdminTab = "events" | "players" | "briefings" | "notices";
const TABS: { id: AdminTab; label: string }[] = [
  { id: "events", label: "Hålltider" },
  { id: "players", label: "Trupperna" },
  { id: "briefings", label: "Genomgång" },
  { id: "notices", label: "Notiser" },
];
```

Lägg till prop:en i `AdminPanel`-signaturen (i både destructurering och typobjektet), bredvid `initialProfiles`:

```tsx
  initialProfiles,
  initialNotices,
```
```tsx
  initialProfiles: Profile[];
  initialNotices: Tables<"notices">[];
```

Rendera den nya fliken efter `briefings`-blocket i `AdminPanel`:

```tsx
          {tab === "notices" && (
            <NoticeManager
              supabase={supabase}
              initialNotices={initialNotices}
              initialTeams={initialTeams}
            />
          )}
```

- [ ] **Step 3: Lägg till `NoticeManager`-komponenten i `AdminPanel.tsx`**

Lägg till längst ned i filen (efter `CaptainInfoManager`):

```tsx
// ---- Notiser -----------------------------------------------------------

const noticeTimeFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

/* Anslagstavla: ledaren skriver fria notiser som kan gälla båda lagen eller
   ett specifikt lag. Speglar EventManager-mönstret. */
function NoticeManager({
  supabase,
  initialNotices,
  initialTeams,
}: {
  supabase: ReturnType<typeof createClient>;
  initialNotices: Tables<"notices">[];
  initialTeams: Team[];
}) {
  const [notices, setNotices] = useState<Tables<"notices">[]>(initialNotices);
  const [teams] = useState<Team[]>(initialTeams);
  const [body, setBody] = useState("");
  const [teamId, setTeamId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setNotices(data);
  }, [supabase]);

  function resetForm() {
    setEditingId(null);
    setBody("");
    setTeamId("");
  }

  function startEdit(notice: Tables<"notices">) {
    setEditingId(notice.id);
    setBody(notice.body);
    setTeamId(notice.team_id ?? "");
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    const payload = { body: body.trim(), team_id: teamId || null };

    const { error } = editingId
      ? await supabase.from("notices").update(payload).eq("id", editingId)
      : await supabase.from("notices").insert(payload);

    if (error) {
      setMessage(`Kunde inte spara: ${error.message}`);
    } else {
      setMessage(editingId ? "Notisen är uppdaterad." : "Notisen är tillagd.");
      resetForm();
      await loadData();
    }
    setBusy(false);
  }

  async function handleDelete(notice: Tables<"notices">) {
    if (!window.confirm("Ta bort notisen?")) return;
    const { error } = await supabase
      .from("notices")
      .delete()
      .eq("id", notice.id);
    if (error) {
      setMessage(`Kunde inte ta bort: ${error.message}`);
    } else {
      if (editingId === notice.id) resetForm();
      await loadData();
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="rise mb-8 rounded-xl bg-white p-5 shadow-card"
      >
        <h2 className="mb-4 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          {editingId ? "Ändra notis" : "Ny notis"}
        </h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">Meddelande</span>
          <textarea
            required
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="t.ex. Samling vid bussen 17:00 – glöm inte vattenflaskan!"
            className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-bold">Gäller</span>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
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

      <h2 className="mb-3 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
        Inlagda notiser
      </h2>
      {notices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-paper/30 px-4 py-6 text-center font-semibold text-paper/70">
          Inga notiser inlagda ännu.
        </p>
      ) : (
        <ul className="space-y-2">
          {notices.map((notice) => {
            const team = notice.team_id
              ? teamById.get(notice.team_id)
              : undefined;
            return (
              <li
                key={notice.id}
                className="rounded-xl bg-white px-3 py-2.5 shadow-chip"
              >
                <p className="text-sm font-semibold whitespace-pre-wrap">
                  {notice.body}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-ink/55">
                    {team ? team.name : "Båda lagen"} ·{" "}
                    {noticeTimeFormat.format(new Date(notice.created_at))}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(notice)}
                    className="ml-auto rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold transition-transform active:scale-95"
                  >
                    Ändra
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(notice)}
                    className="rounded-full bg-falu px-2.5 py-0.5 text-xs font-bold text-paper transition-transform active:scale-95"
                  >
                    Ta bort
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 4: Verifiera typer, lint och bygge**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: Bygget går igenom. Inga fel i `admin/page.tsx` eller `AdminPanel.tsx`.

- [ ] **Step 5: Manuell verifiering (end-to-end)**

1. `npm run dev`, gå till `/admin`, logga in.
2. Fliken "Notiser" syns. Skriv ett meddelande, välj "Båda lagen", "Lägg till" → bekräftelse + raden dyker upp i listan.
3. Öppna `/` i en annan flik/enhet → bannern uppdateras live med notisen och en räknare.
4. I admin: "Ändra" en notis, spara → texten uppdateras på startsidan. "Ta bort" (bekräfta) → försvinner.
5. Skapa en notis riktad till ett specifikt lag → lag-chipet på startsidan visar lagets färg/namn.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/page.tsx src/components/AdminPanel.tsx
git commit -m "Lägger till admin-flik för notiser"
```

---

## Self-Review

**Spec coverage:**
- Datamodell (design §1) → Task 1.
- Banner-komponent (design §2) → Task 2 (komponent) + Task 3 (placering/wiring).
- Nytt-markering localStorage (design §3) → Task 2.
- Admin-flik (design §4) → Task 4.
- Datatyper & felhantering (design §5) → Task 1 (typ), felhantering i Task 4 (`message`) och Task 3 (tyst degradering: ingen banner när data saknas, eftersom `notices ?? []`).
- Live-uppdatering → Task 1 (broadcast-trigger) + Task 3 (refresh i `useScheduleLive`).
- Manuell verifiering (design) → steg i Task 3 och Task 4.

**Placeholder-scan:** Inga TBD/TODO. All kod är komplett och kopierbar.

**Type-konsekvens:** `NoticeBanner({ notices, teams })` används identiskt i Task 2 och Task 3. `initialNotices`-prop:en heter likadant i `page.tsx`, `admin/page.tsx`, `Dashboard` och `AdminPanel`. `NoticeManager`-props (`supabase`, `initialNotices`, `initialTeams`) matchar anropet i Task 4 Step 2. `Tables<"notices">`-formen är konsekvent mellan Task 1 och konsumenterna.

**Noterat för implementeraren:** `admin/page.tsx` skickar redan in quest-props (`initialQuestTasks` m.fl.). Om `AdminPanel`-signaturen avviker från utdraget ovan: lägg bara till `initialNotices` bland de befintliga props:en utan att röra övriga. Rör inga orörda quest-relaterade fält.
