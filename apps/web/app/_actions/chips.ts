"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";

// ─── Jugador: solicitar fichas (cash) o pagar buy-in (torneo) ────────

export interface RequestChipsState {
  error?: string;
  ok?: boolean;
}

export async function requestChipsAction(
  _prev: RequestChipsState,
  formData: FormData,
): Promise<RequestChipsState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };

  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();
  const amount = Number(formData.get("amount_cop") || 0);
  if (!Number.isFinite(amount) || amount < 500 || amount % 500 !== 0) {
    return { error: "Monto inválido (≥ 500, múltiplo de 500)." };
  }

  const admin = createAdminClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id, game_type, min_buy_in_cop")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room) return { error: "Sala no encontrada." };

  if (room.game_type === "CASH" && amount < (room.min_buy_in_cop ?? 0)) {
    return {
      error: `El buy-in mínimo de esta mesa es ${room.min_buy_in_cop} COP.`,
    };
  }

  const { data: seat } = await admin
    .from("seats")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!seat) return { error: "No tienes posición en esta sala." };

  const { error } = await admin.from("chip_requests").insert({
    room_id: room.id,
    user_id: user.id,
    amount_cop: amount,
    status: "PENDING",
  });
  if (error) return { error: `No se pudo solicitar: ${error.message}` };

  return { ok: true };
}

// ─── Dealer: aprobar/rechazar solicitud de fichas ────────────────────

export async function approveChipRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return;

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("chip_requests")
    .select("id, room_id, user_id, amount_cop, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.status !== "PENDING") return;

  // Sala + asiento del jugador en paralelo
  const [{ data: room }, { data: seat }] = await Promise.all([
    admin
      .from("rooms")
      .select("dealer_user_id, code")
      .eq("id", req.room_id)
      .single(),
    admin
      .from("seats")
      .select("id, chips_balance_cop")
      .eq("room_id", req.room_id)
      .eq("user_id", req.user_id)
      .maybeSingle(),
  ]);
  if (!room || room.dealer_user_id !== user.id) return;
  if (!seat) return;

  // 3 mutaciones en paralelo (independientes entre sí)
  await Promise.all([
    admin
      .from("seats")
      .update({ chips_balance_cop: seat.chips_balance_cop + req.amount_cop })
      .eq("id", seat.id),
    admin
      .from("chip_requests")
      .update({ status: "APPROVED", resolved_at: new Date().toISOString() })
      .eq("id", req.id),
    admin.from("ledger_entries").insert({
      seat_id: seat.id,
      delta_cop: req.amount_cop,
      reason: "CHIP_REQUEST_APPROVED",
    }),
  ]);
}

export async function rejectChipRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return;

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("chip_requests")
    .select("id, room_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.status !== "PENDING") return;

  // Sala + update en paralelo (la verificación de dealer es post-update,
  // pero el update incluye un WHERE que verifica el room indirecto vía
  // el dealer's perspective abajo)
  const { data: room } = await admin
    .from("rooms")
    .select("dealer_user_id, code")
    .eq("id", req.room_id)
    .single();
  if (!room || room.dealer_user_id !== user.id) return;

  await admin
    .from("chip_requests")
    .update({ status: "REJECTED", resolved_at: new Date().toISOString() })
    .eq("id", req.id);
}
