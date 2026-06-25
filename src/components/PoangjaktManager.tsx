"use client";

// Admin-verktyg för poängjakten: timer & publicering, grupper, uppdrag och ett
// godkännande-rutnät (uppdrag × grupper). Fristående komponent som AdminPanel
// renderar under fliken "Poängjakt". Håller sig live mot broadcast-kanalen så
// flera ledare ser samma sak.

import { useCallback, useMemo, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import { useScheduleLive } from "@/lib/use-schedule-live";
import { useCurrentSecond } from "@/lib/time";
import {
  type Player,
  type QuestCompletion,
  type QuestGroup,
  type QuestState,
  type QuestTask,
  formatClock,
  groupMembers,
  isCompleted,
  roundRobin,
  timerView,
} from "@/lib/poangjakt";

type SupabaseClient = ReturnType<typeof createClient>;

const inputClass =
  "w-full rounded-lg border border-ink/25 bg-paper px-3 py-2";
const primaryBtn =
  "rounded-xl bg-grass px-4 py-2.5 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50";

export default function PoangjaktManager({
  supabase,
  initialTasks,
  initialGroups,
  initialCompletions,
  initialState,
  players,
}: {
  supabase: SupabaseClient;
  initialTasks: QuestTask[];
  initialGroups: QuestGroup[];
  initialCompletions: QuestCompletion[];
  initialState: QuestState | null;
  players: Player[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [groups, setGroups] = useState(initialGroups);
  const [completions, setCompletions] = useState(initialCompletions);
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const now = useCurrentSecond();

  const refresh = useCallback(async () => {
    const [t, g, c, s] = await Promise.all([
      supabase
        .from("quest_tasks")
        .select("*")
        .order("sort_hint", { nullsFirst: false })
        .order("points", { ascending: false }),
      supabase
        .from("quest_groups")
        .select("*")
        .order("sort_hint", { nullsFirst: false })
        .order("name"),
      supabase.from("quest_completions").select("*"),
      supabase.from("quest_state").select("*").limit(1).maybeSingle(),
    ]);
    if (t.data) setTasks(t.data);
    if (g.data) setGroups(g.data);
    if (c.data) setCompletions(c.data);
    if (s.data) setState(s.data);
  }, [supabase]);
  useScheduleLive(refresh);

  const timer = timerView(state, now);

  // ---- Timer & publicering ------------------------------------------------

  async function patchState(patch: Partial<QuestState>) {
    if (!state) return;
    await supabase.from("quest_state").update(patch).eq("id", state.id);
    await refresh();
  }

  function startTimer() {
    patchState({ started_at: new Date().toISOString() });
  }
  function stopTimer() {
    // Nollställ: timern återgår till "inte startad"
    patchState({ started_at: null });
  }
  function setDuration(minutes: number) {
    patchState({ duration_minutes: minutes });
  }
  function togglePublished() {
    patchState({ tasks_published: !state?.tasks_published });
  }

  // ---- Grupper ------------------------------------------------------------

  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState("#29a166");

  async function addGroup() {
    const name = groupName.trim();
    if (!name) return;
    await supabase
      .from("quest_groups")
      .insert({ name, color: groupColor, sort_hint: groups.length });
    setGroupName("");
    await refresh();
  }
  async function deleteGroup(id: string, name: string) {
    if (!window.confirm(`Ta bort gruppen ${name}? Dess poäng nollställs.`)) return;
    await supabase.from("quest_groups").delete().eq("id", id);
    await refresh();
  }

  // Lotta om: blanda truppen (spelare med lag) jämnt i de befintliga grupperna
  async function reLottery() {
    if (groups.length === 0) {
      setMessage("Lägg till grupper först.");
      return;
    }
    if (!window.confirm("Lotta om lagen? Nuvarande indelning skrivs över.")) return;

    const ids = players.filter((p) => p.team_id).map((p) => p.id);
    // Fisher-Yates-blandning
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const ordered = [...groups].sort(
      (a, b) => (a.sort_hint ?? 0) - (b.sort_hint ?? 0)
    );
    const buckets = roundRobin(ids, ordered.length);
    await Promise.all(
      ordered.map((g, i) =>
        supabase
          .from("quest_groups")
          .update({ member_ids: buckets[i] })
          .eq("id", g.id)
      )
    );
    setMessage("Lagen är omlottade.");
    await refresh();
  }

  // ---- Uppdrag ------------------------------------------------------------

  const [taskTitle, setTaskTitle] = useState("");
  const [taskPoints, setTaskPoints] = useState("10");

  async function addTask() {
    const title = taskTitle.trim();
    if (!title) return;
    await supabase.from("quest_tasks").insert({
      title,
      points: Number(taskPoints) || 0,
      sort_hint: tasks.length,
    });
    setTaskTitle("");
    setTaskPoints("10");
    await refresh();
  }
  async function deleteTask(id: string, title: string) {
    if (!window.confirm(`Ta bort uppdraget "${title}"?`)) return;
    await supabase.from("quest_tasks").delete().eq("id", id);
    await refresh();
  }

  // ---- Godkännande-rutnät -------------------------------------------------

  const completedSet = useMemo(
    () => new Set(completions.map((c) => `${c.group_id}:${c.task_id}`)),
    [completions]
  );

  async function toggleCompletion(groupId: string, taskId: string) {
    const done = isCompleted(completions, groupId, taskId);
    // Optimistisk uppdatering så rutnätet känns snabbt under kvällen
    if (done) {
      setCompletions((cs) =>
        cs.filter((c) => !(c.group_id === groupId && c.task_id === taskId))
      );
      await supabase
        .from("quest_completions")
        .delete()
        .eq("group_id", groupId)
        .eq("task_id", taskId);
    } else {
      setCompletions((cs) => [
        ...cs,
        {
          id: `tmp-${groupId}-${taskId}`,
          group_id: groupId,
          task_id: taskId,
          created_at: new Date().toISOString(),
        },
      ]);
      await supabase
        .from("quest_completions")
        .insert({ group_id: groupId, task_id: taskId });
    }
    await refresh();
  }

  return (
    <section className="mt-10 space-y-8">
      <h2 className="inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-base uppercase text-paper">
        Poängjakt
      </h2>

      {/* Timer & publicering */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="mb-3 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          Timer & publicering
        </h3>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="font-bold uppercase tracking-wide text-ink/55">
            Status:
          </span>
          <span className="rounded-full bg-pine px-2.5 py-0.5 font-bold text-paper">
            {timer.status === "idle"
              ? "Inte startad"
              : timer.status === "running"
                ? `Tid kvar: ${now ? formatClock(timer.remainingMs) : "…"}`
                : "Tiden är ute"}
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={startTimer} className={primaryBtn}>
            {timer.status === "running" ? "Starta om" : "Starta"}
          </button>
          <button
            type="button"
            onClick={stopTimer}
            className="rounded-xl border border-ink/25 bg-paper px-4 py-2.5 font-bold transition-transform active:scale-95"
          >
            Nollställ
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm font-bold">
            Längd
            <input
              type="number"
              min={1}
              value={state?.duration_minutes ?? 90}
              onChange={(e) => setDuration(Number(e.target.value) || 90)}
              className="w-20 rounded-lg border border-ink/25 bg-paper px-2 py-1"
            />
            min
          </label>
        </div>
        <button
          type="button"
          onClick={togglePublished}
          aria-pressed={!!state?.tasks_published}
          className={`w-full rounded-xl px-4 py-2.5 font-bold transition-transform active:scale-95 ${
            state?.tasks_published
              ? "bg-grass text-ink"
              : "border border-ink/25 bg-paper"
          }`}
        >
          {state?.tasks_published
            ? "✓ Uppdragen är publicerade (tryck för att dölja)"
            : "Publicera uppdragen för tjejerna"}
        </button>
      </div>

      {/* Grupper */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="mb-3 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          Grupper ({groups.length})
        </h3>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Gruppnamn"
            className={inputClass}
          />
          <input
            type="color"
            value={groupColor}
            onChange={(e) => setGroupColor(e.target.value)}
            aria-label="Gruppfärg"
            className="h-11 w-12 shrink-0 rounded-lg border border-ink/25"
          />
          <button type="button" onClick={addGroup} className={primaryBtn}>
            +
          </button>
        </div>

        <button
          type="button"
          onClick={reLottery}
          disabled={groups.length === 0}
          className="mb-2 w-full rounded-xl border border-ink/25 bg-paper px-4 py-2.5 font-bold transition-transform active:scale-95 disabled:opacity-50"
        >
          🎲 Lotta om lagen
        </button>
        {message && (
          <p className="mb-3 rounded-lg bg-sun px-3 py-2 text-sm font-bold">
            {message}
          </p>
        )}

        <ul className="space-y-2">
          {groups.map((g) => {
            const members = groupMembers(g.member_ids, players);
            return (
              <li key={g.id} className="rounded-lg bg-paper px-3 py-2">
                <div className="flex items-center gap-2">
                  {g.color && (
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink/40"
                      style={{ backgroundColor: g.color }}
                      aria-hidden
                    />
                  )}
                  <span className="flex-1 truncate font-semibold">{g.name}</span>
                  <span className="shrink-0 text-xs text-ink/50">
                    {members.length} st
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteGroup(g.id, g.name)}
                    className="rounded-full bg-falu px-2.5 py-0.5 text-xs font-bold text-paper"
                  >
                    Ta bort
                  </button>
                </div>
                {members.length > 0 && (
                  <p className="mt-1 text-xs text-ink/60">
                    {members.map((m) => m.name).join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Uppdrag */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="mb-3 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          Uppdrag ({tasks.length})
        </h3>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Uppdrag"
            className={inputClass}
          />
          <input
            type="number"
            value={taskPoints}
            onChange={(e) => setTaskPoints(e.target.value)}
            aria-label="Poäng"
            className="w-20 shrink-0 rounded-lg border border-ink/25 bg-paper px-2 py-2"
          />
          <button type="button" onClick={addTask} className={primaryBtn}>
            +
          </button>
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2"
            >
              <span className="flex-1 truncate font-semibold">{t.title}</span>
              <span className="shrink-0 rounded-full bg-pine px-2 py-0.5 text-xs font-bold text-sun">
                {t.points} p
              </span>
              <button
                type="button"
                onClick={() => deleteTask(t.id, t.title)}
                className="rounded-full bg-falu px-2.5 py-0.5 text-xs font-bold text-paper"
              >
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Godkännande-rutnät */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="mb-1 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          Godkännande
        </h3>
        <p className="mb-3 text-sm text-ink/60">
          Tryck i en ruta för att godkänna/ångra ett uppdrag för en grupp.
        </p>
        {tasks.length === 0 || groups.length === 0 ? (
          <p className="text-sm text-ink/60">
            Lägg till minst en grupp och ett uppdrag först.
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white" />
                  {groups.map((g) => (
                    <th
                      key={g.id}
                      className="px-1 pb-1 text-center align-bottom text-xs font-bold"
                    >
                      <span className="block max-w-14 truncate">{g.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td className="sticky left-0 z-10 bg-white pr-2 text-sm font-semibold">
                      <span className="block max-w-40 truncate">{t.title}</span>
                      <span className="text-xs text-ink/50">{t.points} p</span>
                    </td>
                    {groups.map((g) => {
                      const done = completedSet.has(`${g.id}:${t.id}`);
                      return (
                        <td key={g.id} className="text-center">
                          <button
                            type="button"
                            onClick={() => toggleCompletion(g.id, t.id)}
                            aria-pressed={done}
                            aria-label={`${t.title} – ${g.name}`}
                            className={`h-9 w-9 rounded-lg border font-bold transition-transform active:scale-95 ${
                              done
                                ? "border-transparent bg-grass text-ink"
                                : "border-ink/20 bg-paper text-ink/30"
                            }`}
                          >
                            {done ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
