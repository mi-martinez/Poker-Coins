import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCop } from "@poker-coins/game";
import { getCurrentUser } from "@/lib/auth-server";
import { createAdminClient } from "@/lib/supabase-admin";
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

  // Salas donde el jugador ya está sentado y la sala sigue activa.
  // Si entra con seat_code o ingresa el code directamente, eso es
  // alterno; pero si ya tomó posición antes y dejó la pestaña, esto
  // le permite volver con un click sin tener que recordar el código.
  const admin = createAdminClient();
  const { data: mySeats } = await admin
    .from("seats")
    .select(
      "id, seat_index, chips_balance_cop, status, room:rooms!inner(id, code, name, status, card_mode, game_type)",
    )
    .eq("user_id", user.id)
    .neq("rooms.status", "CLOSED");

  type SeatRow = {
    id: string;
    seat_index: number;
    chips_balance_cop: number;
    status: string;
    room: {
      id: string;
      code: string;
      name: string | null;
      status: string;
      card_mode: string;
      game_type: string;
    };
  };
  const activeSeats = ((mySeats ?? []) as unknown as SeatRow[]).filter(
    (s) => s.room && s.room.status !== "CLOSED",
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <AnimateIn preset="fadeUp">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold drop-shadow">Tomar mi posición</h1>
          <p className="text-xs text-zinc-300/70">Hola, {user.nickname}</p>
        </div>
      </AnimateIn>

      {activeSeats.length > 0 && (
        <AnimateIn preset="fadeUp" delay={0.08} className="w-full max-w-sm">
          <section
            className="felt-card flex flex-col gap-2 rounded-2xl p-4"
            aria-label="Mis salas activas"
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70">
              Vuelve a tu mesa
            </p>
            <ul className="flex flex-col gap-2">
              {activeSeats.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/play/${s.room.code}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-amber-700/30 bg-amber-950/20 px-3 py-2 transition hover:bg-amber-900/30"
                  >
                    <div className="flex flex-col">
                      <span className="font-display text-base text-amber-100">
                        {s.room.name ?? "Sala"}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Código{" "}
                        <span className="font-mono tracking-widest">
                          {s.room.code}
                        </span>
                        {" · "}
                        Asiento #{s.seat_index}
                        {" · "}
                        {s.room.card_mode === "VIRTUAL"
                          ? "Virtual"
                          : "Presencial"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-[9px] uppercase tracking-widest text-zinc-400">
                        Saldo
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-amber-200">
                        {formatCop(s.chips_balance_cop)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </AnimateIn>
      )}

      <AnimateIn preset="scaleIn" delay={0.15} className="w-full max-w-sm">
        <div className="felt-card rounded-2xl p-5">
          <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-zinc-300/70">
            Entrar a una sala nueva
          </p>
          <JoinRoomForm defaultCode={seat_code} />
        </div>
      </AnimateIn>
    </main>
  );
}
