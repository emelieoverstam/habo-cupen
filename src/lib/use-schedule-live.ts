"use client";

// Delad live-koppling: prenumererar på schemakanalen (broadcast från
// databasen) och pingar Cupmate-synken med jämna mellanrum. Anropar
// refresh när något ändrats — skurar samlas ihop till en omhämtning.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const SYNC_INTERVAL_MS = 3 * 60 * 1000;

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
