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
  status:
    | "IN"
    | "FOLDED"
    | "ALL_IN"
    | "WAITING"
    | "ACTIVE"
    | "SITTING_OUT"
    | "LEFT";
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
  /** Modo VIRTUAL: códigos de las cartas comunitarias (deckofcardsapi). */
  communityCards?: string[] | null;
}

// Mesa 2D estilo cenital (referencia: PokerStars). Plana, sin
// perspective ni rotateX. Avatares con tag pill alrededor del óvalo.
// Cartas back pequeñas junto a cada jugador IN. Pot al centro con
// stack de fichas + monto.
export function PokerTable({
  seats,
  mySeatIndex,
  totalSeats,
  potCop,
  phase,
  handNumber,
  communityCards,
}: Props) {
  void mySeatIndex;
  const occupied = seats.filter((s) => s.userId);
  const n = occupied.length;
  const myIndexInOccupied = occupied.findIndex((s) => s.isMe);

  return (
    <div
      className="relative mx-auto w-full max-w-md sm:max-w-lg"
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* Sombra de piso */}
      <div
        className="pointer-events-none absolute -inset-x-6 bottom-[-12px] h-8 rounded-[50%] blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Rim exterior — borde simple oscuro */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: "40%",
          background:
            "linear-gradient(180deg, #1a3d2a 0%, #0d2618 100%)",
          boxShadow: [
            "0 10px 30px rgba(0,0,0,0.45)",
            "inset 0 -3px 8px rgba(0,0,0,0.5)",
            "inset 0 3px 6px rgba(255,255,255,0.06)",
            "inset 0 0 0 1px rgba(255,255,255,0.05)",
          ].join(", "),
        }}
      />

      {/* Fieltro con pattern de puntitos sutiles */}
      <div
        className="absolute inset-3"
        style={{
          borderRadius: "38%",
          background: [
            "radial-gradient(ellipse at center, rgba(46,179,87,0.6) 0%, rgba(31,138,63,1) 50%, rgba(13,107,63,1) 100%)",
            // patrón de puntos finos tipo PokerStars
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='2' cy='2' r='0.7' fill='rgba(255,255,255,0.05)'/></svg>\")",
          ].join(", "),
          backgroundSize: "100% 100%, 24px 24px",
          boxShadow: "inset 0 0 50px rgba(0,0,0,0.4)",
        }}
      />

      {/* Centro: monto del pozo + cartas comunitarias. Compacto para
          dejar espacio a los avatares en los extremos. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
        <div className="font-display text-xl font-bold tabular-nums text-zinc-50 drop-shadow sm:text-2xl">
          {formatCop(potCop)}
        </div>
        <div className="scale-[0.55] sm:scale-[0.65]">
          <CommunityCards phase={phase} cards={communityCards ?? null} />
        </div>
        <div className="text-[8px] font-semibold uppercase tracking-[0.3em] text-zinc-100/60">
          #{handNumber} · {phase}
        </div>
      </div>

      {/* Asientos ocupados */}
      {occupied.map((seat, i) => {
        const offset =
          (i - (myIndexInOccupied >= 0 ? myIndexInOccupied : 0) + n) % n;
        const angleDeg = 90 + (offset / n) * 360;
        const angleRad = (angleDeg * Math.PI) / 180;
        // Margen calculado: el avatar va cerca del borde del óvalo
        // pero deja espacio suficiente para tag pill + bet sin
        // sobreponerse al centro (cartas comunitarias).
        const xRatio = 0.4;
        const yRatio = 0.32;
        const x = 50 + Math.cos(angleRad) * xRatio * 100;
        const y = 50 + Math.sin(angleRad) * yRatio * 100;

        const isOut = seat.status === "FOLDED" || seat.chipsBalance === 0;
        const inHand =
          seat.status === "IN" || seat.status === "ALL_IN";

        return (
          <div
            key={seat.id}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: seat.isMyTurn ? 20 : 10,
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              {/* Mini cartas back si está en la mano (solo para
                  oponentes — el usuario tiene sus cartas físicas) */}
              {inHand && !isOut && !seat.isMe && (
                <div className="flex -space-x-1">
                  <CardBack />
                  <CardBack offset />
                </div>
              )}
              <div className="relative">
                <Avatar
                  nickname={seat.nickname}
                  avatarUrl={seat.avatarUrl}
                  size={36}
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
                    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-100 text-[8px] font-bold text-zinc-900 ring-1 ring-zinc-900"
                    title="Botón del dealer"
                  >
                    D
                  </span>
                )}
              </div>
              {/* Tag pill con nombre + stack */}
              <div
                className={`flex flex-col items-center rounded-md px-1.5 py-0.5 text-center backdrop-blur whitespace-nowrap shadow ${
                  seat.isMyTurn
                    ? "bg-amber-600/90 text-zinc-950 ring-1 ring-amber-400"
                    : "bg-black/75 text-zinc-100 ring-1 ring-white/10"
                }`}
              >
                <div className="text-[9px] font-semibold leading-tight">
                  {seat.isMe ? "Tú" : seat.nickname}
                </div>
                <div className="text-[9px] tabular-nums leading-tight opacity-90">
                  {formatCop(seat.chipsBalance)}
                </div>
              </div>
              {seat.currentBet > 0 && (
                <div className="rounded-full bg-amber-900/80 px-1.5 py-0 text-[9px] font-semibold tabular-nums text-amber-100 ring-1 ring-amber-500/40">
                  {formatCop(seat.currentBet)}
                </div>
              )}
              {seat.status === "FOLDED" && (
                <div className="rounded bg-red-950/70 px-1 py-0 text-[8px] font-semibold uppercase tracking-widest text-red-300">
                  fold
                </div>
              )}
              {seat.status === "ALL_IN" && (
                <div className="rounded bg-amber-950/80 px-1 py-0 text-[8px] font-semibold uppercase tracking-widest text-amber-200">
                  all-in
                </div>
              )}
            </div>
          </div>
        );
      })}

      {n < totalSeats && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-zinc-200/50">
          {n}/{totalSeats}
        </div>
      )}
    </div>
  );
}

// Reverso de carta — pequeño rectángulo con dorso de fieltro
function CardBack({ offset = false }: { offset?: boolean }) {
  return (
    <div
      className="relative h-5 w-3.5 rounded-sm border border-white/30 shadow-sm"
      style={{
        background:
          "linear-gradient(135deg, #0a4d2c 0%, #084d2c 50%, #063b21 100%)",
        transform: offset ? "rotate(8deg)" : "rotate(-4deg)",
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0.5 rounded-[1px] border border-white/15" />
    </div>
  );
}

