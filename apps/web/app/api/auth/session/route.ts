import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@poker-coins/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { createAdminClient } from "@/lib/supabase-admin";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session-cookie";

type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export async function POST(req: NextRequest) {
  let body: { idToken?: string; nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const idToken = body.idToken;
  if (!idToken) {
    return NextResponse.json({ error: "Falta idToken" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken, true);
  } catch (e) {
    return NextResponse.json(
      { error: `ID token inválido: ${(e as Error).message}` },
      { status: 401 },
    );
  }

  // Upsert public.users
  const admin = createAdminClient();
  const fallbackNickname =
    body.nickname?.trim() ||
    decoded.name ||
    (decoded.email ? decoded.email.split("@")[0] : null) ||
    "Player";
  const trimmed = fallbackNickname.slice(0, 20);

  const avatarUrl = (decoded.picture as string | undefined) ?? null;

  const { data: existing } = await admin
    .from("users")
    .select("id, nickname, avatar_url")
    .eq("firebase_uid", decoded.uid)
    .maybeSingle();

  if (existing) {
    const updates: UserUpdate = {};
    if (body.nickname && body.nickname.trim() !== existing.nickname) {
      updates.nickname = body.nickname.trim().slice(0, 20);
    }
    if (avatarUrl && avatarUrl !== existing.avatar_url) {
      updates.avatar_url = avatarUrl;
    }
    if (Object.keys(updates).length > 0) {
      await admin.from("users").update(updates).eq("id", existing.id);
    }
  } else {
    const { error: insertErr } = await admin.from("users").insert({
      firebase_uid: decoded.uid,
      nickname: trimmed,
      avatar_url: avatarUrl,
    });
    if (insertErr) {
      return NextResponse.json(
        { error: `No se pudo crear usuario: ${insertErr.message}` },
        { status: 500 },
      );
    }
  }

  // Create session cookie
  let sessionCookie: string;
  try {
    sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_TTL_MS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudo crear cookie: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionCookie, {
    maxAge: SESSION_TTL_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
