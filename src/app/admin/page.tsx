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
    { data: captainInfo },
    { data: profiles },
    { data: questTasks },
    { data: questGroups },
    { data: questCompletions },
    { data: questState },
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
    supabase.from("captain_info").select("*").limit(1).maybeSingle(),
    supabase.from("profiles").select("*").order("name"),
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

  return (
    <AdminPanel
      initialEvents={events ?? []}
      initialTeams={teams ?? []}
      initialPlayers={players ?? []}
      initialMatches={matches ?? []}
      initialBriefings={(briefings ?? []).map(parseBriefing)}
      initialCaptainInfo={captainInfo ?? null}
      initialProfiles={profiles ?? []}
      initialQuestTasks={questTasks ?? []}
      initialQuestGroups={questGroups ?? []}
      initialQuestCompletions={questCompletions ?? []}
      initialQuestState={questState ?? null}
    />
  );
}
