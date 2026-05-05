import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { CreateRoomForm } from "../create-room-form";
import { AnimateIn } from "@/app/_components/animate";

export default async function NewRoomPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dealer/new");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <AnimateIn preset="fadeUp">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold drop-shadow">Nueva sala</h1>
          <p className="text-xs text-zinc-300/70">Hola, {user.nickname}</p>
        </div>
      </AnimateIn>
      <AnimateIn preset="fadeUp" delay={0.1}>
        <p className="max-w-md text-center text-zinc-300/80">
          Configura los parámetros y comparte los códigos de posición con tus jugadores.
        </p>
      </AnimateIn>
      <AnimateIn preset="scaleIn" delay={0.2} className="w-full max-w-md">
        <div className="felt-card rounded-2xl p-5">
          <CreateRoomForm />
        </div>
      </AnimateIn>
      <Link
        href="/dealer"
        className="text-xs text-zinc-300/70 hover:text-zinc-100"
      >
        ← Mis salas
      </Link>
    </main>
  );
}
