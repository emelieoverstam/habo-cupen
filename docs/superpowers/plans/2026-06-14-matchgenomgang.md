# Matchgenomgång Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ledare bygger en matchgenomgång (laguppställning med fri placering på planen, avbytare, offensiva/defensiva punkter) per lag som mall och per match; spelare läser den i en egen "Genomgång"-flik och utfällt på varje match i schemat.

**Architecture:** Ny tabell `match_briefings` (en mall per lag där `match_id` är null, en rad per match annars). Uppställningen lagras som jsonb (`lineup` = placerade spelare med x/y 0–1, `bench` = avbytare-id). Ren logik (fallback mall↔match, gruppering av listan utifrån y-läge, textpunkter) ligger i `src/lib/briefing.ts`. En delad render-komponent (`MatchPitch` + `MatchBriefing`) används av både spelarvyn och admin. Allt skrivs från klienten som inloggad ledare (RLS), och en broadcast-trigger gör att schemat/genomgången uppdateras live.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase (Postgres + RLS + Realtime broadcast).

**Testing note:** Projektet har inget testramverk (endast `npm run lint`). Verifiering sker därför med `npm run lint`, `npm run build` och manuell test i webbläsaren (`npm run dev`). Att införa ett testramverk är utanför scope för den här funktionen. Logiken i `src/lib/briefing.ts` skrivs som rena funktioner så att den är lätt att granska och typkollas av bygget.

**Pre-flight (gäller alla tasks):** AGENTS.md säger att den här Next.js-versionen har brytande ändringar. Läs relevant guide i `node_modules/next/dist/docs/` innan du skapar en ny route/page (t.ex. App Router page/metadata). Skriv svensk text i UI och kommentarer (med å/ä/ö), engelska för kod-identifierare. Indentera med 2 mellanslag (TS/React).

---

## Filöversikt

| Fil | Ansvar | Skapas/Ändras |
|---|---|---|
| `supabase/migrations/0007_match_briefings.sql` | Tabell, index, RLS, broadcast-trigger | Skapas |
| `src/types/database.ts` | Genererade typer (inkl. `match_briefings`) | Regenereras |
| `src/lib/briefing.ts` | Typer + ren logik (fallback, gruppering, textpunkter) | Skapas |
| `src/components/MatchPitch.tsx` | Renderar planen med utplacerade spelare (läsläge + editläge) | Skapas |
| `src/components/MatchBriefing.tsx` | Spelarvyns visning: plan + lista + avbytare + punkter | Skapas |
| `src/app/genomgang/page.tsx` | Server-sida som hämtar data till "Genomgång"-fliken | Skapas |
| `src/components/GenomgangView.tsx` | Klientvy: väljer nästa match per lag, växlar Vit/Grön | Skapas |
| `src/components/SiteHeader.tsx` | Lägger till menyfliken "Genomgång" | Ändras |
| `src/components/ScheduleView.tsx` | Utfällbar genomgång per match + nya props | Ändras |
| `src/app/schema/page.tsx` | Skickar in spelare + genomgångar till ScheduleView | Ändras |
| `src/components/AdminPanel.tsx` | Ny sektion `BriefingManager` (planeditor + sparning) | Ändras |
| `src/app/admin/page.tsx` | Hämtar matcher + genomgångar till admin | Ändras |

---

## Task 1: Databasmigration + typer

**Files:**
- Create: `supabase/migrations/0007_match_briefings.sql`
- Modify: `src/types/database.ts` (regenereras)

- [ ] **Step 1: Skriv migrationen**

Skapa `supabase/migrations/0007_match_briefings.sql`:

```sql
-- Matchgenomgångar: en mall per lag (match_id är null) och en rad per match.
-- Uppställningen lagras som jsonb: lineup = placerade spelare med x/y (0–1),
-- bench = avbytarnas spelar-id. Offensiva/defensiva punkter lagras som text
-- där en rad = en punkt.

create table match_briefings (
	id uuid primary key default gen_random_uuid(),
	team_id uuid not null references teams(id) on delete cascade,
	match_id uuid references matches(id) on delete cascade,
	formation text,
	lineup jsonb not null default '[]'::jsonb,
	bench jsonb not null default '[]'::jsonb,
	offensive text,
	defensive text,
	note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- En mall per lag (raden där match_id är null)
create unique index match_briefings_template_idx
	on match_briefings (team_id)
	where match_id is null;

-- En genomgång per match och lag
create unique index match_briefings_match_idx
	on match_briefings (team_id, match_id)
	where match_id is not null;

-- Uppslag från schemat
create index match_briefings_match_lookup_idx on match_briefings (match_id);

alter table match_briefings enable row level security;

create policy "Alla får läsa matchgenomgångar" on match_briefings
	for select using (true);

create policy "Inloggade får ändra matchgenomgångar" on match_briefings
	for all to authenticated using (true) with check (true);

-- Live-uppdatering till schemakanalen även för genomgångar
create trigger match_briefings_broadcast
	after insert or update or delete on match_briefings
	for each row execute function broadcast_events_changes();
```

- [ ] **Step 2: Applicera migrationen mot Supabase-projektet**

Använd Supabase MCP-verktyget `apply_migration` med namn `0007_match_briefings` och SQL:en ovan (eller `supabase db push` om lokal CLI används). Verifiera efteråt med MCP `list_tables` att `match_briefings` finns med rätt kolumner.

Expected: tabellen `match_briefings` listas i schema `public`.

- [ ] **Step 3: Kontrollera RLS-rådgivare**

Kör Supabase MCP `get_advisors` med type `security`.
Expected: inga nya varningar om `match_briefings` (RLS är aktiverat och policys finns).

- [ ] **Step 4: Regenerera TypeScript-typerna**

Kör Supabase MCP `generate_typescript_types` och skriv resultatet till `src/types/database.ts` (ersätt hela filen). Filen har redan kommentaren "Regenerera vid schemaändringar — redigera inte för hand", så hela innehållet ska bytas ut mot det genererade.

Verifiera att `match_briefings` nu finns i `Database["public"]["Tables"]`.

- [ ] **Step 5: Bygg för att typkolla**

Run: `npm run build`
Expected: bygget lyckas (inga TS-fel). Om `next build` klagar på saknade env-variabler, kör i stället `npx tsc --noEmit` för enbart typkontroll.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_match_briefings.sql src/types/database.ts
git commit -m "Lägger till tabell match_briefings med RLS och broadcast"
```

---

## Task 2: Delad logik och typer (`src/lib/briefing.ts`)

Ren logik, inga React-beroenden. Allt här går att resonera om isolerat.

**Files:**
- Create: `src/lib/briefing.ts`

- [ ] **Step 1: Skriv typer och hjälpfunktioner**

Skapa `src/lib/briefing.ts`:

```ts
// Delade typer och ren logik för matchgenomgångar. Inga React-beroenden —
// hålls separat så att fallback, gruppering och textpunkter är lätta att läsa.

import type { Tables } from "@/types/database";

export type Player = Tables<"players">;
type BriefingRow = Tables<"match_briefings">;

// En placerad spelare på planen. x/y är 0–1 (andel av planens bredd/höjd),
// där y=0 är längst upp (motståndarmål) och y=1 längst ner (eget mål).
export type LineupSlot = { player_id: string; x: number; y: number };

// Typad vy av en genomgång där jsonb-fälten är uttolkade.
export type Briefing = Omit<BriefingRow, "lineup" | "bench"> & {
  lineup: LineupSlot[];
  bench: string[];
};

/* Tolka en rad från databasen (jsonb kommer som Json) till en typad Briefing. */
export function parseBriefing(row: BriefingRow): Briefing {
  return {
    ...row,
    lineup: Array.isArray(row.lineup) ? (row.lineup as unknown as LineupSlot[]) : [],
    bench: Array.isArray(row.bench) ? (row.bench as unknown as string[]) : [],
  };
}

/* Välj rätt genomgång för en match: matchens egen om den finns, annars lagets
   mall (raden där match_id är null). Returnerar null om ingen finns. */
export function pickBriefing(
  briefings: Briefing[],
  teamId: string,
  matchId: string | null
): Briefing | null {
  if (matchId) {
    const own = briefings.find(
      (b) => b.team_id === teamId && b.match_id === matchId
    );
    if (own) return own;
  }
  return (
    briefings.find((b) => b.team_id === teamId && b.match_id === null) ?? null
  );
}

// Y-banden som översätter en placering på planen till en listrubrik.
export type LineRole = "Målvakt" | "Försvar" | "Mittfält" | "Anfall";

/* Härled listrubrik från spelarens y-läge på planen. */
export function roleFromY(y: number): LineRole {
  if (y > 0.72) return "Målvakt";
  if (y > 0.48) return "Försvar";
  if (y > 0.28) return "Mittfält";
  return "Anfall";
}

export const LINE_ORDER: LineRole[] = ["Målvakt", "Försvar", "Mittfält", "Anfall"];

export type LineupEntry = { slot: LineupSlot; player: Player };
export type LineGroup = { role: LineRole; entries: LineupEntry[] };

/* Gruppera den placerade uppställningen per linje (utifrån y), i ordningen
   målvakt → anfall. Slots vars spelare saknas i truppen hoppas över. Inom en
   linje sorteras spelarna vänster→höger (x stigande). */
export function groupLineup(
  lineup: LineupSlot[],
  players: Player[]
): LineGroup[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const buckets = new Map<LineRole, LineupEntry[]>();
  for (const slot of lineup) {
    const player = byId.get(slot.player_id);
    if (!player) continue;
    const role = roleFromY(slot.y);
    const list = buckets.get(role) ?? [];
    list.push({ slot, player });
    buckets.set(role, list);
  }
  return LINE_ORDER.flatMap((role) => {
    const entries = (buckets.get(role) ?? []).sort((a, b) => a.slot.x - b.slot.x);
    return entries.length ? [{ role, entries }] : [];
  });
}

/* Slå upp avbytarspelare i samma ordning som bench-listan. Okända id:n hoppas över. */
export function benchPlayers(bench: string[], players: Player[]): Player[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return bench.map((id) => byId.get(id)).filter((p): p is Player => !!p);
}

/* Dela en textruta i punkter: en rad = en punkt, tomma rader rensas bort. */
export function toPoints(text: string | null): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/* Returnerar true om genomgången har något innehåll alls att visa. */
export function briefingHasContent(b: Briefing | null): boolean {
  if (!b) return false;
  return (
    b.lineup.length > 0 ||
    b.bench.length > 0 ||
    toPoints(b.offensive).length > 0 ||
    toPoints(b.defensive).length > 0 ||
    !!b.note
  );
}
```

- [ ] **Step 2: Typkolla**

Run: `npx tsc --noEmit`
Expected: inga fel. (Om `Tables<"match_briefings">` saknas — Task 1 Step 4 är inte klar.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/briefing.ts
git commit -m "Lägger till delad logik för matchgenomgångar"
```

---

## Task 3: Plan-komponenten (`src/components/MatchPitch.tsx`)

Renderar en grön plan med utplacerade spelare. Används i både läsläge (spelarvyn) och editläge (admin, fri placering med dra).

**Files:**
- Create: `src/components/MatchPitch.tsx`

- [ ] **Step 1: Skriv komponenten**

Skapa `src/components/MatchPitch.tsx`:

```tsx
"use client";

// Fotbollsplan med utplacerade spelare. I läsläge visas bara dottar; i
// editläge kan en dot dras (pointer events, fungerar på touch) och tas bort.

import type { LineupSlot, Player } from "@/lib/briefing";

type Props = {
  lineup: LineupSlot[];
  players: Player[];
  // Editläge: anropas när en dot dras till en ny position (x/y 0–1)
  onMove?: (playerId: string, x: number, y: number) => void;
  // Editläge: anropas när en dot tas bort (tillbaka till bänken)
  onRemove?: (playerId: string) => void;
};

/* Räkna om en pekarposition till andel (0–1) av planens bredd/höjd. */
function fractionFromPointer(
  clientX: number,
  clientY: number,
  el: HTMLElement
) {
  const rect = el.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return { x: clamp(x), y: clamp(y) };
}

export default function MatchPitch({ lineup, players, onMove, onRemove }: Props) {
  const editable = !!onMove;
  const byId = new Map(players.map((p) => [p.id, p]));

  function handlePointerDown(e: React.PointerEvent, playerId: string) {
    if (!onMove) return;
    e.preventDefault();
    const pitch = e.currentTarget.parentElement;
    if (!pitch) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const { x, y } = fractionFromPointer(ev.clientX, ev.clientY, pitch);
      onMove(playerId, x, y);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border-2 border-paper/30 bg-grass"
      style={{
        aspectRatio: "3 / 4",
        // Mittlinje + diskret raster
        backgroundImage:
          "linear-gradient(0deg, rgba(242,237,217,.25) 1px, transparent 1px)",
        backgroundSize: "100% 25%",
      }}
    >
      {/* Mittcirkel */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper/30"
        aria-hidden
      />
      {lineup.map((slot) => {
        const player = byId.get(slot.player_id);
        if (!player) return null;
        return (
          <div
            key={slot.player_id}
            onPointerDown={(e) => handlePointerDown(e, slot.player_id)}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
              editable ? "cursor-grab touch-none active:cursor-grabbing" : ""
            }`}
            style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun font-[family-name:var(--font-display)] font-bold text-sm text-ink shadow-chip">
              {player.number ?? "–"}
            </span>
            <span className="mt-0.5 max-w-16 truncate rounded bg-ink/70 px-1 text-xs font-semibold text-paper">
              {player.name.split(" ")[0]}
            </span>
            {editable && onRemove && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onRemove(slot.player_id)}
                aria-label={`Ta bort ${player.name} från planen`}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-falu text-xs font-bold text-paper"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typkolla**

Run: `npx tsc --noEmit`
Expected: inga fel.

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchPitch.tsx
git commit -m "Lägger till plan-komponent för matchgenomgång"
```

---

## Task 4: Visningskomponenten (`src/components/MatchBriefing.tsx`)

Spelarvyns presentation av en genomgång: plan överst, grupperad lista, avbytare, offensiva/defensiva punkter.

**Files:**
- Create: `src/components/MatchBriefing.tsx`

- [ ] **Step 1: Skriv komponenten**

Skapa `src/components/MatchBriefing.tsx`:

```tsx
"use client";

// Läsvy för en matchgenomgång. Visar plan-vy + grupperad startelva +
// avbytare + offensiva/defensiva punkter. Används både i Genomgång-fliken
// och utfällt på en match i schemat.

import {
  type Briefing,
  type Player,
  benchPlayers,
  briefingHasContent,
  groupLineup,
  toPoints,
} from "@/lib/briefing";
import MatchPitch from "@/components/MatchPitch";

export default function MatchBriefing({
  briefing,
  players,
}: {
  briefing: Briefing | null;
  players: Player[];
}) {
  if (!briefingHasContent(briefing) || !briefing) {
    return (
      <p className="rounded-xl border border-dashed border-ink/20 px-4 py-6 text-center text-sm font-semibold text-ink/60">
        Ingen genomgång inlagd ännu.
      </p>
    );
  }

  const groups = groupLineup(briefing.lineup, players);
  const bench = benchPlayers(briefing.bench, players);
  const offensive = toPoints(briefing.offensive);
  const defensive = toPoints(briefing.defensive);

  return (
    <div className="space-y-5">
      {briefing.formation && (
        <p className="text-center text-xs font-bold uppercase tracking-[0.15em] text-ink/60">
          Start 9:a · {briefing.formation}
        </p>
      )}

      {briefing.lineup.length > 0 && (
        <MatchPitch lineup={briefing.lineup} players={players} />
      )}

      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.role}>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/55">
                {group.role}
              </p>
              <ul className="space-y-1">
                {group.entries.map(({ player }) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine text-xs font-bold text-paper">
                      {player.number ?? "–"}
                    </span>
                    <span className="text-sm font-semibold">{player.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {bench.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/55">
            Avbytare
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {bench.map((player) => (
              <li
                key={player.id}
                className="rounded-full bg-paper px-2.5 py-1 text-sm font-semibold"
              >
                {player.number != null && (
                  <span className="mr-1 text-ink/60">{player.number}</span>
                )}
                {player.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(offensive.length > 0 || defensive.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {offensive.length > 0 && (
            <div className="rounded-xl bg-paper p-3">
              <p className="mb-1 font-[family-name:var(--font-display)] font-bold text-sm uppercase text-grass">
                ⚽ Offensivt
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {offensive.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {defensive.length > 0 && (
            <div className="rounded-xl bg-paper p-3">
              <p className="mb-1 font-[family-name:var(--font-display)] font-bold text-sm uppercase text-falu">
                🛡️ Defensivt
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {defensive.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {briefing.note && (
        <p className="rounded-lg bg-paper px-3 py-2 text-sm">{briefing.note}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typkolla**

Run: `npx tsc --noEmit`
Expected: inga fel.

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchBriefing.tsx
git commit -m "Lägger till visningskomponent för matchgenomgång"
```

---

## Task 5: "Genomgång"-fliken (sida + vy)

**Files:**
- Create: `src/app/genomgang/page.tsx`
- Create: `src/components/GenomgangView.tsx`

- [ ] **Step 1: Läs Next-guiden för pages**

Läs snabbt `node_modules/next/dist/docs/` för App Router page + metadata (samma mönster som `src/app/schema/page.tsx` redan följer). Bekräfta att server-sidan får hämta data via `await createClient()`.

- [ ] **Step 2: Skapa server-sidan**

Skapa `src/app/genomgang/page.tsx`:

```tsx
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { parseBriefing } from "@/lib/briefing";
import GenomgangView from "@/components/GenomgangView";

export const metadata: Metadata = {
  title: "Genomgång – Habo-cupen 2026",
  description:
    "Matchgenomgång för BK Zeros under Habo-cupen 2026 – laguppställning och taktik.",
};

export default async function GenomgangPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: players }, { data: matches }, { data: briefings }] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase
        .from("players")
        .select("*")
        .order("number", { nullsFirst: false })
        .order("name"),
      supabase.from("matches").select("*").order("starts_at"),
      supabase.from("match_briefings").select("*"),
    ]);

  return (
    <GenomgangView
      initialTeams={teams ?? []}
      initialPlayers={players ?? []}
      initialMatches={matches ?? []}
      initialBriefings={(briefings ?? []).map(parseBriefing)}
    />
  );
}
```

- [ ] **Step 3: Skapa klientvyn**

Skapa `src/components/GenomgangView.tsx`:

```tsx
"use client";

// Genomgång-fliken: visar nästa kommande match per lag och låter spelaren
// växla mellan lagen (Vit/Grön). Uppdateras live via schemakanalen.

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useScheduleLive } from "@/lib/use-schedule-live";
import { useCurrentMinute } from "@/lib/time";
import { type Briefing, parseBriefing, pickBriefing } from "@/lib/briefing";
import SiteHeader from "@/components/SiteHeader";
import MatchBriefing from "@/components/MatchBriefing";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type Player = Tables<"players">;
type Match = Tables<"matches">;

const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

export default function GenomgangView({
  initialTeams,
  initialPlayers,
  initialMatches,
  initialBriefings,
}: {
  initialTeams: Team[];
  initialPlayers: Player[];
  initialMatches: Match[];
  initialBriefings: Briefing[];
}) {
  const [teams] = useState(initialTeams);
  const [players, setPlayers] = useState(initialPlayers);
  const [matches, setMatches] = useState(initialMatches);
  const [briefings, setBriefings] = useState(initialBriefings);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(
    initialTeams[0]?.id ?? null
  );
  const now = useCurrentMinute();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [p, m, b] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("matches").select("*"),
      supabase.from("match_briefings").select("*"),
    ]);
    if (p.data) setPlayers(p.data);
    if (m.data) setMatches(m.data);
    if (b.data) setBriefings(b.data.map(parseBriefing));
  }, []);

  useScheduleLive(refresh);

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  // Nästa kommande match för det aktiva laget (matchnamn matchar Cupmates exakt)
  const nextMatch = useMemo(() => {
    if (!activeTeam || !now) return null;
    return (
      matches
        .filter(
          (m) =>
            (m.home_team === activeTeam.name || m.away_team === activeTeam.name) &&
            m.starts_at &&
            new Date(m.starts_at) > now
        )
        .sort((a, b) => (a.starts_at! < b.starts_at! ? -1 : 1))[0] ?? null
    );
  }, [matches, activeTeam, now]);

  const briefing = activeTeam
    ? pickBriefing(briefings, activeTeam.id, nextMatch?.id ?? null)
    : null;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="genomgang" />

      {teams.length > 1 && (
        <div className="mb-5 flex gap-2">
          {teams.map((team) => {
            const active = team.id === activeTeamId;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setActiveTeamId(team.id)}
                aria-pressed={active}
                className={`flex-1 rounded-xl border px-3 py-2 font-[family-name:var(--font-display)] font-bold text-base uppercase transition-transform active:scale-95 ${
                  active
                    ? "border-transparent bg-sun text-ink shadow-chip"
                    : "border-paper/30 bg-paper/10 text-paper hover:bg-paper/20"
                }`}
              >
                {team.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
        <h2 className="mb-1 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          {nextMatch
            ? `${nextMatch.home_team} – ${nextMatch.away_team}`
            : "Lagets upplägg"}
        </h2>
        {nextMatch?.starts_at && (
          <p className="mb-4 text-sm font-semibold text-ink/60">
            {dateFormat.format(new Date(nextMatch.starts_at))}
            {nextMatch.pitch && <> · Plan {nextMatch.pitch}</>}
          </p>
        )}
        <MatchBriefing briefing={briefing} players={players} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Typkolla**

Run: `npx tsc --noEmit`
Expected: ett fel kvarstår — `SiteHeader` accepterar ännu inte `active="genomgang"`. Det löses i Task 6. Övriga delar ska vara felfria.

- [ ] **Step 5: Commit**

```bash
git add src/app/genomgang/page.tsx src/components/GenomgangView.tsx
git commit -m "Lägger till Genomgång-fliken med nästa match per lag"
```

---

## Task 6: Menyflik i SiteHeader

**Files:**
- Modify: `src/components/SiteHeader.tsx:8-15` (TABS-listan)

- [ ] **Step 1: Lägg till fliken i TABS**

I `src/components/SiteHeader.tsx`, ersätt TABS-arrayen (rad 8–15) med:

```tsx
const TABS = [
  { href: "/", label: "Hem", key: "hem" },
  { href: "/schema", label: "Schema", key: "schema" },
  { href: "/genomgang", label: "Genomgång", key: "genomgang" },
  { href: "/tabeller", label: "Tabeller", key: "tabeller" },
  { href: "/trupperna", label: "Trupperna", key: "trupperna" },
  { href: "/packlista", label: "Packlista", key: "packlista" },
  { href: "/tjugan", label: "Tjugan", key: "tjugan" },
] as const;
```

`SiteTab` härleds från TABS, så `active="genomgang"` blir giltigt automatiskt.

- [ ] **Step 2: Typkolla**

Run: `npx tsc --noEmit`
Expected: inga fel (felet från Task 5 är nu borta).

- [ ] **Step 3: Verifiera i webbläsaren**

Run: `npm run dev`, öppna `http://localhost:3000/genomgang`.
Expected: sidan laddar, menyfliken "Genomgång" syns och är markerad, vyn visar "Ingen genomgång inlagd ännu" (inga genomgångar finns än). Växling mellan Vit/Grön fungerar.

- [ ] **Step 4: Commit**

```bash
git add src/components/SiteHeader.tsx
git commit -m "Lägger till Genomgång i menyn"
```

---

## Task 7: Utfällbar genomgång i schemat

**Files:**
- Modify: `src/components/ScheduleView.tsx` (props, refresh, MatchCard)
- Modify: `src/app/schema/page.tsx` (skicka in players + briefings)

- [ ] **Step 1: Utöka schema-sidan med data**

I `src/app/schema/page.tsx`, ersätt hela `SchemaPage`-funktionens datahämtning och retur så att spelare och genomgångar hämtas och skickas vidare. Ny fil:

```tsx
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { parseBriefing } from "@/lib/briefing";
import ScheduleView from "@/components/ScheduleView";

export const metadata: Metadata = {
  title: "Schema – Habo-cupen 2026",
  description:
    "Schema för BK Zeros under Habo-cupen 2026 – matcher, mat och allt däremellan.",
};

export default async function SchemaPage() {
  const supabase = await createClient();

  const [
    { data: teams },
    { data: events },
    { data: matches },
    { data: players },
    { data: briefings },
  ] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("events")
      .select("*")
      .order("day")
      .order("starts_at", { nullsFirst: false })
      .order("sort_hint"),
    supabase.from("matches").select("*").order("starts_at"),
    supabase
      .from("players")
      .select("*")
      .order("number", { nullsFirst: false })
      .order("name"),
    supabase.from("match_briefings").select("*"),
  ]);

  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
  }).format(new Date());

  return (
    <ScheduleView
      initialTeams={teams ?? []}
      initialEvents={events ?? []}
      initialMatches={matches ?? []}
      initialPlayers={players ?? []}
      initialBriefings={(briefings ?? []).map(parseBriefing)}
      today={today}
    />
  );
}
```

- [ ] **Step 2: Lägg till imports och props i ScheduleView**

I `src/components/ScheduleView.tsx`, lägg till import efter rad 14 (`import type { Tables } ...`):

```tsx
import { type Briefing, parseBriefing, pickBriefing } from "@/lib/briefing";
import MatchBriefing from "@/components/MatchBriefing";
```

Lägg till typalias bredvid de övriga (efter rad 18, `type Match = ...`):

```tsx
type Player = Tables<"players">;
```

Utöka `Props` (rad 24–29) till:

```tsx
type Props = {
  initialTeams: Team[];
  initialEvents: CupEvent[];
  initialMatches: Match[];
  initialPlayers: Player[];
  initialBriefings: Briefing[];
  today: string;
};
```

Uppdatera komponentsignaturen (rad 66–71) till att destrukturera de nya propsen:

```tsx
export default function ScheduleView({
  initialTeams,
  initialEvents,
  initialMatches,
  initialPlayers,
  initialBriefings,
  today,
}: Props) {
```

Lägg till state direkt efter `const [matches, setMatches] = useState(initialMatches);` (rad 73):

```tsx
  const [players, setPlayers] = useState(initialPlayers);
  const [briefings, setBriefings] = useState(initialBriefings);
```

- [ ] **Step 3: Hämta även genomgångar i refresh**

I `refresh`-callbacken (rad 79–87), ersätt kroppen så att players och briefings också hämtas:

```tsx
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
```

- [ ] **Step 4: Skicka briefing-data till MatchCard**

I renderingen av `MatchCard` (rad 274–280), lägg till props `briefing` och `players`:

```tsx
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
              />
```

- [ ] **Step 5: Bygg ut MatchCard med utfällbar genomgång**

I `MatchCard`-komponenten (rad 412 och framåt), uppdatera signaturen och lägg till en utfällbar sektion. Ersätt funktionens parameterlista och lägg till `useState` för utfällning. Lägg till `briefing` och `players` i props-typen och rendera en knapp + utfälld `MatchBriefing` efter den befintliga `<div className="flex items-start ...">`-blocket men inuti `<li>`.

Ny `MatchCard` (ersätt hela funktionen, rad 412–476):

```tsx
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
  const hasBriefing = !!briefing && !!team;

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
```

- [ ] **Step 6: Typkolla och bygg**

Run: `npx tsc --noEmit`
Expected: inga fel.

- [ ] **Step 7: Commit**

```bash
git add src/components/ScheduleView.tsx src/app/schema/page.tsx
git commit -m "Lägger till utfällbar matchgenomgång i schemat"
```

---

## Task 8: Admin – planeditor och sparning (`BriefingManager`)

Den största delen. Ledare väljer lag och mål (mall eller match), placerar spelare fritt på planen, fyller i punkter och sparar. Förifyllning från befintlig mall/match.

**Files:**
- Modify: `src/components/AdminPanel.tsx` (ny `BriefingManager`-sektion + rendering)
- Modify: `src/app/admin/page.tsx` (hämta matcher + genomgångar)

- [ ] **Step 1: Utöka admin-sidan med matcher och genomgångar**

I `src/app/admin/page.tsx`, ersätt datahämtningen och retur. Ny fil:

```tsx
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { parseBriefing } from "@/lib/briefing";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Ledar-admin – Habo-cupen 2026",
  robots: { index: false },
};

export default async function AdminPage() {
  const supabase = await createClient();

  const [
    { data: events },
    { data: teams },
    { data: players },
    { data: matches },
    { data: briefings },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .order("day")
      .order("starts_at", { nullsFirst: false }),
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("players")
      .select("*")
      .order("number", { nullsFirst: false })
      .order("name"),
    supabase.from("matches").select("*").order("starts_at"),
    supabase.from("match_briefings").select("*"),
  ]);

  return (
    <AdminPanel
      initialEvents={events ?? []}
      initialTeams={teams ?? []}
      initialPlayers={players ?? []}
      initialMatches={matches ?? []}
      initialBriefings={(briefings ?? []).map(parseBriefing)}
    />
  );
}
```

- [ ] **Step 2: Uppdatera AdminPanel-propsen och rendera BriefingManager**

I `src/components/AdminPanel.tsx`:

Lägg till imports efter rad 14 (`import type { Enums, Tables } ...`):

```tsx
import {
  type Briefing,
  type LineupSlot,
  parseBriefing,
} from "@/lib/briefing";
import MatchPitch from "@/components/MatchPitch";
```

Lägg till typalias efter rad 19 (`type EventStatus = ...`):

```tsx
type Match = Tables<"matches">;
```

Ändra `AdminPanel`-signaturen (rad 79–87) till att ta emot de nya propsen:

```tsx
export default function AdminPanel({
  initialEvents,
  initialTeams,
  initialPlayers,
  initialMatches,
  initialBriefings,
}: {
  initialEvents: CupEvent[];
  initialTeams: Team[];
  initialPlayers: Player[];
  initialMatches: Match[];
  initialBriefings: Briefing[];
}) {
```

I den inloggade vyn (rad 117–130), lägg till `BriefingManager` efter `PlayersManager`:

```tsx
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
          <BriefingManager
            supabase={supabase}
            teams={initialTeams}
            players={initialPlayers}
            matches={initialMatches}
            initialBriefings={initialBriefings}
          />
        </>
      ) : (
        <LoginForm supabase={supabase} />
      )}
```

- [ ] **Step 3: Lägg till BriefingManager-komponenten**

Lägg till följande i slutet av `src/components/AdminPanel.tsx` (efter sista komponenten i filen). Den hanterar val av lag/mål, planeditor, fält, förifyllning och sparning.

```tsx
// ---- Matchgenomgång ----------------------------------------------------

type BriefingFormState = {
  formation: string;
  lineup: LineupSlot[];
  bench: string[];
  offensive: string;
  defensive: string;
  note: string;
};

const EMPTY_BRIEFING_FORM: BriefingFormState = {
  formation: "",
  lineup: [],
  bench: [],
  offensive: "",
  defensive: "",
  note: "",
};

const briefingTimeFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

/* Fyll formuläret från en befintlig genomgång (för redigering/förifyllning). */
function formFromBriefing(b: Briefing): BriefingFormState {
  return {
    formation: b.formation ?? "",
    lineup: b.lineup,
    bench: b.bench,
    offensive: b.offensive ?? "",
    defensive: b.defensive ?? "",
    note: b.note ?? "",
  };
}

function BriefingManager({
  supabase,
  teams,
  players,
  matches,
  initialBriefings,
}: {
  supabase: ReturnType<typeof createClient>;
  teams: Team[];
  players: Player[];
  matches: Match[];
  initialBriefings: Briefing[];
}) {
  const [briefings, setBriefings] = useState<Briefing[]>(initialBriefings);
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  // "" = lagets mall, annars ett match-id
  const [matchId, setMatchId] = useState<string>("");
  const [form, setForm] = useState<BriefingFormState>(EMPTY_BRIEFING_FORM);
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

  const loadBriefings = useCallback(async () => {
    const { data } = await supabase.from("match_briefings").select("*");
    if (data) setBriefings(data.map(parseBriefing));
  }, [supabase]);

  // Den sparade raden för valt lag+mål (om någon finns) — styr Ta bort-knappen
  const currentRow = useMemo(
    () =>
      briefings.find(
        (b) => b.team_id === teamId && (b.match_id ?? "") === matchId
      ) ?? null,
    [briefings, teamId, matchId]
  );

  // Ladda in den genomgång som hör till valt lag+mål när valet ändras
  useEffect(() => {
    const row = briefings.find(
      (b) => b.team_id === teamId && (b.match_id ?? "") === matchId
    );
    setForm(row ? formFromBriefing(row) : EMPTY_BRIEFING_FORM);
    setMessage(null);
  }, [teamId, matchId, briefings]);

  // Spelare som inte är placerade på planen → kan väljas in
  const placedIds = new Set(form.lineup.map((s) => s.player_id));
  const available = squad.filter((p) => !placedIds.has(p.id));

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

  async function handleSave() {
    setBusy(true);
    setMessage(null);

    const payload = {
      team_id: teamId,
      match_id: matchId || null,
      formation: form.formation.trim() || null,
      lineup: form.lineup as unknown as Tables<"match_briefings">["lineup"],
      bench: form.bench as unknown as Tables<"match_briefings">["bench"],
      offensive: form.offensive.trim() || null,
      defensive: form.defensive.trim() || null,
      note: form.note.trim() || null,
    };
    // updated_at sätts av databastriggern set_updated_at — inte här.

    // Finns redan en rad för lag+mål → uppdatera, annars infoga
    const existing = briefings.find(
      (b) => b.team_id === teamId && (b.match_id ?? "") === matchId
    );

    const { error } = existing
      ? await supabase
          .from("match_briefings")
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("match_briefings").insert(payload);

    if (error) {
      setMessage(`Kunde inte spara: ${error.message}`);
    } else {
      setMessage("Genomgången är sparad.");
      await loadBriefings();
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
    await loadBriefings();
  }

  if (teams.length === 0) return null;

  // Källor att förifylla från (lagets mall + matcher som har en genomgång),
  // exklusive det mål som redigeras just nu
  const prefillSources = briefings
    .filter((b) => b.team_id === teamId && (b.match_id ?? "") !== matchId)
    .map((b) => ({
      value: b.match_id ?? "",
      label:
        b.match_id === null
          ? "Lagets mall"
          : (() => {
              const m = matches.find((mm) => mm.id === b.match_id);
              return m ? `${m.home_team} – ${m.away_team}` : "Match";
            })(),
    }));

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
                setTeamId(e.target.value);
                setMatchId("");
              }}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Gäller</span>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="w-full rounded-lg border border-ink/25 bg-paper px-3 py-2"
            >
              <option value="">Lagets mall</option>
              {teamMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.home_team} – {m.away_team}
                  {m.starts_at
                    ? ` (${briefingTimeFormat.format(new Date(m.starts_at))})`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="flex-1 rounded-xl bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "Sparar…" : "Spara genomgång"}
          </button>
          {currentRow && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-xl border border-falu/40 bg-paper px-4 py-2.5 font-bold text-falu transition-transform active:scale-95"
            >
              Ta bort
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Typkolla**

Run: `npx tsc --noEmit`
Expected: inga fel. (`currentRow` används i Ta bort-knappens villkor; `useEffect`/`useMemo`/`useState` är redan importerade högst upp i filen.)

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: inga fel. Vanlig fallgrop: oanvänd variabel. Om `currentRow` flaggas som oanvänd — den ska användas i `{currentRow && (...)}`-villkoret; kontrollera att det finns kvar.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminPanel.tsx src/app/admin/page.tsx
git commit -m "Lägger till planeditor för matchgenomgång i admin"
```

---

## Task 9: Manuell helhetsverifiering

**Files:** Inga (verifiering).

- [ ] **Step 1: Bygg**

Run: `npm run build`
Expected: bygget lyckas utan fel.

- [ ] **Step 2: Starta dev och logga in i admin**

Run: `npm run dev`, öppna `http://localhost:3000/admin`, logga in som ledare.
Expected: sektionen "Matchgenomgång" syns under "Trupperna".

- [ ] **Step 3: Skapa en mall**

Välj ett lag, lämna "Gäller" på "Lagets mall". Klicka in några spelare på planen via "Lägg till på planen", dra dem till rimliga positioner (målvakt längst ner, anfall längst upp), markera ett par avbytare, fyll i offensivt/defensivt (en rad per punkt) och spara.
Expected: "Genomgången är sparad." Spelarna ligger kvar där du släppte dem.

- [ ] **Step 4: Verifiera spelarvyn (flik)**

Öppna `http://localhost:3000/genomgang`, välj samma lag.
Expected: om laget har en kommande match visas den; annars visas mallen. Plan-vyn visar spelarna på sina platser, listan är grupperad Målvakt/Försvar/Mittfält/Anfall utifrån höjdläget, avbytare och punkter syns.

- [ ] **Step 5: Verifiera schemat**

Öppna `http://localhost:3000/schema`, gå till en dag med en av lagets matcher. Klicka "Matchgenomgång ▾" på matchkortet.
Expected: genomgången fälls ut inline (matchens egen om den finns, annars mallen).

- [ ] **Step 6: Verifiera match-specifik genomgång + förifyllning**

I admin: välj samma lag, välj en specifik match under "Gäller", använd "Förifyll från → Lagets mall", justera något och spara.
Expected: spelarvyn för den matchen visar nu den match-specifika varianten i stället för mallen.

- [ ] **Step 7: Verifiera live-uppdatering**

Ha `/genomgang` öppen i en flik och admin i en annan. Ändra och spara i admin.
Expected: spelarvyn uppdateras inom någon sekund utan omladdning (broadcast-triggern).

- [ ] **Step 8: Mobilkänsla**

Krymp fönstret till mobilbredd (eller använd enhetsläge i devtools) och testa att dra spelare på planen i admin.
Expected: dragningen fungerar med touch (pointer events), inget sidoscroll stör (dotten har `touch-none`).

- [ ] **Step 9: Slutlig lint + commit av ev. justeringar**

Run: `npm run lint && npm run build`
Expected: båda lyckas. Committa eventuella småfixar som dök upp under verifieringen.

```bash
git add -A
git commit -m "Justerar matchgenomgång efter manuell verifiering"
```

---

## Self-review-anteckningar (för planförfattaren)

- **Spec-täckning:** mall+match (Task 1, 8, fallback i `pickBriefing` Task 2), fri placering (Task 3, 8), avbytare (Task 2, 4, 8), både plan + lista (Task 4), åtkomst både flik och schema (Task 5–7), spelare hämtas ur truppen filtrerat per lag (Task 8 `squad`), RLS + live (Task 1). ✔
- **Inga platshållare:** all kod är konkret. ✔
- **Typkonsistens:** `LineupSlot`, `Briefing`, `parseBriefing`, `pickBriefing`, `groupLineup`, `benchPlayers`, `toPoints`, `briefingHasContent` definieras i Task 2 och används med samma signaturer i Task 3–8. `MatchPitch`-props (`lineup`, `players`, `onMove`, `onRemove`) matchar anrop i Task 4 och Task 8. ✔
- **Känd kompromiss:** listgrupperingens y-band (`roleFromY`) förutsätter att ledaren placerar spelarna i rimliga höjdlinjer. Det är dokumenterat och acceptabelt enligt specen.
