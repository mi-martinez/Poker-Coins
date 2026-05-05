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

  // Tilt usado para perspectiva 3D — counter-aplicado a textos y avatares
  // para que se lean rectos a pesar de la rotación de la mesa.
  const TILT = 18;

  return (
    <div className="w-full" style={{ perspective: "1500px" }}>
      <div
        className="relative"
        style={{
          aspectRatio: "16 / 10",
          transform: `rotateX(${TILT}deg)`,
          transformStyle: "preserve-3d",
          transformOrigin: "center 55%",
        }}
      >
        {/* Sombra de piso (elevación) */}
        <div
          className="pointer-events-none absolute -inset-x-8 bottom-[-50px] h-16 rounded-[50%] blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse, rgba(0,0,0,0.75), transparent 70%)",
            transform: "translateZ(-30px)",
          }}
          aria-hidden="true"
        />

        {/* Borde exterior tipo madera con extrusión 3D (stack de sombras
            simulando grosor del tablero) */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: "40%",
            background:
              "linear-gradient(155deg, #6b3f1f 0%, #4a2c12 50%, #2a1808 100%)",
            boxShadow: [
              // extrusión: pila de sombras descendentes simulan grosor
              "0 3px 0 #4a2c12",
              "0 6px 0 #422810",
              "0 9px 0 #3a230d",
              "0 12px 0 #321f0b",
              "0 15px 0 #2a1809",
              "0 18px 0 #241407",
              "0 22px 0 #1c1005",
              "0 26px 0 #160c04",
              "0 32px 0 #110a03",
              // sombra de piso debajo del extrusión
              "0 50px 60px -10px rgba(0,0,0,0.7)",
              "0 30px 30px -8px rgba(0,0,0,0.45)",
              // highlight superior (luz cenital)
              "inset 0 5px 8px rgba(255,255,255,0.08)",
              // sombra inferior interna del rim
              "inset 0 -10px 16px rgba(0,0,0,0.55)",
              "inset 0 0 0 1px rgba(255,255,255,0.05)",
            ].join(", "),
          }}
        />

      {/* Fieltro interior con profundidad */}
      <div
        className="absolute inset-4"
        style={{
          borderRadius: "40%",
          background: [
            "radial-gradient(ellipse at center top, rgba(46,179,87,0.45) 0%, transparent 55%)",
            "radial-gradient(ellipse at center, rgba(31,138,63,0.98) 0%, rgba(13,107,63,1) 50%, rgba(8,77,45,1) 100%)",
          ].join(", "),
          boxShadow: [
            "inset 0 0 80px rgba(0,0,0,0.55)", // vignette interior
            "inset 0 14px 28px rgba(0,0,0,0.5)", // sombra del borde superior (caída)
            "inset 0 -3px 0 rgba(255,255,255,0.04)", // hilo de luz inferior
            "inset 0 0 0 1px rgba(255,255,255,0.05)", // borde
          ].join(", "),
        }}
      />

      {/* Reflejo especular en el borde superior */}
      <div
        className="pointer-events-none absolute inset-4"
        style={{
          borderRadius: "40%",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 25%)",
          mixBlendMode: "overlay",
        }}
        aria-hidden="true"
      />

      {/* Centro: pozo + cartas comunitarias — counter-rotateX para que
          se lea recto a pesar del tilt 3D de la mesa */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6"
        style={{
          transform: `rotateX(-${TILT}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
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
              transform: `translate(-50%, -50%) rotateX(-${TILT}deg)`,
              transformStyle: "preserve-3d",
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
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-zinc-300/50"
          style={{ transform: `translate(-50%, 0) rotateX(-${TILT}deg)` }}
        >
          {n}/{totalSeats}
        </div>
      )}
      </div>
    </div>
  );
}
