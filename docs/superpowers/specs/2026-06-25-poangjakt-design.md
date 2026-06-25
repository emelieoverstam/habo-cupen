# Poängjakt — design

**Datum:** 2026-06-25
**Status:** Godkänd, redo för implementationsplan
**Deadline:** Lördag 27 juni ~19:00 (Habo-cupen)

## Bakgrund och syfte

Lördag kväll kör laget en **poängjakt** med tjejerna. De delas in i ~5 grupper och
får en lista med uppdrag som har olika poäng. Uppdragen godkänns av ledare. Det finns
**begränsad tid (90 min)** och **fler uppdrag än man hinner** — grupperna måste
prioritera. Sidan `/poangjakt` finns redan som en teaser och ska nu bli den riktiga
funktionen.

## Beslut (från brainstorming)

- **Allt i appen:** publik nedräkning + live-scoreboard; ledare godkänner i admin.
- **Uppdragen redigeras i admin** av ledare (titel + poäng).
- **Uppdragen är ledar-låsta tills de publiceras:** en "Publicera uppdragen"-toggle
  (default av). Utloggade ser uppdragslistan först när den är publicerad; inloggade
  ledare ser den alltid (för att förbereda).
- **Godkännande är binärt** per grupp och uppdrag (klart/ej klart), inga delpoäng.
- Bygg kärnan först (uppdrag + grupper + godkännande + scoreboard), sedan timer och
  publicerings-toggle — så det viktigaste finns även om tiden blir knapp.

## Datamodell (ny migration)

Fyra små tabeller. RLS som övriga tabeller (`select using (true)`;
`all to authenticated using (true) with check (true)`). Live-uppdatering via samma
broadcast-trigger som övriga tabeller (broadcastar till `schedule`-topicen som
klienten redan kan lyssna på).

- **`quest_tasks`** — uppdragen
  `id uuid pk`, `title text not null`, `points int not null default 0`,
  `sort_hint int`, `created_at timestamptz default now()`
- **`quest_groups`** — grupperna
  `id uuid pk`, `name text not null`, `color text` (valfri), `sort_hint int`,
  `created_at`
- **`quest_completions`** — godkända uppdrag per grupp
  `id uuid pk`, `group_id uuid not null references quest_groups on delete cascade`,
  `task_id uuid not null references quest_tasks on delete cascade`, `created_at`.
  **Unikt index** på `(group_id, task_id)`. En rad = uppdraget godkänt för gruppen.
- **`quest_state`** — singleton för timer + publicering
  `id uuid pk`, `started_at timestamptz` (null = ej startad),
  `duration_minutes int not null default 90`,
  `tasks_published boolean not null default false`,
  `updated_at timestamptz default now()` (+ `set_updated_at`-trigger)

Gruppens poäng = summan av `points` för de uppdrag gruppen har en completion-rad för.

## Delad logik (`src/lib/poangjakt.ts`)

Ren logik, inga React-beroenden:
- `scoreboard(groups, tasks, completions)` → grupper sorterade på poäng (fallande),
  med totalpoäng och antal klarade uppdrag.
- `isCompleted(groupId, taskId, completions)` → boolean (för rutnätet).
- `timerView(state, now)` → `{ status: "idle" | "running" | "ended", endsAt, remainingMs }`.

## Per-sekund-klocka (`src/lib/time.ts`)

Nedräkningen visar mm:ss, så minutklockan räcker inte. Lägg till `useCurrentSecond()`
bredvid `useCurrentMinute()` — samma hydration-säkra mönster med `useSyncExternalStore`
(`getServerSnapshot = () => null`), men 1000 ms-intervall.

## Publik sida (`/poangjakt`, ersätter teasern)

Server-komponent hämtar tasks, groups, completions, state → klientvy `PoangjaktView`
(håller allt live via broadcast-kanalen). Klientvyn kollar inloggning
(`supabase.auth.getUser()`) för att avgöra om uppdragen ska visas.

Tre delar:
1. **Nedräkning** högst upp: stor mm:ss-countdown. "Inte startad än" → tickande tid →
   "⏰ Tiden är ute!". Hydration-säker (visar inget förrän klienten tickar).
2. **Scoreboard**: grupperna rankade efter poäng, live. Visar poäng + antal klarade.
3. **Uppdragslista**: alla uppdrag med poängbricka. **Visas om** `tasks_published`
   **eller** om man är inloggad ledare. Annars en platshållare ("Uppdragen avslöjas
   snart").

## Admin — ny flik "Poängjakt"

Läggs i en **egen komponentfil** (`src/components/PoangjaktManager.tsx`) som AdminPanel
renderar under en ny flik — AdminPanel är redan stor, så vi växer den inte mer.

Fyra verktyg:
1. **Timer & publicering**: status; Starta (sätter `started_at = now`) / Stoppa /
   Nollställ (`started_at = null`); justerbar `duration_minutes` (default 90);
   **"Publicera uppdragen"-toggle** (`tasks_published`).
2. **Grupper**: skapa / byt namn / ta bort (namn, valfri färg, ordning).
3. **Uppdrag**: skapa / ändra / ta bort (titel, poäng, ordning).
4. **Godkännande-rutnät**: rader = uppdrag, kolumner = grupper. En ruta visar bock om
   gruppen klarat uppdraget; tryck växlar (infogar/tar bort completion-rad) → poängen
   tickar direkt i scoreboarden. Byggt för snabb hantering live under kvällen.

## Filer

- Ny migration `supabase/migrations/00NN_poangjakt.sql` (nästa lediga nummer) + regen typer
- Ny: `src/lib/poangjakt.ts` (poäng-/timerlogik)
- `src/lib/time.ts` — ny `useCurrentSecond`
- Ersätter: `src/app/poangjakt/page.tsx` (server, hämtar data) + ny `src/components/PoangjaktView.tsx`
- Ny: `src/components/PoangjaktManager.tsx` (admin-verktygen)
- `src/components/AdminPanel.tsx` — ny "Poängjakt"-flik som renderar `PoangjaktManager`
- `src/app/admin/page.tsx` — hämtar poängjakt-data och skickar in

## Avgränsningar (för att hinna)

- Ingen inloggning för tjejerna; bara ledare godkänner. Ingen "min grupp"-vy med egna bockar.
- Inga kategorier på uppdrag, ingen historik mellan år, ingen delpoäng.
- Timern är en gemensam nedräkning (inte per grupp).
