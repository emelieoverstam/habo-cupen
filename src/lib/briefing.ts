// Delade typer och ren logik för matchgenomgångar. Inga React-beroenden —
// hålls separat så att fallback, gruppering och textpunkter är lätta att läsa.

import type { Tables } from "@/types/database";

export type Player = Tables<"players">;
type BriefingRow = Tables<"match_briefings">;

// Positioner som ledaren tilldelar varje spelare, i ordning defensiv → offensiv.
// (MV = målvakt, MB = mittback, YM = ytter, 6/8/10:a = mittfält, 9:a = anfall.)
export const POSITIONS = ["MV", "MB", "YM", "6:a", "8:a", "10:a", "9:a"] as const;
export type Position = (typeof POSITIONS)[number];

// En placerad spelare på planen. x/y är 0–1 (andel av planens bredd/höjd) och
// styr enbart var spelaren ritas — positionen väljs separat av ledaren.
// Saknas position (äldre uppställningar) härleds den ur y-läget.
export type LineupSlot = {
  player_id: string;
  x: number;
  y: number;
  position?: Position;
};

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

/* Välj matchens egen, PUBLICERADE genomgång (det spelarna ser). Utkast och
   matcher utan genomgång ger null. */
export function pickBriefing(
  briefings: Briefing[],
  teamId: string,
  matchId: string | null
): Briefing | null {
  if (!matchId) return null;
  return (
    briefings.find(
      (b) => b.team_id === teamId && b.match_id === matchId && b.published
    ) ?? null
  );
}

export type LineupEntry = { slot: LineupSlot; player: Player };

/* Reservposition för äldre uppställningar som saknar vald position — härleds
   ur y-läget (defensiv längst ner, offensiv längst upp). */
function fallbackPosition(y: number): Position {
  if (y > 0.72) return "MV";
  if (y > 0.5) return "MB";
  if (y > 0.3) return "8:a";
  return "9:a";
}

/* Spelarens position: den ledaren valt, annars härledd ur y-läget. */
export function positionOf(slot: LineupSlot): Position {
  return slot.position ?? fallbackPosition(slot.y);
}

export type PositionGroup = { position: Position; entries: LineupEntry[] };

/* Gruppera uppställningen per vald position, i ordningen MV → 9:a. Inom en
   position sorteras spelarna vänster→höger (x stigande). Slots vars spelare
   saknas i truppen hoppas över. */
export function groupLineup(
  lineup: LineupSlot[],
  players: Player[]
): PositionGroup[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const buckets = new Map<Position, LineupEntry[]>();
  for (const slot of lineup) {
    const player = byId.get(slot.player_id);
    if (!player) continue;
    const position = positionOf(slot);
    const list = buckets.get(position) ?? [];
    list.push({ slot, player });
    buckets.set(position, list);
  }
  return POSITIONS.flatMap((position) => {
    const entries = (buckets.get(position) ?? []).sort((a, b) => a.slot.x - b.slot.x);
    return entries.length ? [{ position, entries }] : [];
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
