import { Suspense } from "react";
import Link from "next/link";
import { GoogleSignInButton } from "./google-sign-in-button";
import { GuestSignInForm } from "./guest-sign-in-form";
import { AnimateIn } from "@/app/_components/animate";

const isDev = process.env.NODE_ENV === "development";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <AnimateIn preset="scaleIn">
        <div className="felt-card flex flex-col items-center gap-6 rounded-2xl px-8 py-10">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-bold drop-shadow">Poker Coins</h1>
            <p className="text-sm text-zinc-300/80">
              Inicia sesión para continuar
            </p>
          </div>
          <Suspense fallback={null}>
            <GoogleSignInButton />
          </Suspense>
          {isDev && (
            <>
              <div className="my-1 flex w-full max-w-xs items-center gap-3 text-xs text-zinc-500">
                <span className="h-px flex-1 bg-zinc-700" />
                <span>o</span>
                <span className="h-px flex-1 bg-zinc-700" />
              </div>
              <Suspense fallback={null}>
                <GuestSignInForm />
              </Suspense>
            </>
          )}
        </div>
      </AnimateIn>
      <Link href="/" className="text-xs text-zinc-300/70 hover:text-zinc-100">
        ← Volver
      </Link>
    </main>
  );
}
