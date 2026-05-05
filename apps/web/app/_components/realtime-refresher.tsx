"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getRealtimeClient } from "@/lib/supabase-realtime";

const FALLBACK_POLL_MS = 15_000; // safety net si la conexión Realtime cae

// Suscribe al canal de broadcast `room:{roomId}`. Cada cambio en las
// tablas relevantes (seats, chip_requests, hands, etc.) dispara un
// trigger SQL que envía un evento "change" → router.refresh() acá.
// Latencia esperada: <300ms.
export function RealtimeRefresher({ roomId }: { roomId: string }) {
  const router = useRouter();

  // Broadcast subscription
  useEffect(() => {
    const supabase = getRealtimeClient();
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "change" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, router]);

  // Polling ligero como red de seguridad (15s)
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
