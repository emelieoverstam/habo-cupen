# Design: Notiser (anslagstavla) under cupen

**Datum:** 2026-06-25
**Projekt:** F13 / Habo-cupen 2026
**Status:** Godkänd design — redo för implementationsplan

## Bakgrund

Ledarna vill kunna lägga ut korta meddelanden/påminnelser under cuphelgen
(t.ex. "Samling vid bussen 17:00", "Glöm inte vattenflaskan"). Föräldrar och
spelare ska se dem i appen utan att logga in.

## Beslut (från brainstorm)

- **Kärna:** En anslagstavla där ledarna skriver *fria* notiser. Inga
  automatiska påminnelser från schemat.
- **Leverans:** I appen (ingen äkta push). Live-uppdatering via befintlig
  realtime-broadcast.
- **Målgrupp:** Alla ser allt. En notis kan dock *märkas* för ett specifikt lag
  (`team_id`) eller båda — chipet är en etikett, inte ett filter (appen täcker
  båda lagen).
- **Livslängd:** Allt sparas, men appen visar bara de senaste (5 i bannern,
  upp till 20 hämtas). Ledare kan ta bort manuellt. Inget utgångsdatum.
- **Nytt-markering:** Olästa notiser märks med en prick/räknare, sparat per
  enhet i localStorage (samma teknik som packlistans avbockning). Ingen
  inloggning krävs för läsare.
- **Placering:** Diskret banner högst upp på startsidan som expanderar vid tryck.

## Vald arkitektur

Egen `notices`-tabell som speglar `events`, med broadcast-trigger på den
befintliga `schedule`-topicen. Dashboarden uppdateras då live via det redan
existerande `useScheduleLive` utan ny realtime-kanal.

Förkastade alternativ:
- **Återanvänd `events` med typ `notis`:** dålig passform — schemats tidslinje,
  "Härnäst" och sortering på `starts_at` utgår från att events är tidpunkter.
- **Egen realtime-topic `notices`:** kräver andra kanalprenumeration + egen
  RLS-policy på `realtime.messages` utan praktisk vinst.

## 1. Datamodell

Ny migration `supabase/migrations/0014_notices.sql`:

```sql
create table notices (
    id uuid primary key default gen_random_uuid(),
    team_id uuid references teams(id) on delete cascade,  -- null = båda lagen
    body text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index notices_created_idx on notices (created_at desc);

alter table notices enable row level security;
create policy "Alla får läsa notiser" on notices for select using (true);
create policy "Inloggade får ändra notiser" on notices
    for all to authenticated using (true) with check (true);

create trigger notices_updated_at before update on notices
    for each row execute function set_updated_at();
create trigger notices_broadcast after insert or update or delete on notices
    for each row execute function broadcast_events_changes();  -- topic "schedule"
```

Återanvänder den generiska `broadcast_events_changes()`. Ingen
`publication`-ändring behövs (projektet kör broadcast, inte postgres_changes).

## 2. Banner-komponent (`src/components/NoticeBanner.tsx`)

Diskret rad högst upp på dashboarden (under `SiteHeader`, ovanför
"Härnäst"-kortet).

- **Hopfällt:** tunn pill-rad — `📣` + senaste notisens text (trunkerad) +
  relativ tid. Olästa → liten prick + räknare. Inga notiser → renderar `null`.
- **Utfällt (tryck):** panel med de senaste 5 notiserna, nyast först. Per rad:
  text, tidsstämpel, och en lag-chip (lagets färg + namn) om `team_id` är satt;
  inget chip = båda lagen. Tryck igen fäller ihop.
- Notiser kommer som `initialNotices` från `src/app/page.tsx` och hämtas om i
  Dashboardens befintliga `refresh()`. Live sker via `useScheduleLive`.

## 3. Nytt-markering (localStorage)

- Liten store med `useSyncExternalStore` + `getServerSnapshot = () => "[]"`
  (hydration-säkert; undviker ESLint-regeln `react-hooks/set-state-in-effect`).
- Nyckel `habocupen-notiser-sedda` = JSON-array av sedda notis-`id`. En notis är
  "ny" om id saknas i mängden.
- När bannern fälls ut markeras de visade notiserna som sedda. Id-baserat →
  robust mot redigering/borttagning.

## 4. Admin-flik "Notiser"

- Ny flik i `AdminPanel` (`TABS` får `{ id: "notices", label: "Notiser" }`) och
  en `NoticeManager` som följer `EventManager`-mönstret:
  - Formulär: textarea (required) + lag-väljare (`Båda lagen` / lag) + "Lägg
    till". Vid redigering: "Spara ändringar" + "Avbryt".
  - Lista nyast först: text, tid, lag-chip, "Ändra" / "Ta bort"
    (`window.confirm`). `loadData()` efter spara/ta bort.
- Skrivning kräver inloggning (RLS).

## 5. Datatyper & felhantering

- `src/types/database.ts`: lägg till `notices`-typen (genereras om via Supabase
  eller manuellt i samma stil). `Tables<"notices">` används i Dashboard, banner
  och admin.
- Admin visar `message` vid spara/ta bort-fel (`Kunde inte spara: …`).
- På lässidan är notiser icke-kritiska: failar hämtningen visas ingen banner
  (tyst degradering, som dashboardens övriga kort).
- Inga tester finns i projektet → ingen ny testsvit. Verifiering manuellt.

## Filer

- **Nya:** `supabase/migrations/0014_notices.sql`, `src/components/NoticeBanner.tsx`
- **Ändras:** `src/app/page.tsx`, `src/components/Dashboard.tsx`,
  `src/components/AdminPanel.tsx`, `src/app/admin/page.tsx`,
  `src/types/database.ts`

## Medvetet bortvalt (YAGNI)

Push-notiser, utgångsdatum, läskvitton per person, författarnamn på notisen.
Kan läggas till senare.

## Manuell verifiering

1. Skapa notis i admin → syns live på startsidan (annan enhet/flik).
2. Nytt-prick + räknare visas; försvinner efter utfällning.
3. Lag-chip stämmer (specifikt lag vs båda).
4. Redigera/ta bort i admin → speglas på startsidan.
5. localStorage avstängt (privat läge) → bannern funkar ändå, allt räknas som nytt.
