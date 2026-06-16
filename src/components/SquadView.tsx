"use client";

// Truppsidan: visar spelarkorten och håller dem uppdaterade live

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useScheduleLive } from "@/lib/use-schedule-live";
import SquadSection from "@/components/SquadSection";
import type { Tables } from "@/types/database";

export default function SquadView({
  initialPlayers,
  teams,
  captainsRevealed,
}: {
  initialPlayers: Tables<"players">[];
  teams: Tables<"teams">[];
  captainsRevealed: boolean;
}) {
  const [players, setPlayers] = useState(initialPlayers);

  const refresh = useCallback(async () => {
    const { data } = await createClient()
      .from("players")
      .select("*")
      .order("number", { nullsFirst: false })
      .order("name");
    if (data) setPlayers(data);
  }, []);

  useScheduleLive(refresh);

  return (
    <SquadSection
      players={players}
      teams={teams}
      captainsRevealed={captainsRevealed}
    />
  );
}
