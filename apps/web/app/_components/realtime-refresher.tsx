"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getRealtimeClient } from "@/lib/supabase-realtime";

const FALLBACK_POLL_MS = 20_000;

// Suscribe al canal de broadcast `room:{roomId}`. Cada cambio en las
// tablas relevantes (seats, chip_requests, hands, etc.) dispara un
// trigger SQL que envía un evento "change" → router.refresh() acá.
// El polling de fallback SÓLO se activa si la suscripción cae; si
// está conectada, dependemos puramente del broadcast (latencia <300ms).
export function RealtimeRefresher({ roomId }: { roomId: string }) {
  const router = useRouter();
  const fallbackId = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = getRealtimeClient();

    const startFallback = () => {
      if (fallbackId.current) return;
      fallbackId.current = setInterval(() => {
        router.refresh();
      }, FALLBACK_POLL_MS);
    };
    const stopFallback = () => {
      if (fallbackId.current) {
        clearInterval(fallbackId.current);
        fallbackId.current = null;
      }
    };

    const channel: RealtimeChannel = supabase
      .channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "change" }, () => {
        router.refresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopFallback();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          startFallback();
        }
      });

    return () => {
      stopFallback();
      supabase.removeChannel(channel);
    };
  }, [roomId, router]);

  return null;
}
