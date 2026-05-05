import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-server";
import { AnimateIn } from "./_components/animate";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <AnimateIn preset="fadeUp">
        <h1 className="text-center text-5xl font-bold tracking-tight drop-shadow-lg">
          Poker Coins
        </h1>
      </AnimateIn>
      <AnimateIn preset="fadeUp" delay={0.1}>
        <p className="max-w-md text-center text-zinc-200/80">
          Texas Hold&apos;em híbrido. Cartas y fichas físicas, apuestas digitales en pesos colombianos.
        </p>
      </AnimateIn>
      {user ? (
        <>
          <AnimateIn preset="fadeUp" delay={0.2}>
            <p className="text-xs text-zinc-300/70">
              Conectado como {user.nickname}
            </p>
          </AnimateIn>
          <AnimateIn preset="stagger" delay={0.25} className="flex gap-4">
            <Link
              href="/play"
              className="rounded-lg bg-felt px-6 py-3 font-semibold shadow-lg ring-1 ring-felt-light/30 transition hover:scale-[1.03] hover:bg-felt-light active:scale-[0.97]"
            >
              Jugar
            </Link>
            <Link
              href="/dealer"
              className="rounded-lg border border-zinc-100/30 bg-zinc-900/40 px-6 py-3 font-semibold backdrop-blur transition hover:scale-[1.03] hover:bg-zinc-900/70 active:scale-[0.97]"
            >
              Soy dealer
            </Link>
          </AnimateIn>
        </>
      ) : (
        <AnimateIn preset="scaleIn" delay={0.2}>
          <Link
            href="/sign-in"
            className="rounded-lg bg-felt px-6 py-3 font-semibold shadow-lg ring-1 ring-felt-light/30 transition hover:scale-[1.03] hover:bg-felt-light active:scale-[0.97]"
          >
            Iniciar sesión
          </Link>
        </AnimateIn>
      )}
    </main>
  );
}
