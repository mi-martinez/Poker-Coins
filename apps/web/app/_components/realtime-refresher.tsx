"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    const supabase = getRealtimeClient();
    let fallbackId: ReturnType<typeof setInterval> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let wasDisconnected = false;
    // Una vez que arrancamos el cleanup, ignoramos callbacks tardíos
    // de subscribe(): removeChannel hace transitionar el canal a
    // CLOSED y dispararía startFallback() de nuevo dejando un interval
    // huérfano sin owner.
    let teardown = false;

    const scheduleRefresh = () => {
      if (teardown || refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const startFallback = () => {
      if (teardown || fallbackId) return;
      fallbackId = setInterval(() => {
        router.refresh();
      }, FALLBACK_POLL_MS);
    };
    const stopFallback = () => {
      if (fallbackId) {
        clearInterval(fallbackId);
        fallbackId = null;
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
        if (teardown) return;
        if (status === "SUBSCRIBED") {
          stopFallback();
          // Si veníamos de una desconexión, refrescamos una vez para
          // recuperar eventos que pudimos perder durante la caída.
          if (wasDisconnected) {
            wasDisconnected = false;
            scheduleRefresh();
          }
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          wasDisconnected = true;
          startFallback();
        }
      });

    return () => {
      teardown = true;
      stopFallback();
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      supabase.removeChannel(channel);
    };
  }, [roomId, router]);

  return null;
}
