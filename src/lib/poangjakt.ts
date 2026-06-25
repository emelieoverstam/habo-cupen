// Delade typer och ren logik för poängjakten. Inga React-beroenden —
// poängsummering och timer-uträkning hålls separat och lätt att läsa.

import type { Tables } from "@/types/database";

export type QuestTask = Tables<"quest_tasks">;
export type QuestGroup = Tables<"quest_groups">;
export type QuestCompletion = Tables<"quest_completions">;
export type QuestState = Tables<"quest_state">;
export type Player = Tables<"players">;

/* Slå upp gruppens medlemmar (member_ids är en jsonb-array med spelar-id).
   Okända id:n hoppas över. */
export function groupMembers(memberIds: unknown, players: Player[]): Player[] {
  const ids = Array.isArray(memberIds) ? (memberIds as string[]) : [];
  const byId = new Map(players.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is Player => !!p);
}

/* Fördela id:n jämnt (round-robin) i n grupper — för lottningen. Skicka en
   redan blandad lista för en slumpmässig indelning. */
export function roundRobin(ids: string[], groupCount: number): string[][] {
  const buckets: string[][] = Array.from({ length: groupCount }, () => []);
  ids.forEach((id, i) => buckets[i % groupCount].push(id));
  return buckets;
}

/* Har gruppen fått uppdraget godkänt? (för rutnätet i admin) */
export function isCompleted(
  completions: QuestCompletion[],
  groupId: string,
  taskId: string
): boolean {
  return completions.some(
    (c) => c.group_id === groupId && c.task_id === taskId
  );
}

export type ScoreRow = { group: QuestGroup; points: number; done: number };

/* Räkna ihop poäng per grupp och sortera i fallande ordning (vid lika poäng
   sorteras på namn). Poäng = summan av klarade uppdrags poäng. */
export function scoreboard(
  groups: QuestGroup[],
  tasks: QuestTask[],
  completions: QuestCompletion[]
): ScoreRow[] {
  const pointsByTask = new Map(tasks.map((t) => [t.id, t.points]));
  const rows = groups.map((group) => {
    const mine = completions.filter((c) => c.group_id === group.id);
    const points = mine.reduce(
      (sum, c) => sum + (pointsByTask.get(c.task_id) ?? 0),
      0
    );
    return { group, points, done: mine.length };
  });
  return rows.sort(
    (a, b) => b.points - a.points || a.group.name.localeCompare(b.group.name, "sv")
  );
}

export type TimerStatus = "idle" | "running" | "ended";
export type TimerView = {
  status: TimerStatus;
  endsAt: Date | null;
  remainingMs: number;
};

/* Räkna ut timerns läge. `now` är null under SSR/hydration — då visas hela
   längden som förhandsvärde och status härleds enbart av om den är startad. */
export function timerView(state: QuestState | null, now: Date | null): TimerView {
  const durationMs = (state?.duration_minutes ?? 90) * 60_000;

  if (!state || !state.started_at) {
    return { status: "idle", endsAt: null, remainingMs: durationMs };
  }

  const endsAt = new Date(new Date(state.started_at).getTime() + durationMs);
  if (!now) {
    return { status: "running", endsAt, remainingMs: durationMs };
  }

  const remainingMs = endsAt.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return { status: "ended", endsAt, remainingMs: 0 };
  }
  return { status: "running", endsAt, remainingMs };
}

/* Formatera en tid kvar som M:SS (minuter kan överstiga 59, t.ex. "90:00"). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
