import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const supabase = await createClient();

  const [
    { data: teams },
    { data: events },
    { data: matches },
    { data: standings },
    { data: players },
    { data: notices },
  ] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("events")
      .select("*")
      .order("day")
      .order("starts_at", { nullsFirst: false }),
    supabase.from("matches").select("*").order("starts_at"),
    supabase.from("standings").select("*").order("position"),
    supabase
      .from("players")
      .select("*")
      .order("number", { nullsFirst: false }),
    supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <Dashboard
      initialTeams={teams ?? []}
      initialEvents={events ?? []}
      initialMatches={matches ?? []}
      initialStandings={standings ?? []}
      initialPlayers={players ?? []}
      initialNotices={notices ?? []}
    />
  );
}
