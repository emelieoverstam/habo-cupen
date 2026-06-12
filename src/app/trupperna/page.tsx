import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SquadView from "@/components/SquadView";

export const metadata: Metadata = {
  title: "Trupperna – Habo-cupen 2026",
  description: "BK Zeros Vit och Grön – spelarkorten för Habo-cupen 2026.",
};

export default async function TruppernaPage() {
  const supabase = await createClient();

  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase
      .from("players")
      .select("*")
      .order("number", { nullsFirst: false })
      .order("name"),
    supabase.from("teams").select("*").order("name"),
  ]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="trupperna" />
      <SquadView initialPlayers={players ?? []} teams={teams ?? []} />
    </main>
  );
}
