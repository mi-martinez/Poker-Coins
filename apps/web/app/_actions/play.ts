"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";

type ActionType = "FOLD" | "CHECK" | "CALL" | "RAISE" | "ALL_IN";

export interface PlayerActionState {
  error?: string;
}

interface SeatLite {
  id: string;
  seat_index: number;
  chips_balance_cop: number;
  user_id: string | null;
}

interface ParticipantLite {
  id: string;
  seat_id: string;
  status: "IN" | "FOLDED" | "ALL_IN";
  current_bet_cop: number;
  total_bet_cop: number;
}

// Devuelve siguiente seat con participación activa (status = IN), en
// orden cíclico desde el dealer button. Si quedan ≤1 IN, no hay
// próximo turno posible — la ronda cerró (los ALL_IN no pueden actuar).
function nextTurnSeatId(
  seats: SeatLite[],
  participants: ParticipantLite[],
  fromSeatId: string,
  dealerSeatIdx: number,
): string | null {
  const inSeats = seats.filter((s) => {
    const p = participants.find((pp) => pp.seat_id === s.id);
    return p && p.status === "IN";
  });
  if (inSeats.length <= 1) return null;
  const ordered = [...inSeats].sort((a, b) => {
    const aDist = (a.seat_index - dealerSeatIdx + 1000) % 1000;
    const bDist = (b.seat_index - dealerSeatIdx + 1000) % 1000;
    return aDist - bDist;
  });
  const idx = ordered.findIndex((s) => s.id === fromSeatId);
  if (idx === -1) return ordered[0]!.id;
  const next = ordered[(idx + 1) % ordered.length];
  return next ? next.id : null;
}

export async function playerAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };

  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();
  const action = String(formData.get("action") ?? "") as ActionType;
  const raiseAmount = Number(formData.get("raise_amount") || 0);

  if (!["FOLD", "CHECK", "CALL", "RAISE", "ALL_IN"].includes(action)) {
    return { error: "Acción inválida." };
  }

  const admin = createAdminClient();

  // Sala + mano activa
  const { data: room } = await admin
    .from("rooms")
    .select("id, blind_big_cop")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room) return { error: "Sala no encontrada." };

  const { data: hand } = await admin
    .from("hands")
    .select("id, dealer_seat_index, phase, pot_cop, current_turn_seat_id")
    .eq("room_id", room.id)
    .is("ended_at", null)
    .maybeSingle();
  if (!hand) return { error: "No hay mano en juego." };

  // Mi seat
  const { data: mySeat } = await admin
    .from("seats")
    .select("id, seat_index, chips_balance_cop, user_id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mySeat) return { error: "No tienes asiento." };
  if (hand.current_turn_seat_id !== mySeat.id) {
    return { error: "No es tu turno." };
  }

  // Mi participación
  const { data: myParticipant } = await admin
    .from("hand_participants")
    .select("id, seat_id, status, current_bet_cop, total_bet_cop")
    .eq("hand_id", hand.id)
    .eq("seat_id", mySeat.id)
    .maybeSingle();
  if (!myParticipant) return { error: "No estás en esta mano." };
  if (myParticipant.status !== "IN") {
    return { error: "Ya no estás en juego en esta mano." };
  }

  // Todos los seats + participantes (para calcular turno + current_bet)
  const [{ data: allSeats }, { data: allParticipants }] = await Promise.all([
    admin
      .from("seats")
      .select("id, seat_index, chips_balance_cop, user_id")
      .eq("room_id", room.id),
    admin
      .from("hand_participants")
      .select("id, seat_id, status, current_bet_cop, total_bet_cop")
      .eq("hand_id", hand.id),
  ]);
  const seats = (allSeats ?? []) as SeatLite[];
  const participants = (allParticipants ?? []) as ParticipantLite[];

  const currentBet = participants.reduce(
    (max, p) => Math.max(max, p.current_bet_cop),
    0,
  );
  const toCall = currentBet - myParticipant.current_bet_cop;

  let deltaChips = 0;
  let newCurrentBet = myParticipant.current_bet_cop;
  let newStatus: "IN" | "FOLDED" | "ALL_IN" = "IN";
  let actionAmount = 0;

  switch (action) {
    case "FOLD":
      newStatus = "FOLDED";
      break;
    case "CHECK":
      if (toCall > 0) return { error: "No puedes pasar — debes igualar." };
      break;
    case "CALL": {
      if (toCall <= 0) return { error: "No hay nada que igualar." };
      const pay = Math.min(toCall, mySeat.chips_balance_cop);
      deltaChips = -pay;
      newCurrentBet = myParticipant.current_bet_cop + pay;
      actionAmount = pay;
      if (pay === mySeat.chips_balance_cop) newStatus = "ALL_IN";
      break;
    }
    case "RAISE": {
      // raiseAmount = total al que sube (no incremento)
      const minRaise = currentBet + room.blind_big_cop;
      if (raiseAmount < minRaise) {
        return {
          error: `El raise mínimo es ${minRaise}.`,
        };
      }
      const pay = raiseAmount - myParticipant.current_bet_cop;
      if (pay > mySeat.chips_balance_cop) {
        return { error: "No tienes fichas suficientes." };
      }
      deltaChips = -pay;
      newCurrentBet = raiseAmount;
      actionAmount = pay;
      if (pay === mySeat.chips_balance_cop) newStatus = "ALL_IN";
      break;
    }
    case "ALL_IN": {
      const pay = mySeat.chips_balance_cop;
      if (pay <= 0) return { error: "No tienes fichas." };
      deltaChips = -pay;
      newCurrentBet = myParticipant.current_bet_cop + pay;
      actionAmount = pay;
      newStatus = "ALL_IN";
      break;
    }
  }

  // Aplicar cambios
  if (deltaChips !== 0) {
    await admin
      .from("seats")
      .update({ chips_balance_cop: mySeat.chips_balance_cop + deltaChips })
      .eq("id", mySeat.id);
  }
  await admin
    .from("hand_participants")
    .update({
      status: newStatus,
      current_bet_cop: newCurrentBet,
      total_bet_cop: myParticipant.total_bet_cop + Math.abs(deltaChips),
    })
    .eq("id", myParticipant.id);

  await admin.from("actions").insert({
    hand_id: hand.id,
    seat_id: mySeat.id,
    phase: hand.phase,
    type: action,
    amount_cop: actionAmount,
  });

  if (deltaChips !== 0) {
    await admin.from("ledger_entries").insert({
      seat_id: mySeat.id,
      delta_cop: deltaChips,
      hand_id: hand.id,
      reason: `BET_${action}`,
    });
  }

  // Refresh participantes con mi cambio aplicado
  const updatedParticipants = participants.map((p) =>
    p.seat_id === mySeat.id
      ? { ...p, status: newStatus, current_bet_cop: newCurrentBet }
      : p,
  );

  // Sobrevivientes (IN o ALL_IN) — están en la mano hasta showdown.
  // Solo IN pueden seguir apostando; ALL_IN están bloqueados.
  const liveList = updatedParticipants.filter(
    (p) => p.status === "IN" || p.status === "ALL_IN",
  );
  const inOnlyList = updatedParticipants.filter((p) => p.status === "IN");

  let nextTurn: string | null = null;

  if (liveList.length > 1) {
    if (inOnlyList.length <= 1) {
      // Quedan ≥2 vivos pero ≤1 puede apostar → no hay más betting
      // posible. La ronda cierra. El dealer fast-forwarea las fases
      // hasta showdown y declara ganador(es) por pozo(s).
      nextTurn = null;
    } else {
      const maxBet = Math.max(...inOnlyList.map((p) => p.current_bet_cop));
      const allMatch = inOnlyList.every(
        (p) => p.current_bet_cop === maxBet,
      );

      // ¿Todos los IN ya actuaron en esta fase?
      const { data: phaseActions } = await admin
        .from("actions")
        .select("seat_id")
        .eq("hand_id", hand.id)
        .eq("phase", hand.phase);
      const seatsActed = new Set(
        (phaseActions ?? []).map((a) => a.seat_id),
      );
      const allActedThisPhase = inOnlyList.every((p) =>
        seatsActed.has(p.seat_id),
      );

      if (allMatch && allActedThisPhase) {
        nextTurn = null;
      } else {
        nextTurn = nextTurnSeatId(
          seats,
          updatedParticipants,
          mySeat.id,
          hand.dealer_seat_index,
        );
      }
    }
  }

  const newPot = hand.pot_cop + Math.abs(deltaChips);

  // Caso 1: solo queda 1 sobreviviente (IN o ALL_IN) → auto-distribución
  // del pozo. El ganador es obvio (los demás foldearon).
  if (liveList.length === 1) {
    const winnerParticipant = liveList[0]!;
    const winnerSeat = seats.find((s) => s.id === winnerParticipant.seat_id);
    if (winnerSeat) {
      await Promise.all([
        admin
          .from("seats")
          .update({
            chips_balance_cop: winnerSeat.chips_balance_cop + newPot,
          })
          .eq("id", winnerSeat.id),
        admin.from("payouts").insert({
          hand_id: hand.id,
          seat_id: winnerSeat.id,
          amount_cop: newPot,
          reason: "FOLD_WIN",
        }),
        admin.from("ledger_entries").insert({
          seat_id: winnerSeat.id,
          delta_cop: newPot,
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
          })
          .eq("id", hand.id),
      ]);
    }
    return {};
  }

  // Caso 2: ronda cerrada con ≥2 IN → countdown de 10s antes del avance
  // de fase (solo si no estamos en showdown).
  const canAutoAdvance = ["PREFLOP", "FLOP", "TURN", "RIVER"].includes(
    hand.phase,
  );
  const phaseReadyAt =
    nextTurn === null && canAutoAdvance ? new Date().toISOString() : null;

  await admin
    .from("hands")
    .update({
      pot_cop: newPot,
      current_turn_seat_id: nextTurn,
      phase_ready_at: phaseReadyAt,
      turn_started_at: nextTurn ? new Date().toISOString() : null,
    })
    .eq("id", hand.id);

  return {};
}
