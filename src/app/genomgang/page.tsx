import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { parseBriefing } from "@/lib/briefing";
import GenomgangView from "@/components/GenomgangView";

export const metadata: Metadata = {
  title: "Genomgång – Habo-cupen 2026",
  description:
    "Matchgenomgång för BK Zeros under Habo-cupen 2026 – laguppställning och taktik.",
};

export default async function GenomgangPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: players }, { data: matches }, { data: briefings }] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase
        .from("players")
        .select("*")
        .order("number", { nullsFirst: false })
        .order("name"),
      supabase.from("matches").select("*").order("starts_at"),
      supabase.from("match_briefings").select("*"),
    ]);

  return (
    <GenomgangView
      initialTeams={teams ?? []}
      initialPlayers={players ?? []}
      initialMatches={matches ?? []}
      initialBriefings={(briefings ?? []).map(parseBriefing)}
    />
  );
}
