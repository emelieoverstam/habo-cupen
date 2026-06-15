// Delade typer och ren logik för ledar-chatten. Inga React- eller
// serverberoenden — beskrivningarna används både i klientens bekräftelsekort
// och för att tolka assistentens förslag. Verktygsnamnen är ASCII (krav från
// Anthropic) men all användarvänd text är på svenska.

import type { Enums, Tables } from "@/types/database";
import { EVENT_META, type EventType } from "@/lib/event-meta";

type CupEvent = Tables<"events">;
type Team = Tables<"teams">;
type Match = Tables<"matches">;
type EventStatus = Enums<"event_status">;

// Fälten boten kan föreslå för en hålltid. Spegling av events-kolumnerna, men
// med tid/dag som separata strängar (samma uppdelning som admin-formuläret).
export type EventFields = {
  type?: EventType;
  title?: string;
  day?: string; // YYYY-MM-DD
  time?: string | null; // HH:MM, null = rensa tiden
  team_id?: string | null; // null = båda lagen
  location?: string | null;
  note?: string | null;
  status?: EventStatus;
};

// Ett förslag från assistenten. Skrivs aldrig automatiskt — ledaren bekräftar
// innan klienten utför det mot Supabase (under sin egen session + RLS).
export type Proposal =
  | { tool: "create_event"; args: { type: EventType; title: string; day: string } & EventFields }
  | { tool: "update_event"; args: { event_id: string } & EventFields }
  | { tool: "cancel_event"; args: { event_id: string } }
  | { tool: "delete_event"; args: { event_id: string } }
  | { tool: "delete_briefing"; args: { team_id: string; match_id: string | null } }
  | {
      tool: "update_briefing";
      args: {
        team_id: string;
        match_id: string | null;
        formation?: string | null;
        offensive?: string | null;
        defensive?: string | null;
        note?: string | null;
      };
    };

export type AssistantReply = {
  text: string;
  proposal?: Proposal;
};

// Uppslagsdata som behövs för att skriva läsbara sammanfattningar.
export type ProposalContext = {
  teams: Team[];
  matches: Match[];
  events: CupEvent[];
};

const STATUS_LABELS: Record<EventStatus, string> = {
  confirmed: "bekräftad",
  tbd: "preliminär tid",
  cancelled: "inställd",
};

function teamName(teams: Team[], id: string | null | undefined): string {
  if (!id) return "båda lagen";
  return teams.find((t) => t.id === id)?.name ?? "okänt lag";
}

function matchLabel(matches: Match[], id: string | null): string {
  if (!id) return "lagets mall";
  const m = matches.find((mm) => mm.id === id);
  return m ? `${m.home_team} – ${m.away_team}` : "okänd match";
}

const dayFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Stockholm",
});

function dayLabel(day: string): string {
  return dayFormat.format(new Date(`${day}T12:00:00`));
}

// Beskriv ändringarna på en hålltid i punktform (för update_event).
function describeEventFields(fields: EventFields, ctx: ProposalContext): string[] {
  const parts: string[] = [];
  if (fields.type) parts.push(`typ → ${EVENT_META[fields.type].label}`);
  if (fields.title !== undefined) parts.push(`titel → "${fields.title}"`);
  if (fields.day) parts.push(`dag → ${dayLabel(fields.day)}`);
  if (fields.time !== undefined)
    parts.push(fields.time ? `tid → ${fields.time}` : "tid → tas bort");
  if (fields.team_id !== undefined)
    parts.push(`lag → ${teamName(ctx.teams, fields.team_id)}`);
  if (fields.location !== undefined)
    parts.push(fields.location ? `plats → ${fields.location}` : "plats → tas bort");
  if (fields.note !== undefined)
    parts.push(fields.note ? `notering → ${fields.note}` : "notering → tas bort");
  if (fields.status) parts.push(`status → ${STATUS_LABELS[fields.status]}`);
  return parts;
}

// En kort, mänsklig sammanfattning av vad förslaget gör. Genereras här (inte av
// modellen) så att kortet alltid speglar exakt det som kommer att sparas.
export function describeProposal(proposal: Proposal, ctx: ProposalContext): string {
  switch (proposal.tool) {
    case "create_event": {
      const a = proposal.args;
      const when = a.time ? `kl ${a.time}` : "utan tid";
      const team = teamName(ctx.teams, a.team_id);
      const extra = [
        a.location ? `plats: ${a.location}` : null,
        a.note ? `notering: ${a.note}` : null,
        a.status && a.status !== "confirmed" ? `status: ${STATUS_LABELS[a.status]}` : null,
      ].filter(Boolean);
      return (
        `Lägg till hålltid: ${EVENT_META[a.type].emoji} "${a.title}" ` +
        `${dayLabel(a.day)} ${when} · ${team}` +
        (extra.length ? ` (${extra.join(", ")})` : "")
      );
    }
    case "update_event": {
      const a = proposal.args;
      const existing = ctx.events.find((e) => e.id === a.event_id);
      const label = existing ? `"${existing.title}"` : "hålltiden";
      const changes = describeEventFields(a, ctx);
      return changes.length
        ? `Ändra ${label}: ${changes.join(", ")}`
        : `Ändra ${label} (inga fält angivna)`;
    }
    case "cancel_event": {
      const existing = ctx.events.find((e) => e.id === proposal.args.event_id);
      return `Ställ in hålltiden ${existing ? `"${existing.title}"` : ""}`.trim();
    }
    case "delete_event": {
      const existing = ctx.events.find((e) => e.id === proposal.args.event_id);
      return `Ta bort hålltiden ${existing ? `"${existing.title}"` : ""} helt från schemat`.trim();
    }
    case "delete_briefing": {
      const a = proposal.args;
      return (
        `Ta bort matchgenomgången för ${teamName(ctx.teams, a.team_id)} ` +
        `(${matchLabel(ctx.matches, a.match_id)}) helt`
      );
    }
    case "update_briefing": {
      const a = proposal.args;
      const changes = [
        a.formation !== undefined
          ? a.formation
            ? `formation → ${a.formation}`
            : "formation → tas bort"
          : null,
        a.offensive !== undefined ? "offensivt uppdateras" : null,
        a.defensive !== undefined ? "defensivt uppdateras" : null,
        a.note !== undefined ? "anteckning uppdateras" : null,
      ].filter(Boolean);
      return (
        `Uppdatera matchgenomgång för ${teamName(ctx.teams, a.team_id)} ` +
        `(${matchLabel(ctx.matches, a.match_id)})` +
        (changes.length ? `: ${changes.join(", ")}` : "")
      );
    }
  }
}
