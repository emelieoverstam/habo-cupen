import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Ledar-admin – Habo-cupen 2026",
  robots: { index: false },
};

export default async function AdminPage() {
  const supabase = await createClient();

  const [{ data: events }, { data: teams }, { data: players }] =
    await Promise.all([
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
    ]);

  return (
    <AdminPanel
      initialEvents={events ?? []}
      initialTeams={teams ?? []}
      initialPlayers={players ?? []}
    />
  );
}
