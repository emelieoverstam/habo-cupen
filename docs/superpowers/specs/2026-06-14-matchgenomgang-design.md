# Matchgenomgång — design

**Datum:** 2026-06-14
**Status:** Godkänd, redo för implementationsplan

## Bakgrund och syfte

Laget (BK Zeros, klass F2013) har en del tidiga matcher under Habo-cupen. Ledarna
vill kunna hålla matchgenomgången kvällen innan och bara köra en kort repetition på
morgonen. För att spelarna ska kunna läsa på själva om de glömt något behöver appen
en enkel matchgenomgång med:

- **Laguppställning** (start 9:a, 9 mot 9) med positioner
- Några **offensiva** punkter
- Några **defensiva** punkter

Ledare redigerar via `/admin` (inloggade, RLS-skyddat). Spelare läser på de publika
sidorna.

## Beslut (från brainstorming)

- **Visning av uppställning:** både visuell plan-vy *och* gruppera lista visas.
- **Koppling:** både mall och per match — en **mall per lag** (Vit/Grön) som
  återanvänds, plus möjlighet att finjustera **per match**. Spelarvyn visar matchens
  egen genomgång om den finns, annars lagets mall.
- **Uppställning i admin:** **fri placering** på planen (dra/placera spelare var som
  helst). Spelarna hämtas från befintliga truppen (`players`), filtrerade per lag.
- **Avbytare:** ja, övriga i truppen listas som avbytare under uppställningen.
- **Åtkomst för spelare:** både egen flik "Genomgång" i menyn *och* utfällbar
  genomgång på varje av våra matcher i Schema-fliken.

## Datamodell

Ny tabell `match_briefings`. En rad = en genomgång. Mallen är raden där `match_id`
är `null`; en matchspecifik genomgång har `match_id` satt.

| Fält | Typ | Beskrivning |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `team_id` | uuid → teams (on delete cascade) | Vilket lag (Vit/Grön) |
| `match_id` | uuid → matches (on delete cascade), **nullable** | Tom = lagets mall, satt = specifik match |
| `formation` | text, nullable | Valfri etikett, t.ex. "1-3-2-3" |
| `lineup` | jsonb, default `[]` | Placerade spelare: `[{ player_id, x, y }]`, x/y är 0–1 (andel av planens bredd/höjd) |
| `bench` | jsonb, default `[]` | Avbytare: `[player_id, …]` |
| `offensive` | text, nullable | En punkt per rad |
| `defensive` | text, nullable | En punkt per rad |
| `note` | text, nullable | Valfritt (motståndare, övrigt) |
| `created_at` | timestamptz, default `now()` | |
| `updated_at` | timestamptz, default `now()` | Sätts i appen vid sparning |

### Index och constraints

- Partiellt unikt index: en **mall** per lag — `unique (team_id) where match_id is null`.
- Partiellt unikt index: en **genomgång** per match+lag — `unique (team_id, match_id) where match_id is not null`.
- Index på `match_id` för uppslag från schemat.

### jsonb-val

Spelare lagras som id:n i jsonb och slås ihop med truppen (`players`) vid rendering.
Försvinner en spelare ur truppen hoppas hennes id bara över vid visning. Detta är ett
medvetet val: hela uppställningen sparas i ett svep och truppen är liten, så jsonb är
enklare än en separat kopplingstabell. Avvägningen är att det inte finns en hård
FK-koppling per spelare i uppställningen.

### Säkerhet (RLS)

Samma mönster som `players`:

- `enable row level security`
- `for select using (true)` — alla får läsa (spelare behöver inte vara inloggade)
- `for all to authenticated using (true) with check (true)` — inloggade ledare får ändra
- Broadcast-trigger (`broadcast_events_changes`) så spelarvyn uppdateras live.

## Admin (ny flik "Matchgenomgång" i AdminPanel)

1. Välj **lag** (Vit/Grön) → truppen hämtas.
2. Välj **mål**: "Lagets mall" eller en specifik kommande match (lista från schemat,
   våra matcher).
3. **Planeditor (fri placering):** truppen visas som en lista. Tryck på en spelare →
   hon hamnar på planen, dra (pointer events, fungerar på touch) för att placera.
   Tryck på en placerad spelare → tillbaka till bänken. Övriga i truppen ligger som
   avbytare.
4. Fält för **formation** (valfri text), **offensivt** (textarea, en rad = en punkt),
   **defensivt** (textarea), **anteckning**.
5. Knapp **"Kopiera från mall / förra matchen"** som förifyller fälten, så man slipper
   börja om kvällen innan.
6. Spara (upsert mot `match_briefings`, sätter `updated_at = now()`).

## Spelarvyn (delad komponent `MatchBriefing`)

En återanvändbar komponent som renderar en genomgång:

- **Plan-vy** överst: dottar (spelarnummer + namn) absolut placerade på en grön plan
  utifrån `lineup` x/y.
- **Listvy** under: grupperad i **Målvakt / Försvar / Mittfält / Anfall**, där gruppen
  härleds från spelarens `y`-läge på planen (nedersta spelaren = målvakt, därefter
  försvar/mittfält/anfall uppåt). Plus **avbytare** sist.
- **Offensiva** och **defensiva** punkter (en rad = en punkt).
- Visar matchens egen genomgång om den finns, annars lagets mall (fallback per lag).

Används på två ställen:

- **Egen flik "Genomgång"** i menyn → `src/app/genomgang/page.tsx`: nästa kommande
  match för klubben, med växling mellan Vit/Grön om båda har en match på gång.
- **I Schema-fliken:** varje av våra matcher får en "Matchgenomgång ▾" som fäller ut
  samma komponent inline.

## Filer som berörs

- Ny migration `supabase/migrations/0007_match_briefings.sql`
- `src/types/database.ts` — regenereras efter migrationen
- `src/components/AdminPanel.tsx` — ny flik/sektion + planeditor
- `src/components/MatchBriefing.tsx` — ny delad visningskomponent (ny fil)
- `src/components/MatchPitch.tsx` — eventuellt egen fil för plan-renderingen (delas av
  admin-editorn och visningskomponenten)
- `src/app/genomgang/page.tsx` — ny flik (ny fil)
- `src/components/SiteHeader.tsx` — ny meny-flik "Genomgång"
- `src/components/ScheduleView.tsx` — utfällbar genomgång per match

## Avgränsningar (YAGNI)

- Ingen formationsmall/automatisk utplacering — fri placering räcker.
- Ingen taktiktavla med pilar/rörelser — bara positioner + textpunkter.
- Ingen historik utöver att matchspecifika genomgångar ligger kvar per match.
