import { createClient } from "@supabase/supabase-js";
import type { Database } from "@poker-coins/db";

// Admin client — bypassa RLS. SOLO usar en server actions / route handlers
// donde la autorización ya se haya validado manualmente.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
