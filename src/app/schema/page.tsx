import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ScheduleView from "@/components/ScheduleView";

export const metadata: Metadata = {
  title: "Schema – Habo-cupen 2026",
  description:
    "Schema för BK Zeros under Habo-cupen 2026 – matcher, mat och allt däremellan.",
};

export default async function SchemaPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: events }, { data: matches }] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase
        .from("events")
        .select("*")
        .order("day")
        .order("starts_at", { nullsFirst: false })
        .order("sort_hint"),
      supabase.from("matches").select("*").order("starts_at"),
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
      today={today}
    />
  );
}
