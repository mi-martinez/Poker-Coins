"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@poker-coins/db";
import { getFirebaseAuth } from "./firebase-client";

let _client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

// Cliente browser que envía el Firebase ID token en cada request via
// accessToken callback. Sin esto, Realtime y los queries respetan RLS
// como anon, no como el usuario logueado.
export function createClient() {
  if (_client) return _client;
  _client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) return null;
        return await user.getIdToken();
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return _client;
}
