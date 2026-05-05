"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";

export interface CloseHandState {
  error?: string;
}

// Dealer declara ganador(es) y reparte el pozo. Cuando hay múltiples
// winners (split pot por empate o reparto manual de side pots), el
// pozo se divide en partes iguales; el primero recibe el residuo si la
// división no es exacta.
export async function closeHandAction(
  _prev: CloseHandState,
  formData: FormData,
): Promise<CloseHandState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };

  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();
  const winnerIds = formData
    .getAll("winner_seat_id")
    .map((v) => String(v))
    .filter(Boolean);
  if (winnerIds.length === 0) {
    return { error: "Selecciona al menos un ganador." };
  }

  const admin = createAdminClient();

  const { data: room } = await admin
    .from("rooms")
    .select("id, dealer_user_id")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room) return { error: "Sala no encontrada." };
  if (room.dealer_user_id !== user.id) return { error: "No autorizado." };

  const { data: hand } = await admin
    .from("hands")
    .select("id, pot_cop")
    .eq("room_id", room.id)
    .is("ended_at", null)
    .maybeSingle();
  if (!hand) return { error: "No hay mano abierta." };

  const { data: winnerSeats } = await admin
    .from("seats")
    .select("id, room_id, chips_balance_cop")
    .in("id", winnerIds);
  if (!winnerSeats || winnerSeats.length !== winnerIds.length) {
    return { error: "Asientos ganadores inválidos." };
  }
  if (winnerSeats.some((s) => s.room_id !== room.id)) {
    return { error: "Asientos no pertenecen a esta sala." };
  }

  const pot = hand.pot_cop;
  const n = winnerSeats.length;
  const share = Math.floor(pot / n);
  const remainder = pot - share * n;

  // Reparto: el primer winner recibe el residuo (si lo hay)
  const distributions = winnerSeats.map((seat, i) => ({
    seat,
    amount: share + (i === 0 ? remainder : 0),
  }));

  await Promise.all([
    ...distributions.map((d) =>
      admin
        .from("seats")
        .update({ chips_balance_cop: d.seat.chips_balance_cop + d.amount })
        .eq("id", d.seat.id),
    ),
    ...distributions.map((d) =>
      admin.from("payouts").insert({
        hand_id: hand.id,
        seat_id: d.seat.id,
        amount_cop: d.amount,
        reason:
          n > 1 ? "WINNER_DECLARED_SPLIT" : "WINNER_DECLARED",
      }),
    ),
    ...distributions.map((d) =>
      admin.from("ledger_entries").insert({
        seat_id: d.seat.id,
        delta_cop: d.amount,
        hand_id: hand.id,
        reason: "POT_WIN",
      }),
    ),
    admin
      .from("hands")
      .update({
        ended_at: new Date().toISOString(),
        pot_cop: 0,
        current_turn_seat_id: null,
        phase_ready_at: null,
        turn_started_at: null,
      })
      .eq("id", hand.id)
      .is("ended_at", null), // idempotente
  ]);

  revalidatePath(`/dealer/${roomCode}`);
  revalidatePath(`/play/${roomCode}`);
  return {};
}
