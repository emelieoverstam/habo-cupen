// Gruppspelstabeller med BK Zeros-raderna markerade
import { useMemo } from "react";
import TeamMarker from "@/components/TeamMarker";
import type { Tables } from "@/types/database";

type Team = Tables<"teams">;
type Standing = Tables<"standings">;

export default function StandingsSection({
  standings,
  teams,
}: {
  standings: Standing[];
  teams: Team[];
}) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, Standing[]>();
    for (const row of standings) {
      const list = byGroup.get(row.group_name) ?? [];
      list.push(row);
      byGroup.set(row.group_name, list);
    }
    for (const list of byGroup.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b, "sv"));
  }, [standings]);

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-paper/30 px-4 py-8 text-center font-semibold text-paper/70">
        Tabellerna kommer när gruppspelet drar igång.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([groupName, rows]) => {
        const ourTeam = teams.find((t) =>
          rows.some((r) => r.team_name === t.name)
        );
        return (
          <div
            key={groupName}
            className="rise overflow-hidden rounded-xl bg-white shadow-card"
          >
            <p className="flex items-center justify-between bg-grass px-4 py-2 font-[family-name:var(--font-display)] font-bold text-sm uppercase">
              {groupName}
              {ourTeam && (
                <span className="text-sm normal-case">
                  <TeamMarker team={ourTeam} />
                </span>
              )}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/20 text-left text-xs uppercase text-ink/60">
                  <th className="py-1.5 pl-4 pr-2 font-bold">Lag</th>
                  <th className="px-1.5 text-center font-bold">S</th>
                  <th className="px-1.5 text-center font-bold">V</th>
                  <th className="px-1.5 text-center font-bold">O</th>
                  <th className="px-1.5 text-center font-bold">F</th>
                  <th className="px-1.5 text-center font-bold">+/−</th>
                  <th className="py-1.5 pl-1.5 pr-4 text-center font-bold">
                    P
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const ours = teams.some((t) => t.name === row.team_name);
                  return (
                    <tr
                      key={row.team_name}
                      className={`border-b border-ink/10 last:border-0 ${
                        ours ? "bg-sun/30 font-bold" : ""
                      }`}
                    >
                      <td className="truncate py-2 pl-4 pr-2">
                        {row.position}. {row.team_name}
                      </td>
                      <td className="px-1.5 text-center tabular-nums">
                        {row.played}
                      </td>
                      <td className="px-1.5 text-center tabular-nums">
                        {row.won}
                      </td>
                      <td className="px-1.5 text-center tabular-nums">
                        {row.drawn}
                      </td>
                      <td className="px-1.5 text-center tabular-nums">
                        {row.lost}
                      </td>
                      <td className="px-1.5 text-center tabular-nums">
                        {row.goal_diff}
                      </td>
                      <td className="py-2 pl-1.5 pr-4 text-center font-bold tabular-nums">
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
