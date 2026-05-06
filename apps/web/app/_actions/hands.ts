"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";

interface SeatLite {
  id: string;
  seat_index: number;
  chips_balance_cop: number;
}

// Devuelve los seats ordenados ciclicamente desde la posición del dealer
// (botón). orderedFromDealer[0] = dealer, [1] = SB, [2] = BB, [3] = UTG.
function orderFromDealer(seats: SeatLite[], dealerIdx: number): SeatLite[] {
  return [...seats].sort((a, b) => {
    const aDist = (a.seat_index - dealerIdx + 1000) % 1000;
    const bDist = (b.seat_index - dealerIdx + 1000) % 1000;
    return aDist - bDist;
  });
}

export interface StartHandState {
  error?: string;
}

export async function startHandAction(
  _prev: StartHandState,
  formData: FormData,
): Promise<StartHandState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };
  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();

  const admin = createAdminClient();

  const { data: room } = await admin
    .from("rooms")
    .select("id, dealer_user_id, status, blind_small_cop, blind_big_cop")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room) return { error: "Sala no encontrada." };
  if (room.dealer_user_id !== user.id) return { error: "No autorizado." };
  if (room.status !== "ACTIVE") {
    return { error: "La sala no está activa." };
  }

  // No iniciar si hay mano en progreso
  const { data: liveHand } = await admin
    .from("hands")
    .select("id")
    .eq("room_id", room.id)
    .is("ended_at", null)
    .maybeSingle();
  if (liveHand) return { error: "Ya hay una mano en juego." };

  // Jugadores con fichas y asiento ocupado
  const { data: seats } = await admin
    .from("seats")
    .select("id, seat_index, chips_balance_cop, user_id, status")
    .eq("room_id", room.id)
    .not("user_id", "is", null)
    .gt("chips_balance_cop", 0)
    .in("status", ["WAITING", "ACTIVE"])
    .order("seat_index");

  if (!seats || seats.length < 2) {
    return { error: "Se necesitan al menos 2 jugadores con fichas." };
  }

  // Determinar dealer button (rota cada mano; primera vez = primer asiento ocupado)
  const { data: lastHand } = await admin
    .from("hands")
    .select("hand_number, dealer_seat_index")
    .eq("room_id", room.id)
    .order("hand_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const handNumber = (lastHand?.hand_number ?? 0) + 1;
  let dealerSeatIdx: number;
  if (!lastHand) {
    dealerSeatIdx = seats[0]!.seat_index;
  } else {
    const next =
      seats.find((s) => s.seat_index > lastHand.dealer_seat_index) ?? seats[0]!;
    dealerSeatIdx = next.seat_index;
  }

  const ordered = orderFromDealer(seats as SeatLite[], dealerSeatIdx);
  // Heads-up: dealer es SB y actúa primero preflop
  let sbSeat: SeatLite, bbSeat: SeatLite, firstToActSeat: SeatLite;
  if (ordered.length === 2) {
    sbSeat = ordered[0]!;
    bbSeat = ordered[1]!;
    firstToActSeat = ordered[0]!;
  } else {
    sbSeat = ordered[1]!;
    bbSeat = ordered[2]!;
    firstToActSeat = ordered[3] ?? ordered[0]!; // wrap si solo hay 3
  }

  // Cap blinds al saldo actual (all-in si no alcanza)
  const sbAmount = Math.min(room.blind_small_cop, sbSeat.chips_balance_cop);
  const bbAmount = Math.min(room.blind_big_cop, bbSeat.chips_balance_cop);

  // Crear la mano
  const { data: hand, error: handErr } = await admin
    .from("hands")
    .insert({
      room_id: room.id,
      hand_number: handNumber,
      dealer_seat_index: dealerSeatIdx,
      phase: "PREFLOP",
      pot_cop: sbAmount + bbAmount,
      current_turn_seat_id: firstToActSeat.id,
      turn_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (handErr || !hand) {
    return { error: `No se pudo crear la mano: ${handErr?.message ?? "?"}` };
  }

  // Participantes: todos los seats elegibles
  const participantsPayload = (seats as SeatLite[]).map((s) => ({
    hand_id: hand.id,
    seat_id: s.id,
    status: "IN" as const,
    current_bet_cop:
      s.id === sbSeat.id ? sbAmount : s.id === bbSeat.id ? bbAmount : 0,
    total_bet_cop:
      s.id === sbSeat.id ? sbAmount : s.id === bbSeat.id ? bbAmount : 0,
  }));
  await admin.from("hand_participants").insert(participantsPayload);

  // Descontar blinds + marcar seats como ACTIVE
  await admin
    .from("seats")
    .update({
      chips_balance_cop: sbSeat.chips_balance_cop - sbAmount,
      status: "ACTIVE",
    })
    .eq("id", sbSeat.id);
  await admin
    .from("seats")
    .update({
      chips_balance_cop: bbSeat.chips_balance_cop - bbAmount,
      status: "ACTIVE",
    })
    .eq("id", bbSeat.id);
  const otherIds = (seats as SeatLite[])
    .filter((s) => s.id !== sbSeat.id && s.id !== bbSeat.id)
    .map((s) => s.id);
  if (otherIds.length > 0) {
    await admin.from("seats").update({ status: "ACTIVE" }).in("id", otherIds);
  }

  // Registro de acciones (auditoría)
  await admin.from("actions").insert([
    {
      hand_id: hand.id,
      seat_id: sbSeat.id,
      phase: "PREFLOP",
      type: "SMALL_BLIND",
      amount_cop: sbAmount,
    },
    {
      hand_id: hand.id,
      seat_id: bbSeat.id,
      phase: "PREFLOP",
      type: "BIG_BLIND",
      amount_cop: bbAmount,
    },
  ]);

  // Ledger
  await admin.from("ledger_entries").insert([
    {
      seat_id: sbSeat.id,
      delta_cop: -sbAmount,
      hand_id: hand.id,
      reason: "SMALL_BLIND",
    },
    {
      seat_id: bbSeat.id,
      delta_cop: -bbAmount,
      hand_id: hand.id,
      reason: "BIG_BLIND",
    },
  ]);

  return {};
}
