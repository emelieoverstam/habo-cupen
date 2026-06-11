import { createClient } from "@/lib/supabase/server";
import ScheduleView from "@/components/ScheduleView";

export default async function Home() {
  const supabase = await createClient();

  const [
    { data: teams },
    { data: events },
    { data: matches },
    { data: standings },
  ] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("events")
      .select("*")
      .order("day")
      .order("starts_at", { nullsFirst: false })
      .order("sort_hint"),
    supabase.from("matches").select("*").order("starts_at"),
    supabase.from("standings").select("*").order("position"),
  ]);

  // Dagens datum i svensk tidszon (sv-SE ger formatet ÅÅÅÅ-MM-DD)
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
  }).format(new Date());

  return (
    <ScheduleView
      initialTeams={teams ?? []}
      initialEvents={events ?? []}
      initialMatches={matches ?? []}
      initialStandings={standings ?? []}
      today={today}
    />
  );
}
