// Ledar-chatten: tolkar ledarens meddelande med Claude och föreslår en åtgärd.
// Routen SKRIVER ingenting till databasen — den returnerar bara ett förslag som
// ledaren bekräftar i klienten, där skrivningen sedan sker under ledarens egen
// session och RLS. API-nyckeln stannar därmed på servern och behörigheterna
// kan aldrig kringgås.

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Proposal } from "@/lib/assistant";

// Sonnet följer verktygsinstruktioner pålitligt — avgörande för att boten
// faktiskt anropar ett verktyg när en ändring ska göras, i stället för att bara
// påstå i text att den gjort något (som Haiku ibland gjorde).
const MODEL = "claude-sonnet-4-6";

const EVENT_TYPES = ["match", "mat", "somn", "hygien", "samling", "ovrigt"] as const;
const EVENT_STATUS = ["confirmed", "tbd", "cancelled"] as const;

const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

// Skyddsnät: känns igen när modellen i text påstår att en åtgärd redan är
// utförd (dåtid). Då ska den egentligen ha anropat ett verktyg.
function claimsActionDone(text: string): boolean {
  return (
    /\b(ändrat|ändrade|flyttat|flyttade|lade till|lagt till|tog bort|tagit bort|ställde in|ställt in|raderade|raderat|sparade|sparat|uppdaterade|uppdaterat|bytte|bytt|la in|lagt in)\b/i.test(
      text
    ) || /✅|\bär (gjort|fixat|klart|inställt|tillagt|borttaget|ändrat|uppdaterat)\b/i.test(text)
  );
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  // Utan API-nyckel kan boten inte svara — svara lugnt i stället för att krascha
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY saknas i miljövariablerna." },
      { status: 503 }
    );
  }

  const supabase = await createClient();

  // Bara inloggade ledare får använda boten
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Du måste vara inloggad." }, { status: 401 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }
  const rawMessages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
  if (rawMessages.length === 0) {
    return Response.json({ error: "Inget meddelande." }, { status: 400 });
  }

  // Slå ihop intilliggande meddelanden med samma roll — efter en bekräftelse kan
  // två assistentmeddelanden hamna i rad, och Claude kräver växlande roller.
  const messages: ChatMessage[] = [];
  for (const m of rawMessages) {
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n${m.content}`;
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  // Färsk kontext så modellen refererar till rätt id:n
  const [{ data: teams }, { data: events }, { data: matches }, { data: briefings }] =
    await Promise.all([
      supabase.from("teams").select("id, name").order("name"),
      supabase
        .from("events")
        .select("id, type, title, day, starts_at, team_id, status")
        .order("day")
        .order("starts_at", { nullsFirst: false }),
      supabase.from("matches").select("id, home_team, away_team, starts_at").order("starts_at"),
      supabase.from("match_briefings").select("team_id, match_id"),
    ]);

  const teamNames = new Set((teams ?? []).map((t) => t.name));
  // Bara våra matcher är relevanta för genomgångar — håll kontexten liten
  const ourMatches = (matches ?? []).filter(
    (m) => teamNames.has(m.home_team) || teamNames.has(m.away_team)
  );

  const context = {
    idag: new Date().toISOString().slice(0, 10),
    lag: teams ?? [],
    hålltider: (events ?? []).map((e) => ({
      id: e.id,
      typ: e.type,
      titel: e.title,
      dag: e.day,
      tid: e.starts_at ? timeFormat.format(new Date(e.starts_at)) : null,
      lag_id: e.team_id,
      status: e.status,
    })),
    matcher: ourMatches.map((m) => ({
      id: m.id,
      hemma: m.home_team,
      borta: m.away_team,
      tid: m.starts_at,
    })),
    befintliga_genomgångar: briefings ?? [],
  };

  const system = `Du är en assistent för ledarna i fotbollslaget F13 under Habo-cupen 2026. Ledarna chattar med dig på svenska för att snabbt uppdatera appens innehåll under cupen.

SÅ HÄR FUNGERAR DU – LÄS NOGA:
- Du utför ALDRIG ändringar själv. En ändring sker bara genom att du anropar rätt verktyg OCH ledaren därefter trycker "Bekräfta" i appen.
- För att göra en ändring MÅSTE du anropa det verktyg som passar. Att enbart beskriva ändringen i text gör INGENTING i appen.
- Påstå därför ALDRIG att något redan är gjort, ändrat, sparat, tillagt, borttaget eller inställt. Det är det inte förrän ledaren tryckt Bekräfta. Använd aldrig dåtid som om åtgärden är klar.
- Formulera dig som ett förslag, t.ex. "Jag lägger till … – tryck Bekräfta för att spara." eller "Vill du att jag flyttar …?".
- Förstår du vilken konkret ändring ledaren vill ha: anropa verktyget direkt i samma svar. Är något oklart (vilket lag, vilken match eller vilken hålltid) – ställ en kort följdfråga i stället för att gissa eller anropa verktyget.

Verktyg:
- create_event: lägg till en hålltid (samling, mat, sömn, hygien, match, övrigt)
- update_event: ändra en befintlig hålltid (flytta tid, byta plats, ändra status m.m.)
- cancel_event: ställ in en hålltid (status inställd, men den finns kvar i schemat)
- delete_event: ta bort en hålltid HELT från schemat (permanent, kan inte ångras)
- update_briefing: uppdatera textinnehållet i en matchgenomgång (formation och taktik)
- delete_briefing: ta bort en hel matchgenomgång (permanent)

Regler:
- En åtgärd i taget.
- Använd ALLTID id:n från kontexten nedan (lag_id, event_id, match_id). Hitta aldrig på id:n.
- Tider anges i HH:MM (svensk tid), datum i YYYY-MM-DD. Cupen spelas i juni 2026.
- För update_event: ta bara med de fält som faktiskt ändras.
- Skilj på att ställa in och att ta bort: "ställ in"/"pausa" → cancel_event. "ta bort"/"radera" → delete_event. Är du osäker, fråga.
- För matchgenomgångar kan du bara ändra text (formation, offensivt, defensivt, anteckning). Uppställningen redigeras i appen. match_id = null betyder lagets mall.
- Du får ALDRIG röra matcher, resultat eller tabeller – de synkas automatiskt från Cupmate.
- Har en åtgärd redan bekräftats och sparats (syns som "✅ Sparat" i chatten) – föreslå den inte igen.
- Skriv kortfattat och vänligt.

Kontext (aktuell data):
${JSON.stringify(context)}`;

  const eventFieldShape = {
    type: z.enum(EVENT_TYPES).optional().describe("Eventtyp"),
    title: z.string().optional().describe("Kort titel, t.ex. 'Lunch i matsalen'"),
    day: z.string().optional().describe("Datum YYYY-MM-DD"),
    time: z.string().nullable().optional().describe("Tid HH:MM. null tar bort tiden."),
    team_id: z
      .string()
      .nullable()
      .optional()
      .describe("Lagets id från kontexten. null = gäller båda lagen."),
    location: z.string().nullable().optional().describe("Plats. null tar bort platsen."),
    note: z.string().nullable().optional().describe("Notering. null tar bort noteringen."),
    status: z.enum(EVENT_STATUS).optional().describe("confirmed, tbd eller cancelled"),
  };

  const tools = {
    create_event: tool({
      description: "Lägg till en ny hålltid i schemat.",
      inputSchema: z.object({
        type: z.enum(EVENT_TYPES).describe("Eventtyp"),
        title: z.string().describe("Kort titel"),
        day: z.string().describe("Datum YYYY-MM-DD"),
        time: z.string().nullable().optional().describe("Tid HH:MM, utelämna om okänd"),
        team_id: z
          .string()
          .nullable()
          .optional()
          .describe("Lagets id. Utelämna eller null för båda lagen."),
        location: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        status: z.enum(EVENT_STATUS).optional().describe("Standard: confirmed"),
      }),
    }),
    update_event: tool({
      description: "Ändra en befintlig hålltid. Ange event_id och bara de fält som ändras.",
      inputSchema: z.object({
        event_id: z.string().describe("Id för hålltiden som ändras (från kontexten)"),
        ...eventFieldShape,
      }),
    }),
    cancel_event: tool({
      description:
        "Ställ in en hålltid (sätter status till cancelled). Hålltiden finns kvar i schemat, markerad som inställd.",
      inputSchema: z.object({
        event_id: z.string().describe("Id för hålltiden som ställs in"),
      }),
    }),
    delete_event: tool({
      description:
        "Ta bort en hålltid HELT och permanent från schemat. Kan inte ångras. Använd bara när ledaren tydligt vill radera, inte bara ställa in.",
      inputSchema: z.object({
        event_id: z.string().describe("Id för hålltiden som tas bort"),
      }),
    }),
    delete_briefing: tool({
      description:
        "Ta bort en hel matchgenomgång permanent. Ange lag och match (eller null för lagets mall).",
      inputSchema: z.object({
        team_id: z.string().describe("Lagets id"),
        match_id: z
          .string()
          .nullable()
          .describe("Matchens id, eller null för lagets mall"),
      }),
    }),
    update_briefing: tool({
      description:
        "Uppdatera textinnehållet i en matchgenomgång. Bara formation och taktiktext, inte uppställningen.",
      inputSchema: z.object({
        team_id: z.string().describe("Lagets id"),
        match_id: z
          .string()
          .nullable()
          .describe("Matchens id, eller null för lagets mall"),
        formation: z.string().nullable().optional().describe("t.ex. 1-3-2-3"),
        offensive: z.string().nullable().optional().describe("Offensiva punkter, en per rad"),
        defensive: z.string().nullable().optional().describe("Defensiva punkter, en per rad"),
        note: z.string().nullable().optional(),
      }),
    }),
  };

  try {
    const baseOptions = {
      model: anthropic(MODEL),
      system,
      messages,
      tools,
      temperature: 0,
    };
    let result = await generateText(baseOptions);

    // Skyddsnät: om modellen låter klar i text men inte anropade något verktyg,
    // tvinga fram ett verktygsanrop så att en riktig åtgärd skapas i stället för
    // ett tomt "klart"-svar.
    if (result.toolCalls.length === 0 && claimsActionDone(result.text)) {
      const forced = await generateText({ ...baseOptions, toolChoice: "required" });
      if (forced.toolCalls.length > 0) result = forced;
    }

    const call = result.toolCalls[0];
    const proposal = call
      ? ({ tool: call.toolName, args: call.input } as Proposal)
      : undefined;

    // Ge ett vänligt standardsvar om modellen varken skrev text eller föreslog något
    const text =
      result.text.trim() ||
      (proposal ? "Jag har ett förslag nedan." : "Förlåt, jag förstod inte riktigt. Kan du formulera om?");

    return Response.json({ text, proposal });
  } catch (err) {
    console.error("Assistant-fel:", err);
    return Response.json(
      { error: "Något gick fel när jag skulle tänka. Försök igen." },
      { status: 500 }
    );
  }
}
