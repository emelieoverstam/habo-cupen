"use client";

// Ledar-chatten: ledaren skriver i naturligt språk ("flytta samlingen till
// halv tio") och boten föreslår en ändring. Först när ledaren trycker Spara
// utförs skrivningen — via ledarens egen Supabase-session och RLS, så samma
// behörigheter som i admin-formulären gäller. Routen /api/assistant tolkar
// bara texten och rör aldrig databasen.

import { useCallback, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";
import { parseBriefing, type Briefing } from "@/lib/briefing";
import { notifyScheduleChanged } from "@/lib/use-schedule-live";
import {
  describeProposal,
  type AssistantReply,
  type Proposal,
} from "@/lib/assistant";

type Team = Tables<"teams">;
type CupEvent = Tables<"events">;
type Match = Tables<"matches">;
type Supabase = ReturnType<typeof createClient>;

type ChatMessage = { role: "user" | "assistant"; content: string };

// Cupen spelas i juni — svensk sommartid (+02:00), samma som admin-formuläret
const TZ_OFFSET = "+02:00";

const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});

const WELCOME =
  "Hej! Skriv vad du vill ändra, t.ex. „Flytta samlingen imorgon till 09:30” eller „Lägg till lunch kl 12 vid kiosken”. Jag visar ett förslag som du får bekräfta innan något sparas.";

export default function LeaderChat({
  supabase,
  teams,
  initialEvents,
  matches,
  initialBriefings,
}: {
  supabase: Supabase;
  teams: Team[];
  initialEvents: CupEvent[];
  matches: Match[];
  initialBriefings: Briefing[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  // Lokala kopior som hålls färska efter varje skrivning, så förslagen kan
  // slå upp rätt id:n och sammanfattningar
  const [events, setEvents] = useState<CupEvent[]>(initialEvents);
  const [briefings, setBriefings] = useState<Briefing[]>(initialBriefings);

  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    // Vänta in att DOM:en hunnit uppdateras innan vi rullar ner
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }, []);

  const refreshData = useCallback(async () => {
    const [{ data: ev }, { data: br }] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .order("day")
        .order("starts_at", { nullsFirst: false }),
      supabase.from("match_briefings").select("*"),
    ]);
    if (ev) setEvents(ev);
    if (br) setBriefings(br.map(parseBriefing));
  }, [supabase]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    // Ett nytt meddelande avbryter ett väntande förslag
    setProposal(null);
    setError(null);

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Skippa välkomsthälsningen — den är bara för ledaren, inte modellen
        body: JSON.stringify({ messages: next.slice(1) }),
      });
      const data: AssistantReply & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Något gick fel.");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.text }]);
      if (data.proposal) setProposal(data.proposal);
    } catch {
      setError("Kunde inte nå assistenten. Är du uppkopplad?");
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  // Utför den bekräftade åtgärden mot Supabase (RLS skyddar)
  async function applyProposal(p: Proposal): Promise<void> {
    switch (p.tool) {
      case "create_event": {
        const a = p.args;
        const { error } = await supabase.from("events").insert({
          type: a.type,
          title: a.title.trim(),
          day: a.day,
          starts_at: a.time ? `${a.day}T${a.time}:00${TZ_OFFSET}` : null,
          team_id: a.team_id ?? null,
          location: a.location?.trim() || null,
          note: a.note?.trim() || null,
          status: a.status ?? "confirmed",
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "update_event": {
        const a = p.args;
        const existing = events.find((e) => e.id === a.event_id);
        const payload: Partial<CupEvent> = {};
        if (a.type !== undefined) payload.type = a.type;
        if (a.title !== undefined) payload.title = a.title.trim();
        if (a.day !== undefined) payload.day = a.day;
        if (a.team_id !== undefined) payload.team_id = a.team_id;
        if (a.location !== undefined) payload.location = a.location?.trim() || null;
        if (a.note !== undefined) payload.note = a.note?.trim() || null;
        if (a.status !== undefined) payload.status = a.status;
        // Tid: ny tid (eller borttagning) väger tyngst
        if (a.time !== undefined) {
          const day = a.day ?? existing?.day;
          payload.starts_at = a.time && day ? `${day}T${a.time}:00${TZ_OFFSET}` : null;
        } else if (a.day !== undefined && existing?.starts_at) {
          // Dagen ändrades men inte tiden — behåll tiden på den nya dagen
          const hhmm = timeFormat.format(new Date(existing.starts_at));
          payload.starts_at = `${a.day}T${hhmm}:00${TZ_OFFSET}`;
        }
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", a.event_id);
        if (error) throw new Error(error.message);
        break;
      }
      case "cancel_event": {
        const { error } = await supabase
          .from("events")
          .update({ status: "cancelled" })
          .eq("id", p.args.event_id);
        if (error) throw new Error(error.message);
        break;
      }
      case "delete_event": {
        const { error } = await supabase
          .from("events")
          .delete()
          .eq("id", p.args.event_id);
        if (error) throw new Error(error.message);
        break;
      }
      case "delete_briefing": {
        const a = p.args;
        const existing = briefings.find(
          (b) => b.team_id === a.team_id && (b.match_id ?? null) === (a.match_id ?? null)
        );
        if (!existing) {
          throw new Error("Hittade ingen genomgång att ta bort.");
        }
        const { error } = await supabase
          .from("match_briefings")
          .delete()
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        break;
      }
      case "update_briefing": {
        const a = p.args;
        const existing = briefings.find(
          (b) => b.team_id === a.team_id && (b.match_id ?? null) === (a.match_id ?? null)
        );
        const fields: Partial<
          Pick<
            Tables<"match_briefings">,
            "formation" | "offensive" | "defensive" | "note"
          >
        > = {};
        if (a.formation !== undefined) fields.formation = a.formation?.trim() || null;
        if (a.offensive !== undefined) fields.offensive = a.offensive?.trim() || null;
        if (a.defensive !== undefined) fields.defensive = a.defensive?.trim() || null;
        if (a.note !== undefined) fields.note = a.note?.trim() || null;

        if (existing) {
          const { error } = await supabase
            .from("match_briefings")
            .update(fields)
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
        } else {
          // Ny genomgång — tom uppställning, den redigeras i appen
          const { error } = await supabase.from("match_briefings").insert({
            team_id: a.team_id,
            match_id: a.match_id ?? null,
            lineup: [] as unknown as Tables<"match_briefings">["lineup"],
            bench: [] as unknown as Tables<"match_briefings">["bench"],
            ...fields,
          });
          if (error) throw new Error(error.message);
        }
        break;
      }
    }
  }

  async function confirmProposal() {
    if (!proposal || busy) return;
    setBusy(true);
    setError(null);
    const summary = describeProposal(proposal, { teams, matches, events });
    try {
      await applyProposal(proposal);
      await refreshData();
      // Säg åt alla öppna vyer (schema, genomgång m.m.) att hämta om direkt
      notifyScheduleChanged();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `✅ Sparat: ${summary}` },
      ]);
      setProposal(null);
    } catch (err) {
      setError(
        `Kunde inte spara: ${err instanceof Error ? err.message : "okänt fel"}`
      );
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  function cancelProposal() {
    setProposal(null);
    setMessages((m) => [
      ...m,
      { role: "assistant", content: "Okej, jag ändrar inget. Säg till om du vill något annat." },
    ]);
    scrollToBottom();
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto bg-paper/60 p-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "rounded-br-sm bg-grass font-semibold text-ink"
                  : "rounded-bl-sm bg-white text-ink shadow-chip"
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
        {busy && !proposal && (
          <p className="text-sm font-semibold text-ink/50">Assistenten skriver…</p>
        )}
      </div>

      <div className="space-y-3 border-t border-ink/10 p-3">
        {/* Förslagskort — inget sparas förrän ledaren bekräftar */}
        {proposal && (
          <div className="rounded-xl border-2 border-sun bg-sun/15 p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/60">
            Förslag
          </p>
          <p className="mb-3 text-sm font-semibold">
            {describeProposal(proposal, { teams, matches, events })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmProposal}
              disabled={busy}
              className="flex-1 rounded-xl bg-grass px-4 py-2 font-[family-name:var(--font-display)] font-bold text-sm uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
            >
              {busy ? "Bekräftar…" : "Bekräfta"}
            </button>
            <button
              type="button"
              onClick={cancelProposal}
              disabled={busy}
              className="rounded-xl border border-ink/25 bg-paper px-4 py-2 font-bold text-sm transition-transform active:scale-95 disabled:opacity-50"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

        {error && (
          <p className="rounded-lg bg-falu px-3 py-2 text-sm font-bold text-paper">
            {error}
          </p>
        )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv ett meddelande…"
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-ink/25 bg-paper px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-grass px-4 py-2 font-[family-name:var(--font-display)] font-bold text-sm uppercase shadow-chip transition-transform active:scale-95 disabled:opacity-50"
        >
          Skicka
        </button>
        </form>
      </div>
    </div>
  );
}
