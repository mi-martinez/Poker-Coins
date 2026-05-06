"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";

const PHASE_ORDER = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;
type Phase = (typeof PHASE_ORDER)[number];

export interface AdvancePhaseState {
  error?: string;
}

export async function advancePhaseAction(
  _prev: AdvancePhaseState,
  formData: FormData,
): Promise<AdvancePhaseState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };
  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();

  const admin = createAdminClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id, dealer_user_id")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room) return { error: "Sala no encontrada." };
  // Cualquier cliente (dealer o jugador) puede dispararlo cuando expira el
  // countdown — la atomicidad la garantiza el WHERE de la query.

  const { data: hand } = await admin
    .from("hands")
    .select("id, phase, dealer_seat_index, current_turn_seat_id, pot_cop")
    .eq("room_id", room.id)
    .is("ended_at", null)
    .maybeSingle();
  if (!hand) return { error: "No hay mano en juego." };

  const idx = PHASE_ORDER.indexOf(hand.phase as Phase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) {
    return { error: "Esta mano ya está en showdown." };
  }
  const nextPhase = PHASE_ORDER[idx + 1] as Phase;

  // Calcular primer turno de la nueva fase: primer IN después del dealer
  let firstToActId: string | null = null;
  if (nextPhase !== "SHOWDOWN") {
    const [{ data: parts }, { data: seatsList }] = await Promise.all([
      admin
        .from("hand_participants")
        .select("seat_id, status")
        .eq("hand_id", hand.id),
      admin
        .from("seats")
        .select("id, seat_index")
        .eq("room_id", room.id),
    ]);
    const inSeatIds = new Set(
      (parts ?? []).filter((p) => p.status === "IN").map((p) => p.seat_id),
    );
    const inSeats = (seatsList ?? []).filter((s) => inSeatIds.has(s.id));

    if (inSeats.length > 0) {
      const ordered = [...inSeats].sort((a, b) => {
        const aDist = (a.seat_index - hand.dealer_seat_index + 1000) % 1000;
        const bDist = (b.seat_index - hand.dealer_seat_index + 1000) % 1000;
        return aDist - bDist;
      });
      firstToActId = (ordered[1] ?? ordered[0])?.id ?? null;
    }
  }

  // Update atómico: solo aplica si seguimos en la misma fase. Si otro
  // cliente ya disparó la transición, esta query no actualiza nada.
  const { data: updated } = await admin
    .from("hands")
    .update({
      phase: nextPhase,
      current_turn_seat_id: firstToActId,
      phase_ready_at: null,
      turn_started_at: firstToActId ? new Date().toISOString() : null,
    })
    .eq("id", hand.id)
    .eq("phase", hand.phase)
    .select("id");

  if (!updated || updated.length === 0) {
    // Otro cliente ya avanzó la fase. No-op.
    return {};
  }

  // Resetear current_bet_cop de los participantes para la nueva ronda
  await admin
    .from("hand_participants")
    .update({ current_bet_cop: 0 })
    .eq("hand_id", hand.id);

  return {};
}
