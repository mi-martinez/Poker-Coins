"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getRealtimeClient } from "@/lib/supabase-realtime";

const FALLBACK_POLL_MS = 20_000;
const REFRESH_DEBOUNCE_MS = 60;

// Suscribe al canal de broadcast `room:{roomId}`. Cada cambio en las
// tablas relevantes (seats, chip_requests, hands, etc.) dispara un
// trigger SQL que envía un evento "change" → router.refresh() acá.
//
// Garantías:
// - Debounce de 60ms: una acción que hace varias mutaciones en
//   Promise.all dispara N broadcasts en una ráfaga; los coalescemos en
//   un único refresh().
// - Recovery on reconnect: si el canal cae y vuelve a SUBSCRIBED tras
//   un error, refrescamos una vez para recuperar eventos perdidos.
// - Polling de fallback (20s) sólo cuando el canal está caído; se
//   apaga al reconectar.
export function RealtimeRefresher({ roomId }: { roomId: string }) {
  const router = useRouter();
  const fallbackId = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDisconnected = useRef(false);

  useEffect(() => {
    const supabase = getRealtimeClient();

    const scheduleRefresh = () => {
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

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
        scheduleRefresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopFallback();
          // Si veníamos de una desconexión, refrescamos una vez para
          // recuperar eventos que pudimos perder durante la caída.
          if (wasDisconnected.current) {
            wasDisconnected.current = false;
            scheduleRefresh();
          }
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          wasDisconnected.current = true;
          startFallback();
        }
      });

    return () => {
      stopFallback();
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [roomId, router]);

  return null;
}
