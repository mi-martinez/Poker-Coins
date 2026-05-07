"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";
import { isBettingClosed, nextActorSeatId } from "@/lib/turn-logic";

interface SeatLite {
  id: string;
  seat_index: number;
}

interface ParticipantLite {
  id: string;
  seat_id: string;
  status: "IN" | "FOLDED" | "ALL_IN";
  current_bet_cop: number;
}

// ─── Dealer foldea por un jugador (AFK / desconectado) ───────────────

export async function dealerForceFoldAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();
  const seatId = String(formData.get("seat_id") ?? "");
  if (!seatId) return;

  const admin = createAdminClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id, dealer_user_id")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room || room.dealer_user_id !== user.id) return;

  const { data: hand } = await admin
    .from("hands")
    .select("id, dealer_seat_index, phase, pot_cop, current_turn_seat_id")
    .eq("room_id", room.id)
    .is("ended_at", null)
    .maybeSingle();
  if (!hand) return;

  const { data: participant } = await admin
    .from("hand_participants")
    .select("id, seat_id, status, current_bet_cop")
    .eq("hand_id", hand.id)
    .eq("seat_id", seatId)
    .maybeSingle();
  if (!participant || participant.status !== "IN") return;

  // Marcar foldeado + registrar action
  await Promise.all([
    admin
      .from("hand_participants")
      .update({ status: "FOLDED" })
      .eq("id", participant.id),
    admin.from("actions").insert({
      hand_id: hand.id,
      seat_id: seatId,
      phase: hand.phase,
      type: "FOLD",
      amount_cop: 0,
    }),
  ]);

  // Recalcular sobrevivientes y avance de turno (similar a playerAction)
  const [{ data: allParts }, { data: allSeatsList }] = await Promise.all([
    admin
      .from("hand_participants")
      .select("id, seat_id, status, current_bet_cop")
      .eq("hand_id", hand.id),
    admin
      .from("seats")
      .select("id, seat_index, chips_balance_cop")
      .eq("room_id", room.id),
  ]);
  const participants = (allParts ?? []) as ParticipantLite[];
  const seatsList = (allSeatsList ?? []) as (SeatLite & {
    chips_balance_cop: number;
  })[];

  const liveList = participants.filter(
    (p) => p.status === "IN" || p.status === "ALL_IN",
  );

  // Caso: solo queda 1 sobreviviente → auto-distribución
  if (liveList.length === 1) {
    const winnerParticipant = liveList[0]!;
    const winnerSeat = seatsList.find(
      (s) => s.id === winnerParticipant.seat_id,
    );
    if (winnerSeat) {
      await Promise.all([
        admin
          .from("seats")
          .update({
            chips_balance_cop:
              winnerSeat.chips_balance_cop + hand.pot_cop,
          })
          .eq("id", winnerSeat.id),
        admin.from("payouts").insert({
          hand_id: hand.id,
          seat_id: winnerSeat.id,
          amount_cop: hand.pot_cop,
          reason: "FOLD_WIN",
        }),
        admin.from("ledger_entries").insert({
          seat_id: winnerSeat.id,
          delta_cop: hand.pot_cop,
          hand_id: hand.id,
          reason: "POT_WIN",
        }),
        admin
          .from("hands")
          .update({
            ended_at: new Date().toISOString(),
            pot_cop: 0,
            current_turn_seat_id: null,
            phase_ready_at: null,
            turn_started_at: null,
          })
          .eq("id", hand.id),
      ]);
    }
    return;
  }

  // Avance de turno: idéntica lógica a play.ts. SB/BB se filtran
  // (acciones forzadas, no cuentan como turno voluntario). El fold
  // sí cuenta — se inserta arriba con type=FOLD.
  const { data: phaseActions } = await admin
    .from("actions")
    .select("seat_id, type")
    .eq("hand_id", hand.id)
    .eq("phase", hand.phase);
  const seatsActed = new Set(
    (phaseActions ?? [])
      .filter((a) => a.type !== "SMALL_BLIND" && a.type !== "BIG_BLIND")
      .map((a) => a.seat_id),
  );
  seatsActed.add(seatId);

  let nextTurn: string | null = null;
  if (!isBettingClosed(participants, seatsActed)) {
    // Pivot: si el foldeado tenía el turno, el actor "from" es él;
    // si era otro turno, conservamos ese turno (no debería pasar
    // porque solo se foldea por timeout del actor — pero por
    // seguridad calculamos el siguiente desde su seat).
    nextTurn = nextActorSeatId(
      seatsList,
      participants,
      seatId,
      hand.dealer_seat_index,
    );
  }

  const canAutoAdvance = ["PREFLOP", "FLOP", "TURN", "RIVER"].includes(
    hand.phase,
  );
  const phaseReadyAt =
    nextTurn === null && canAutoAdvance ? new Date().toISOString() : null;

  await admin
    .from("hands")
    .update({
      current_turn_seat_id: nextTurn,
      phase_ready_at: phaseReadyAt,
      turn_started_at: nextTurn ? new Date().toISOString() : null,
    })
    .eq("id", hand.id);
}

// ─── Dealer marca un asiento para que NO juegue la próxima mano ──────

export async function toggleSitOutAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();
  const seatId = String(formData.get("seat_id") ?? "");
  if (!seatId) return;

  const admin = createAdminClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id, dealer_user_id")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room || room.dealer_user_id !== user.id) return;

  const { data: seat } = await admin
    .from("seats")
    .select("id, room_id, status")
    .eq("id", seatId)
    .maybeSingle();
  if (!seat || seat.room_id !== room.id) return;

  const newStatus = seat.status === "SITTING_OUT" ? "WAITING" : "SITTING_OUT";

  await admin
    .from("seats")
    .update({ status: newStatus })
    .eq("id", seatId);
}
