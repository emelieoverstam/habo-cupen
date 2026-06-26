"use client";

// Publik vy för poängjakten: nedräkning + live-scoreboard + uppdragslista.
// Uppdragen visas bara om de är publicerade ELLER om man är inloggad ledare.
// Allt uppdateras live via broadcast-kanalen.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createClient } from "@/lib/supabase/client";
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
  scoreboard,
  timerView,
} from "@/lib/poangjakt";
import SiteHeader from "@/components/SiteHeader";

// Gruppens egen avbockning sparas lokalt på telefonen — påverkar inte poängen,
// utan är bara ett sätt för gruppen att hålla koll på vad de hunnit.
const DONE_KEY = "poangjakt-klart";

function subscribeDone(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DONE_KEY, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DONE_KEY, callback);
  };
}

/* Hydration-säker läsning av den lokala checklistan: servern och första
   klientrenderingen ser en tom lista, sedan fylls den på från localStorage. */
function useDoneSet(): [Set<string>, (taskId: string) => void] {
  const raw = useSyncExternalStore(
    subscribeDone,
    () => localStorage.getItem(DONE_KEY) ?? "",
    () => ""
  );
  const done = useMemo(() => {
    try {
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const toggle = useCallback(
    (taskId: string) => {
      const next = new Set(done);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      localStorage.setItem(DONE_KEY, JSON.stringify([...next]));
      window.dispatchEvent(new Event(DONE_KEY));
    },
    [done]
  );
  return [done, toggle];
}

export default function PoangjaktView({
  initialTasks,
  initialGroups,
  initialCompletions,
  initialState,
  initialPlayers,
}: {
  initialTasks: QuestTask[];
  initialGroups: QuestGroup[];
  initialCompletions: QuestCompletion[];
  initialState: QuestState | null;
  initialPlayers: Player[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [groups, setGroups] = useState(initialGroups);
  const [completions, setCompletions] = useState(initialCompletions);
  const [state, setState] = useState(initialState);
  const [players, setPlayers] = useState(initialPlayers);
  const [isLeader, setIsLeader] = useState(false);
  const now = useCurrentSecond();

  // Inloggade ledare ser uppdragen även innan de publicerats
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsLeader(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setIsLeader(!!session?.user)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [t, g, c, s, p] = await Promise.all([
      supabase.from("quest_tasks").select("*"),
      supabase.from("quest_groups").select("*"),
      supabase.from("quest_completions").select("*"),
      supabase.from("quest_state").select("*").limit(1).maybeSingle(),
      supabase.from("players").select("*"),
    ]);
    if (t.data) setTasks(t.data);
    if (g.data) setGroups(g.data);
    if (c.data) setCompletions(c.data);
    if (s.data) setState(s.data);
    if (p.data) setPlayers(p.data);
  }, []);
  useScheduleLive(refresh);

  const board = useMemo(
    () => scoreboard(groups, tasks, completions),
    [groups, tasks, completions]
  );
  const timer = timerView(state, now);
  const showTasks = !!state?.tasks_published || isLeader;

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => (a.sort_hint ?? 0) - (b.sort_hint ?? 0) || b.points - a.points
      ),
    [tasks]
  );

  // Gruppens egen avbockning (lokal på telefonen)
  const [done, toggleDone] = useDoneSet();
  const doneCount = sortedTasks.filter((t) => done.has(t.id)).length;

  // Vad som visas i den stora nedräkningsrutan
  const clock =
    timer.status === "idle"
      ? "Inte startad än"
      : timer.status === "ended"
        ? "Tiden är ute!"
        : now
          ? formatClock(timer.remainingMs)
          : "…";

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="poangjakt" />

      {/* Nedräkning */}
      <section
        className={`mb-5 rounded-2xl p-5 text-center shadow-card ${
          timer.status === "ended" ? "bg-falu text-paper" : "bg-pine text-paper"
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-sun">
          {timer.status === "running" ? "Tid kvar" : "Poängjakt"}
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] font-bold text-5xl leading-none tabular-nums">
          {clock}
        </p>
        {timer.status === "running" && (
          <p className="mt-2 text-sm font-semibold text-paper/80">
            {state?.tasks_published
              ? "Kör hårt – prioritera rätt uppdrag!"
              : "Snart kör vi igång."}
          </p>
        )}
      </section>

      {/* Scoreboard */}
      <section className="mb-5">
        <h2 className="mb-2 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-lg uppercase text-paper">
          Ställning
        </h2>
        {board.length === 0 ? (
          <p className="rounded-xl border border-dashed border-paper/30 px-4 py-6 text-center font-semibold text-paper/70">
            Inga grupper inlagda ännu.
          </p>
        ) : (
          <ol className="space-y-2">
            {board.map((row, i) => (
              <li
                key={row.group.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 shadow-card ${
                  i === 0 ? "bg-sun" : "bg-white"
                }`}
              >
                <span className="w-6 shrink-0 text-center font-[family-name:var(--font-display)] font-bold text-lg">
                  {i + 1}
                </span>
                {row.group.color && (
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink/40"
                    style={{ backgroundColor: row.group.color }}
                    aria-hidden
                  />
                )}
                <span className="min-w-0 flex-1 truncate font-bold">
                  {row.group.name}
                </span>
                <span className="shrink-0 text-xs font-semibold text-ink/50">
                  {row.done} st
                </span>
                <span className="shrink-0 font-[family-name:var(--font-display)] font-bold text-2xl tabular-nums">
                  {row.points}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Lagindelning */}
      {groups.some((g) => groupMembers(g.member_ids, players).length > 0) && (
        <section className="mb-5">
          <h2 className="mb-2 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-lg uppercase text-paper">
            Lagindelning
          </h2>
          <div className="space-y-3">
            {groups.map((g) => {
              const members = groupMembers(g.member_ids, players);
              if (members.length === 0) return null;
              return (
                <div key={g.id} className="rounded-xl bg-white p-3 shadow-card">
                  <p className="mb-1.5 flex items-center gap-2 font-[family-name:var(--font-display)] font-bold uppercase">
                    {g.color && (
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-ink/40"
                        style={{ backgroundColor: g.color }}
                        aria-hidden
                      />
                    )}
                    {g.name}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-full bg-paper px-2.5 py-1 text-sm font-semibold"
                      >
                        {m.name}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Uppdrag */}
      <section>
        <h2 className="mb-2 inline-block border-b-2 border-sun pb-0.5 font-[family-name:var(--font-display)] font-bold text-lg uppercase text-paper">
          Uppdrag
        </h2>
        {!showTasks ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-card">
            <p className="text-4xl" aria-hidden>
              🤫
            </p>
            <p className="mt-2 font-semibold text-ink/70">
              Uppdragen avslöjas snart!
            </p>
          </div>
        ) : sortedTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-paper/30 px-4 py-6 text-center font-semibold text-paper/70">
            Inga uppdrag inlagda ännu.
          </p>
        ) : (
          <>
            {isLeader && !state?.tasks_published && (
              <p className="mb-2 rounded-lg bg-sun/40 px-3 py-1.5 text-sm font-semibold">
                Bara du som ledare ser uppdragen — de är inte publicerade ännu.
              </p>
            )}
            <div className="mb-3 rounded-xl bg-white p-3 text-sm shadow-card">
              <p className="mb-1 font-[family-name:var(--font-display)] font-bold uppercase">
                📋 Bra att veta
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-ink/80">
                <li>Visa eller utför uppdraget för en ledare för att få poäng.</li>
                <li>
                  <strong>Filmar ni någon – fråga alltid om lov först.</strong>{" "}
                  Klippen visas bara för en ledare och läggs aldrig ut någonstans.
                </li>
                <li>Ni hinner inte allt – välj smart vilka uppdrag ni tar!</li>
              </ul>
            </div>
            <p className="mb-2 text-sm font-semibold text-paper/80">
              Din checklista · {doneCount}/{sortedTasks.length} avbockade{" "}
              <span className="font-normal text-paper/50">
                (sparas på den här mobilen)
              </span>
            </p>
            <ul className="space-y-2">
              {sortedTasks.map((task, i) => {
                const checked = done.has(task.id);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => toggleDone(task.id)}
                      aria-pressed={checked}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left shadow-card transition-colors ${
                        checked ? "bg-paper" : "bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold ${
                          checked
                            ? "border-grass bg-grass text-ink"
                            : "border-ink/30 text-transparent"
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="w-5 shrink-0 text-center font-[family-name:var(--font-display)] font-bold text-ink/40">
                        {i + 1}
                      </span>
                      <span
                        className={`min-w-0 flex-1 font-semibold ${
                          checked ? "text-ink/45 line-through" : ""
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-pine px-2.5 py-0.5 font-[family-name:var(--font-display)] font-bold text-sm text-sun">
                        {task.points} p
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
