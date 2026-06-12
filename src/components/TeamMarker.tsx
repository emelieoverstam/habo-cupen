// Liten lagprick med namn — används i kort, tabeller och trupper
import type { Tables } from "@/types/database";

export default function TeamMarker({ team }: { team?: Tables<"teams"> }) {
  if (!team) return <span className="font-semibold">Båda lagen</span>;
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      <span
        className="inline-block h-2 w-2 rounded-full border border-ink/40"
        style={{ backgroundColor: team.color }}
        aria-hidden
      />
      {team.name.replace("BK Zeros ", "")}
    </span>
  );
}
