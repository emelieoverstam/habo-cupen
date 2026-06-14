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
