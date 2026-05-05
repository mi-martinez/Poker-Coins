"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInAnonymously, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

// Solo para desarrollo: crea un usuario anónimo en Firebase y lo
// procesa con el mismo flujo de session cookie. Cada click cierra la
// sesión anterior y crea un Firebase user nuevo, así puedes simular
// varios jugadores desde distintos navegadores/incognito.
export function GuestSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const nickname = String(formData.get("nickname") ?? "").trim();
      if (!nickname) {
        throw new Error("Escribe un nickname.");
      }

      const auth = getFirebaseAuth();
      if (auth.currentUser) await signOut(auth);
      const cred = await signInAnonymously(auth);
      const idToken = await cred.user.getIdToken(true);

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, nickname }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xs flex-col gap-3 rounded-lg border border-dashed border-amber-700/50 bg-amber-950/20 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
        Modo desarrollo · invitado
      </p>
      <input
        name="nickname"
        required
        maxLength={20}
        placeholder="Nickname para esta sesión"
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-500 disabled:opacity-60"
      >
        {loading ? "Conectando..." : "Continuar como invitado"}
      </button>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
