"use client";

// Delad live-koppling: prenumererar på schemakanalen (broadcast från
// databasen) och pingar Cupmate-synken med jämna mellanrum. Anropar
// refresh när något ändrats — skurar samlas ihop till en omhämtning.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const SYNC_INTERVAL_MS = 3 * 60 * 1000;

// Signal i samma flik: när ledar-chatten sparar en ändring uppdateras alla
// öppna vyer direkt, utan att vänta in Realtime-broadcasten (som främst är
// till för andra enheter och kan dröja).
const SCHEDULE_CHANGED_EVENT = "f13:schedule-changed";

export function notifyScheduleChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SCHEDULE_CHANGED_EVENT));
  }
}

export function useScheduleLive(refresh: () => void) {
  const supabase = useMemo(() => createClient(), []);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 400);
  }, [refresh]);

  useEffect(() => {
    // Kanalen är privat, så klienten måste först autentisera sig mot
    // Realtime — anon räcker enligt RLS-policyn på realtime.messages
    const channel = supabase.channel("schedule", {
      config: { private: true },
    });

    supabase.realtime.setAuth().then(() => {
      channel
        .on("broadcast", { event: "*" }, () => {
          queueRefresh();
        })
        .subscribe();
    });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, queueRefresh]);

  // Lyssna på den lokala signalen från ledar-chatten (samma flik)
  useEffect(() => {
    const onLocalChange = () => queueRefresh();
    window.addEventListener(SCHEDULE_CHANGED_EVENT, onLocalChange);
    return () => window.removeEventListener(SCHEDULE_CHANGED_EVENT, onLocalChange);
  }, [queueRefresh]);

  // Pinga synken: servern hämtar bara från Cupmate om datat är äldre än 2 min
  useEffect(() => {
    const ping = () => {
      fetch("/api/sync", { method: "POST" }).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
}
