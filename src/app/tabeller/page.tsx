import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import StandingsView from "@/components/StandingsView";

export const metadata: Metadata = {
  title: "Tabeller – Habo-cupen 2026",
  description: "Gruppspelstabeller för BK Zeros i Habo-cupen 2026.",
};

export default async function TabellerPage() {
  const supabase = await createClient();

  const [{ data: standings }, { data: teams }] = await Promise.all([
    supabase.from("standings").select("*").order("position"),
    supabase.from("teams").select("*").order("name"),
  ]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="tabeller" />
      <StandingsView
        initialStandings={standings ?? []}
        teams={teams ?? []}
      />
    </main>
  );
}
