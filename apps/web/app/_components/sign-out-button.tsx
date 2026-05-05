"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await signOut(getFirebaseAuth());
    } catch {
      // ignore — borramos cookie igual
    }
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-zinc-500 underline hover:text-zinc-300 disabled:opacity-60"
    >
      {pending ? "Cerrando sesión..." : "Cerrar sesión"}
    </button>
  );
}
