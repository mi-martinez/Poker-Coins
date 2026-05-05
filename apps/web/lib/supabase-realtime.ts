"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createSupabaseClient> | null = null;

// Cliente exclusivo para Realtime broadcast. Sin accessToken de Firebase
// porque broadcast público no aplica RLS y no queremos romper la conexión
// con un JWT que Supabase no sabe validar (Third-Party Auth no está
// configurado).
export function getRealtimeClient() {
  if (_client) return _client;
  _client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return _client;
}
