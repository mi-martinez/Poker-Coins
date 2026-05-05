import { formatCop } from "@poker-coins/game";
import { Avatar } from "@/app/_components/avatar";
import { CommunityCards } from "@/app/_components/community-cards";

type Phase =
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "COMPLETE";

export interface PokerSeat {
  id: string;
  seatIndex: number;
  userId: string | null;
  nickname: string;
  avatarUrl: string | null;
  chipsBalance: number;
  currentBet: number;
  status: "IN" | "FOLDED" | "ALL_IN" | "WAITING" | "ACTIVE" | "SITTING_OUT" | "LEFT";
  isMyTurn: boolean;
  isMe: boolean;
  isDealerButton: boolean;
}

interface Props {
  seats: PokerSeat[];
  mySeatIndex: number;
  totalSeats: number;
  potCop: number;
  phase: Phase;
  handNumber: number;
}

// Mesa ovalada con avatares dispuestos por el perímetro. El usuario
// (mySeatIndex) queda en el bottom-center y los demás se distribuyen
// cíclicamente. Cartas comunitarias y pozo en el centro.
export function PokerTable({
  seats,
  mySeatIndex,
  totalSeats,
  potCop,
  phase,
  handNumber,
}: Props) {
  const occupied = seats.filter((s) => s.userId);
  const n = occupied.length;

  return (
    <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
      {/* Borde exterior tipo madera */}
      <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-amber-950/80 to-amber-900/40 shadow-2xl" />
      {/* Fieltro interior */}
      <div
        className="absolute inset-3 rounded-[50%] border border-white/5"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(31,138,63,0.95) 0%, rgba(13,107,63,1) 55%, rgba(8,77,45,1) 100%)",
          boxShadow:
            "inset 0 0 60px rgba(0,0,0,0.55), inset 0 0 18px rgba(0,0,0,0.4)",
        }}
      />

      {/* Centro: pozo + cartas comunitarias */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-200/70">
            Pozo · Mano #{handNumber}
          </div>
          <div className="font-display text-3xl font-bold tabular-nums text-amber-100 drop-shadow sm:text-4xl">
            {formatCop(potCop)}
          </div>
        </div>
        <div className="scale-75 sm:scale-90">
          <CommunityCards phase={phase} />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.4em] text-zinc-200/60">
          {phase}
        </div>
      </div>

      {/* Asientos ocupados — distribuidos en el perímetro */}
      {occupied.map((seat, i) => {
        // Offset cíclico desde mi posición (yo voy al bottom = 90°)
        const orderIdx = i; // index dentro de occupied, ordenado por seatIndex
        // Re-calculamos para que MI seat esté al bottom; los otros giran
        // Mi seat: lo encontramos por flag isMe
        const myIndexInOccupied = occupied.findIndex((s) => s.isMe);
        const offset =
          (orderIdx - (myIndexInOccupied >= 0 ? myIndexInOccupied : 0) + n) % n;
        const angleDeg = 90 + (offset / n) * 360; // 90° = bottom
        const angleRad = (angleDeg * Math.PI) / 180;
        const xRatio = 0.46;
        const yRatio = 0.46;
        const x = 50 + Math.cos(angleRad) * xRatio * 100;
        const y = 50 + Math.sin(angleRad) * yRatio * 100;

        const isOut = seat.status === "FOLDED" || seat.chipsBalance === 0;

        return (
          <div
            key={seat.id}
            className="absolute flex flex-col items-center gap-1"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: seat.isMyTurn ? 20 : 10,
            }}
          >
            <div className="relative">
              <Avatar
                nickname={seat.nickname}
                avatarUrl={seat.avatarUrl}
                size={48}
                ringColor={
                  seat.isMyTurn
                    ? "#f59e0b"
                    : seat.isMe
                      ? "#10b981"
                      : undefined
                }
                disabled={isOut}
              />
              {seat.isDealerButton && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-900 ring-2 ring-felt"
                  title="Botón del dealer"
                >
                  D
                </span>
              )}
            </div>
            <div
              className={`rounded px-1.5 py-0.5 text-[10px] backdrop-blur whitespace-nowrap ${
                seat.isMyTurn
                  ? "bg-amber-600/80 font-semibold text-zinc-950"
                  : "bg-black/70 text-zinc-100"
              }`}
            >
              {seat.isMe ? "Tú" : seat.nickname}
            </div>
            <div className="text-[10px] tabular-nums text-zinc-200/90">
              {formatCop(seat.chipsBalance)}
            </div>
            {seat.currentBet > 0 && (
              <div className="rounded-full bg-amber-900/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-100 ring-1 ring-amber-500/40">
                {formatCop(seat.currentBet)}
              </div>
            )}
            {seat.status === "FOLDED" && (
              <div className="rounded bg-red-950/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-red-300">
                fold
              </div>
            )}
            {seat.status === "ALL_IN" && (
              <div className="rounded bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-200">
                all-in
              </div>
            )}
          </div>
        );
      })}

      {/* Marcador de "void" para el espacio cuando totalSeats > occupied */}
      {n < totalSeats && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-zinc-300/50">
          {n}/{totalSeats}
        </div>
      )}
    </div>
  );
}
