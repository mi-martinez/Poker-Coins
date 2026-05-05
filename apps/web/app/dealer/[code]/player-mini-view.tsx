import { formatCop } from "@poker-coins/game";
import { Avatar } from "@/app/_components/avatar";
import { DealerSeatControls } from "./dealer-seat-controls";

interface SeatLite {
  id: string;
  seat_index: number;
  user_id: string | null;
  chips_balance_cop: number;
  status: string;
}

interface ParticipantLite {
  status: "IN" | "FOLDED" | "ALL_IN";
  current_bet_cop: number;
}

interface RoomLite {
  status: string;
  game_type: "CASH" | "TOURNAMENT";
}

interface HandLite {
  current_turn_seat_id: string | null;
  phase: string;
  phase_ready_at: string | null;
}

interface UserLite {
  nickname: string;
  avatar_url: string | null;
}

export interface PlayerMiniViewData {
  seat: SeatLite;
  user: UserLite;
  participant: ParticipantLite | null;
  room: RoomLite;
  activeHand: HandLite | null;
  pendingRequestAmount: number | null;
  isDealerButton: boolean;
}

// Deriva qué overlay/estado está viendo el jugador en su pantalla.
// Mismas reglas que las que usan los overlays del player page.
function derivePlayerView(d: PlayerMiniViewData): {
  label: string;
  tone: "active" | "waiting" | "muted" | "alert" | "success";
} {
  const { seat, participant, room, activeHand, pendingRequestAmount } = d;

  if (room.status === "CLOSED") {
    return { label: "Sala cerrada", tone: "muted" };
  }
  if (seat.status === "SITTING_OUT") {
    return { label: "Sentado fuera", tone: "muted" };
  }
  if (room.status === "LOBBY" && room.game_type === "TOURNAMENT") {
    return { label: "Esperando torneo", tone: "waiting" };
  }
  if (pendingRequestAmount !== null) {
    return {
      label: `Pidió ${formatCop(pendingRequestAmount)}`,
      tone: "alert",
    };
  }
  if (!activeHand) {
    if (seat.chips_balance_cop === 0) {
      return { label: "Sin fichas", tone: "alert" };
    }
    return { label: "Esperando próxima mano", tone: "muted" };
  }
  // Mano en juego
  if (!participant) {
    return { label: "Fuera de la mano", tone: "muted" };
  }
  if (participant.status === "FOLDED") {
    return { label: "Foldeó", tone: "muted" };
  }
  if (participant.status === "ALL_IN") {
    return { label: "All-in · esperando", tone: "alert" };
  }
  if (activeHand.phase_ready_at) {
    return { label: "Repartiendo...", tone: "waiting" };
  }
  if (activeHand.phase === "SHOWDOWN") {
    return { label: "Esperando ganador", tone: "alert" };
  }
  if (activeHand.current_turn_seat_id === seat.id) {
    return { label: "Su turno", tone: "active" };
  }
  return { label: "Esperando turno", tone: "waiting" };
}

const TONE_CLASSES: Record<string, string> = {
  active:
    "border-amber-500 bg-amber-600 text-zinc-950 felt-pulse",
  waiting: "border-zinc-700 bg-zinc-900/50 text-zinc-300",
  muted: "border-zinc-800 bg-zinc-950/40 text-zinc-500",
  alert: "border-amber-600/60 bg-amber-950/40 text-amber-200",
  success: "border-emerald-600/60 bg-emerald-950/40 text-emerald-200",
};

export function PlayerMiniView({
  data,
  roomCode,
}: {
  data: PlayerMiniViewData;
  roomCode: string;
}) {
  const view = derivePlayerView(data);
  const isActive = view.tone === "active";
  const isFolded = data.participant?.status === "FOLDED";
  const isOut =
    data.seat.status === "SITTING_OUT" ||
    (data.seat.chips_balance_cop === 0 && !data.activeHand);

  return (
    <div
      className={`felt-card flex flex-col gap-2 rounded-xl p-3 transition ${
        isActive ? "ring-2 ring-amber-500" : ""
      } ${isFolded ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar
            nickname={data.user.nickname}
            avatarUrl={data.user.avatar_url}
            size={48}
            disabled={isOut || isFolded}
            ringColor={isActive ? "#f59e0b" : undefined}
          />
          {data.isDealerButton && (
            <span
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-900 shadow"
              title="Botón del dealer"
            >
              D
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            #{data.seat.seat_index} · {data.user.nickname}
          </div>
          <div className="text-xs tabular-nums text-zinc-400">
            {formatCop(data.seat.chips_balance_cop)}
          </div>
        </div>
      </div>

      <div
        className={`rounded-md border px-2 py-1.5 text-center text-xs font-semibold ${
          TONE_CLASSES[view.tone] ?? TONE_CLASSES.muted!
        }`}
      >
        {view.label}
      </div>

      {data.participant && data.participant.current_bet_cop > 0 && (
        <div className="text-center text-[11px] text-zinc-400">
          apuesta{" "}
          <span className="tabular-nums text-amber-300">
            {formatCop(data.participant.current_bet_cop)}
          </span>
        </div>
      )}

      <DealerSeatControls
        roomCode={roomCode}
        seatId={data.seat.id}
        canFold={!!data.activeHand && data.participant?.status === "IN"}
        isSittingOut={data.seat.status === "SITTING_OUT"}
      />
    </div>
  );
}
