import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PoangjaktView from "@/components/PoangjaktView";

export const metadata: Metadata = {
  title: "Poängjakt – Habo-cupen 2026",
  description: "Poängjakten under Habo-cupen 2026 – uppdrag, nedräkning och ställning.",
};

export default async function PoangjaktPage() {
  const supabase = await createClient();

  const [
    { data: tasks },
    { data: groups },
    { data: completions },
    { data: state },
    { data: players },
  ] = await Promise.all([
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
    supabase.from("players").select("*"),
  ]);

  return (
    <PoangjaktView
      initialTasks={tasks ?? []}
      initialGroups={groups ?? []}
      initialCompletions={completions ?? []}
      initialState={state ?? null}
      initialPlayers={players ?? []}
    />
  );
}
