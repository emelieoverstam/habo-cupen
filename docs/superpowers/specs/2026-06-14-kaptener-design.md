# Kaptener — design

**Datum:** 2026-06-14
**Status:** Godkänd, redo för implementationsplan

## Bakgrund och syfte

Varje lag (BK Zeros Vit och Grön, klass F2013) ska kunna ha **två utvalda kaptener**.
De delar på kaptensrollen på match (ungefär varannan match) men ansvarar gemensamt
för laget. Behov:

1. Utse två kaptener per lag.
2. Markera vem som bär bindeln (**matchkapten**) i varje matchs genomgång — visas som
   "C" på spelplanen.
3. En sida med publicerade punkter om vad lagkaptenen ansvarar för.

Ledare redigerar via `/admin` (inloggade, RLS). Spelare läser på de publika sidorna.

## Beslut (från brainstorming)

- **Matchkapten per match:** de två kaptenerna är utvalda på lagnivå; i varje matchs
  genomgång väljer ledaren vilken av dem som är kapten den matchen → "C" på planen.
- **Ansvarssida:** redigerbara punkter (admin) + lista över vilka som är kaptener i
  Vit respektive Grön. Placeras som en **sektion på Trupperna-sidan**.
- Matchkaptenen väljs bland de **två utvalda** kaptenerna (inte vilken spelare som helst).
- Ansvarspunkterna är **gemensamma för hela klubben** (samma för Vit och Grön); bara
  *vilka* kaptenerna är skiljer sig per lag.
- **Inget "C" på spelarkorten i truppen** i denna omgång (kan läggas till senare).

## Samarbetsförutsättning

Funktionen byggs ovanpå pågående, ännu icke-committat arbete i samma filer
(`briefing.ts`, `MatchPitch.tsx`, `MatchBriefing.tsx`, `AdminPanel.tsx`,
`database.ts`, samt en icke-committad migration `0008_briefing_published.sql`).
Därför: nästa migration heter **0009**, och kodändringarna lämnas **oincheckade** i
arbetsträdet för användaren att committa tillsammans med sitt eget arbete (assistenten
sköter inte git för kodfilerna). Spec- och plandokument committas isolerat.

## Datamodell (ny migration `0009_captains.sql`)

- **`players.is_captain`** `boolean not null default false` — markerar utvalda kaptener.
  "Två per lag" är en mjuk regel (admin varnar vid fler), inte en hård databasspärr.
- **`match_briefings.captain_id`** `uuid` nullable, `references players(id) on delete set null`
  — matchkaptenen för just den matchen. Visas som "C" på planen.
- **`captain_info`** — en rad med `responsibilities text` + `updated_at` (ansvarspunkterna,
  en punkt per rad, delat för hela klubben). Singleton-tabell.
- RLS som övriga tabeller: `for select using (true)`; `for all to authenticated using (true) with check (true)`.
- `is_captain` (players) och `captain_id` (match_briefings) ligger på tabeller som redan
  har broadcast-trigger (`players_broadcast`, `match_briefings_broadcast`), så "C" på
  planen uppdateras live i schemat/genomgången utan extra arbete.
- `captain_info` får en `updated_at`-trigger (`set_updated_at`) som övriga tabeller.

## Komponenter och flöden

### Utse kaptener (admin → PlayersManager)
En **"Kapten"-kryssruta** på spelarformuläret. Kaptener får en markering i spellistan.
Om ett lag får fler än två kaptener visas en diskret varning (blockeras inte).

### Matchkapten i genomgången (admin → BriefingManager)
Ett **"Matchkapten"-val**: en väljare som listar lagets utvalda kaptener som finns i
uppställningen — välj en eller ingen. Sparas som `captain_id` på genomgången.

### Visning på planen (`MatchPitch`)
`MatchPitch` tar emot vilken `captain_id` som gäller och ritar en liten "C"-bricka på
rätt spelardott (bredvid numret). Används av både admin-editorn och spelarvyn
(`MatchBriefing`) — samma komponent, samma utseende.

### Spelarvyn (`MatchBriefing`)
Skickar `captain_id` vidare till `MatchPitch`, och i startelve-listan får matchkaptenen
en liten "Kapten"-tagg bredvid namnet.

### Kaptenssektion (Trupperna-sidan)
Ett avsnitt som visar:
- **Lagets kaptener** per lag (Vit × 2, Grön × 2), härlett ur `is_captain`.
- **Ansvarspunkterna** (från `captain_info`) som punktlista.

Ansvarspunkterna redigeras i admin via en liten **`CaptainInfoManager`** (en textruta,
en punkt per rad — samma mönster som offensivt/defensivt i genomgången).

## Filer som berörs

- Ny: `supabase/migrations/0009_captains.sql`
- `src/types/database.ts` — regenereras
- `src/lib/briefing.ts` — `captain_id` finns på raden efter regen; ev. liten hjälpare
- `src/components/MatchPitch.tsx` — rita "C" på matchkaptenen
- `src/components/MatchBriefing.tsx` — C i listan + skicka `captainId` till planen
- `src/components/AdminPanel.tsx` — kapten-kryssruta (PlayersManager), matchkapten-val
  (BriefingManager), ny `CaptainInfoManager`
- Trupp-sidan (`src/app/trupperna/page.tsx` + truppkomponenten) — kaptenssektion +
  hämtning av `captain_info`
- Ev. liten delad logik för kaptener (i `briefing.ts` eller egen fil)

## Avgränsningar (YAGNI)

- Ingen automatisk varannan-match-rotation av kaptenen — ledaren väljer matchkapten manuellt.
- Ingen hård databasspärr på "max två kaptener" — mjuk varning i admin räcker.
- Inget "C" på truppens spelarkort i denna omgång.
- Ansvarspunkterna är en gemensam text, inte per lag.
