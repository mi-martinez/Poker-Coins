"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { Avatar } from "./avatar";
import { getFirebaseAuth } from "@/lib/firebase-client";

interface User {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

// Botón flotante top-right con avatar del usuario. Click despliega un
// menú con nombre, link a inicio y cerrar sesión. Visible en todas las
// pantallas siempre que haya un usuario autenticado.
export function UserMenu({ user }: { user: User | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!user) return null;

  async function signOutNow() {
    startTransition(async () => {
      try {
        await signOut(getFirebaseAuth());
      } catch {
        // ignore — la cookie también se borra abajo
      }
      await fetch("/api/auth/session", { method: "DELETE" });
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div ref={menuRef} className="fixed right-4 top-4 z-[8500]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de usuario"
        aria-expanded={open}
        className="block rounded-full ring-2 ring-white/10 shadow-lg transition hover:ring-white/30 active:scale-95"
      >
        <Avatar
          nickname={user.nickname}
          avatarUrl={user.avatarUrl}
          size={40}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-3 border-b border-white/5 px-3 py-3">
            <Avatar
              nickname={user.nickname}
              avatarUrl={user.avatarUrl}
              size={36}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {user.nickname}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">
                Sesión activa
              </div>
            </div>
          </div>

          <Link
            href="/"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/5"
          >
            <HomeIcon />
            Inicio
          </Link>

          <Link
            href="/dealer"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/5"
          >
            <DealerIcon />
            Mis salas
          </Link>

          <button
            type="button"
            onClick={signOutNow}
            disabled={pending}
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-white/5 px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-900/40 disabled:opacity-60"
          >
            <LogoutIcon />
            {pending ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}

function HomeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12 12 4l9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function DealerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M8 6V4M16 6V4" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
