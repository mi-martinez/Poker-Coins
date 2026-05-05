"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase-client";

const NEXT_KEY = "pc:redirect-next";

// Sign-in con Google vía redirect. Para que funcione confiablemente en
// Safari iOS / navegadores con ITP, combinamos dos estrategias:
//   1. getRedirectResult → resuelve cuando volvemos del redirect
//   2. onAuthStateChanged → respaldo si #1 falla pero el SDK sí
//      restauró el auth state desde storage
// Cualquiera que dispare primero crea la session cookie.
export function GoogleSignInButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const processed = useRef(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let unsub: (() => void) | null = null;

    async function processUser(user: User) {
      if (processed.current) return;
      processed.current = true;
      if (unsub) unsub();
      try {
        const idToken = await user.getIdToken(true);
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const savedNext = sessionStorage.getItem(NEXT_KEY) || next;
        sessionStorage.removeItem(NEXT_KEY);
        router.replace(savedNext);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
        processed.current = false;
      }
    }

    // Estrategia 1: si venimos de un redirect, getRedirectResult lo dirá
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          void processUser(result.user);
        }
      })
      .catch((e) => {
        // No fallar duro — la estrategia 2 puede rescatar
        console.warn("getRedirectResult:", (e as Error).message);
      });

    // Estrategia 2: escucha auth state. Si el SDK restauró el usuario
    // desde storage tras el redirect, lo cazamos acá.
    unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        void processUser(user);
      } else {
        // Sin usuario y NO estábamos esperando redirect → listo para click
        if (sessionStorage.getItem(NEXT_KEY) === null) {
          setLoading(false);
        }
      }
    });

    // Timeout: si 8s pasan sin que ninguna estrategia produzca usuario,
    // limpia el flag de redirect y deja el botón visible para reintentar.
    const timeout = setTimeout(() => {
      if (!processed.current) {
        sessionStorage.removeItem(NEXT_KEY);
        setLoading(false);
      }
    }, 8000);

    return () => {
      if (unsub) unsub();
      clearTimeout(timeout);
    };
  }, [router, next]);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      sessionStorage.setItem(NEXT_KEY, next);
      const auth = getFirebaseAuth();
      await signInWithRedirect(auth, getGoogleProvider());
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
