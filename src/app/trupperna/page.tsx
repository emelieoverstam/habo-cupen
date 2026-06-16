import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SquadView from "@/components/SquadView";
import CaptainsSection from "@/components/CaptainsSection";

export const metadata: Metadata = {
  title: "Trupperna – Habo-cupen 2026",
  description: "BK Zeros Vit och Grön – spelarkorten för Habo-cupen 2026.",
};

export default async function TruppernaPage() {
  const supabase = await createClient();

  const [{ data: players }, { data: teams }, { data: captainInfo }] =
    await Promise.all([
      supabase
        .from("players")
        .select("*")
        .order("number", { nullsFirst: false })
        .order("name"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("captain_info").select("*").limit(1).maybeSingle(),
    ]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="trupperna" />
      <SquadView
        initialPlayers={players ?? []}
        teams={teams ?? []}
        captainsRevealed={captainInfo?.captains_revealed ?? false}
      />
      <CaptainsSection
        teams={teams ?? []}
        players={players ?? []}
        responsibilities={captainInfo?.responsibilities ?? null}
        revealed={captainInfo?.captains_revealed ?? false}
      />
    </main>
  );
}
