"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase-client";

const NEXT_KEY = "pc:redirect-next";

// Sign-in con Google vía redirect (no popup). Funciona en móviles
// y bypassea bloqueadores de popups. Flujo:
//   1. Click → guarda `next` en sessionStorage → redirige a Google
//   2. Google autentica → redirige a pokercoins-7828c.firebaseapp.com
//   3. Esa página procesa y vuelve a nuestro dominio
//   4. Aquí useEffect detecta el resultado y crea la session cookie
export function GoogleSignInButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [loading, setLoading] = useState(true); // empieza loading mientras chequea redirect
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const auth = getFirebaseAuth();
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) {
          // No venimos de un redirect — listo para que el usuario clickee
          setLoading(false);
          return;
        }
        // Volvimos del redirect con un usuario autenticado
        const idToken = await result.user.getIdToken(true);
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const savedNext = sessionStorage.getItem(NEXT_KEY) || "/";
        sessionStorage.removeItem(NEXT_KEY);
        router.replace(savedNext);
        router.refresh();
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
  }, [router]);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      // Guardamos a dónde queremos volver tras el redirect
      sessionStorage.setItem(NEXT_KEY, next);
      const auth = getFirebaseAuth();
      await signInWithRedirect(auth, getGoogleProvider());
      // El navegador ya está navegando a Google — no hay nada más que hacer
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-white px-5 py-3 font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 disabled:opacity-60"
      >
        <GoogleLogo />
        {loading ? "Conectando..." : "Continuar con Google"}
      </button>
      {error && (
        <p className="max-w-xs text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.3C29.4 34.6 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.5 39.5 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.3C41 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
