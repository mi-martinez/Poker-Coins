import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getAdminAuth } from "./firebase-admin";
import { createAdminClient } from "./supabase-admin";
import { SESSION_COOKIE } from "./session-cookie";

export interface CurrentUser {
  id: string; // public.users.id (uuid)
  firebaseUid: string;
  nickname: string;
  avatarUrl: string | null;
}

// React `cache` deduplica dentro de un mismo render/invocación. En un
// page render donde layout + page lo llaman, sólo se verifica la cookie
// y se hace la query a Supabase una vez. Las server actions corren en
// requests separadas (POST), así que no comparten cache con el render —
// pero igual se benefician si el action llama a getCurrentUser dos veces.
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;

    let firebaseUid: string;
    try {
      const decoded = await getAdminAuth().verifySessionCookie(
        sessionCookie,
        true,
      );
      firebaseUid = decoded.uid;
    } catch {
      return null;
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("users")
      .select("id, nickname, firebase_uid, avatar_url")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      firebaseUid: data.firebase_uid ?? firebaseUid,
      nickname: data.nickname,
      avatarUrl: data.avatar_url,
    };
  },
);

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
