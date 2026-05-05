import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { JoinRoomForm } from "./join-room-form";
import { AnimateIn } from "@/app/_components/animate";

export default async function PlayLobbyPage({
  searchParams,
}: {
  searchParams: Promise<{ seat_code?: string }>;
}) {
  const user = await getCurrentUser();
  const { seat_code } = await searchParams;
  if (!user) {
    redirect(`/sign-in?next=/play${seat_code ? `?seat_code=${seat_code}` : ""}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <AnimateIn preset="fadeUp">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold drop-shadow">Tomar mi posición</h1>
          <p className="text-xs text-zinc-300/70">Hola, {user.nickname}</p>
        </div>
      </AnimateIn>
      <AnimateIn preset="scaleIn" delay={0.15} className="w-full max-w-sm">
        <div className="felt-card rounded-2xl p-5">
          <JoinRoomForm defaultCode={seat_code} />
        </div>
      </AnimateIn>
    </main>
  );
}
