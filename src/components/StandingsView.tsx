"use client";

// Tabellsidan: visar gruppspelstabellerna och håller dem uppdaterade live

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useScheduleLive } from "@/lib/use-schedule-live";
import StandingsSection from "@/components/StandingsSection";
import type { Tables } from "@/types/database";

export default function StandingsView({
  initialStandings,
  teams,
}: {
  initialStandings: Tables<"standings">[];
  teams: Tables<"teams">[];
}) {
  const [standings, setStandings] = useState(initialStandings);

  const refresh = useCallback(async () => {
    const { data } = await createClient()
      .from("standings")
      .select("*")
      .order("position");
    if (data) setStandings(data);
  }, []);

  useScheduleLive(refresh);

  return <StandingsSection standings={standings} teams={teams} />;
}
