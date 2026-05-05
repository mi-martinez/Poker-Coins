import Link from "next/link";
import { formatCop } from "@poker-coins/game";
import { AnimateIn } from "@/app/_components/animate";

interface SeatRow {
  id: string;
  seat_index: number;
  user_id: string | null;
  chips_balance_cop: number;
}

interface RoomRow {
  code: string;
  name: string | null;
  game_type: "CASH" | "TOURNAMENT";
  blind_small_cop: number;
  blind_big_cop: number;
}

export function ClosedSummary({
  room,
  seats,
  nicknameById,
  perspective,
}: {
  room: RoomRow;
  seats: SeatRow[];
  nicknameById: Map<string, string>;
  perspective: "dealer" | "player";
}) {
  const occupied = seats.filter((s) => s.user_id);
  const sorted = [...occupied].sort(
    (a, b) => b.chips_balance_cop - a.chips_balance_cop,
  );
  const total = occupied.reduce((sum, s) => sum + s.chips_balance_cop, 0);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <AnimateIn preset="fadeUp">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold drop-shadow">
                {room.name ?? "Sala"}
              </h1>
              <p className="text-xs text-zinc-300/60">
                Código{" "}
                <span className="font-mono tracking-widest text-zinc-300">
                  {room.code}
                </span>{" "}
                · {room.game_type === "TOURNAMENT" ? "Torneo" : "Mesa libre"} · cerrada
              </p>
            </div>
            <Link
              href={perspective === "dealer" ? "/dealer" : "/"}
              className="text-sm text-zinc-300/70 hover:text-zinc-100"
            >
              {perspective === "dealer" ? "← Mis salas" : "← Inicio"}
            </Link>
          </header>
        </AnimateIn>

        <AnimateIn preset="scaleIn" delay={0.1}>
          <div className="felt-card flex flex-col gap-1 rounded-2xl p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-zinc-300/70">
              Sala cerrada
            </p>
            <p className="text-3xl font-bold tabular-nums drop-shadow">
              {formatCop(total)}
            </p>
            <p className="text-xs text-zinc-300/70">
              Total en juego al cierre
            </p>
          </div>
        </AnimateIn>

        <AnimateIn preset="fadeUp" delay={0.2}>
          <section className="felt-card rounded-xl p-4">
            <h2 className="mb-3 text-sm uppercase tracking-widest text-zinc-300/70">
              Cash final por jugador
            </h2>
            {sorted.length === 0 ? (
              <p className="text-sm text-zinc-400">Sin jugadores registrados.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sorted.map((seat, idx) => {
                  const nickname = seat.user_id
                    ? (nicknameById.get(seat.user_id) ?? "?")
                    : "?";
                  const isWinner = idx === 0 && seat.chips_balance_cop > 0;
                  return (
                    <li
                      key={seat.id}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                        isWinner
                          ? "border-amber-500/60 bg-amber-950/30"
                          : "border-white/5 bg-black/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                            isWinner
                              ? "bg-amber-500 text-zinc-950"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold">{nickname}</div>
                          <div className="text-xs text-zinc-400">
                            Asiento #{seat.seat_index}
                          </div>
                        </div>
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        {formatCop(seat.chips_balance_cop)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </AnimateIn>
      </div>
    </main>
  );
}
