import "server-only";
import type { CardMode, GameType, RoomStatus } from "@poker-coins/db";
import type { createAdminClient } from "./supabase-admin";
import { startHandCore } from "./start-hand-core";

type Admin = ReturnType<typeof createAdminClient>;

interface RoomLite {
  id: string;
  status: RoomStatus;
  card_mode: CardMode;
  game_type: GameType;
  blind_small_cop: number;
  blind_big_cop: number;
  min_buy_in_cop: number | null;
  tournament_cost_cop: number | null;
}

// En modo VIRTUAL, sentamos al jugador en el primer asiento libre y le
// damos fichas iniciales si es CASH. Idempotente — si ya está sentado
// no hace nada.
export async function autoSeatVirtualPlayer(
  admin: Admin,
  room: RoomLite,
  userId: string,
): Promise<{ seatId: string } | null> {
  // ¿Ya está sentado?
  const { data: existing } = await admin
    .from("seats")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return { seatId: existing.id };

  // Primer asiento vacío
  const { data: empty } = await admin
    .from("seats")
    .select("id, seat_index")
    .eq("room_id", room.id)
    .is("user_id", null)
    .order("seat_index")
    .limit(1)
    .maybeSingle();
  if (!empty) return null; // mesa llena

  // CASH: stack inicial = min_buy_in. TOURNAMENT: 0 hasta que el
  // torneo arranque (allí se asigna el buy-in completo).
  const startingChips =
    room.game_type === "CASH" ? (room.min_buy_in_cop ?? 0) : 0;

  await admin
    .from("seats")
    .update({
      user_id: userId,
      chips_balance_cop: startingChips,
      status: "WAITING",
    })
    .eq("id", empty.id);

  if (startingChips > 0) {
    await admin.from("ledger_entries").insert({
      seat_id: empty.id,
      delta_cop: startingChips,
      reason: "AUTO_BUY_IN",
    });
  }

  return { seatId: empty.id };
}

// Si el room VIRTUAL tiene ≥2 jugadores con fichas y ninguna mano
// activa, dispara una nueva mano. En TOURNAMENT, primero promueve la
// sala de LOBBY a ACTIVE asignando el buy-in.
export async function autoStartVirtualHand(
  admin: Admin,
  room: RoomLite,
): Promise<{ started: boolean; reason?: string }> {
  if (room.card_mode !== "VIRTUAL") {
    return { started: false, reason: "not virtual" };
  }

  // ¿Hay mano viva?
  const { data: live } = await admin
    .from("hands")
    .select("id")
    .eq("room_id", room.id)
    .is("ended_at", null)
    .maybeSingle();
  if (live) return { started: false, reason: "live hand" };

  // TOURNAMENT en LOBBY: contar ocupados; si ≥2, asignar buy-in y
  // poner la sala en ACTIVE.
  let effectiveStatus: RoomStatus = room.status;
  if (
    room.game_type === "TOURNAMENT" &&
    room.status === "LOBBY"
  ) {
    const { data: occupied } = await admin
      .from("seats")
      .select("id, chips_balance_cop")
      .eq("room_id", room.id)
      .not("user_id", "is", null);
    if (!occupied || occupied.length < 2) {
      return { started: false, reason: "lobby waiting" };
    }
    const buyIn = room.tournament_cost_cop ?? 0;
    if (buyIn > 0) {
      for (const s of occupied) {
        await admin
          .from("seats")
          .update({
            chips_balance_cop: s.chips_balance_cop + buyIn,
            status: "ACTIVE",
          })
          .eq("id", s.id);
        await admin.from("ledger_entries").insert({
          seat_id: s.id,
          delta_cop: buyIn,
          reason: "TOURNAMENT_BUY_IN",
        });
      }
    }
    await admin.from("rooms").update({ status: "ACTIVE" }).eq("id", room.id);
    effectiveStatus = "ACTIVE";
  }

  if (effectiveStatus !== "ACTIVE") {
    return { started: false, reason: "not active" };
  }

  // ¿≥2 jugadores con fichas?
  const { data: ready } = await admin
    .from("seats")
    .select("id")
    .eq("room_id", room.id)
    .not("user_id", "is", null)
    .gt("chips_balance_cop", 0)
    .in("status", ["WAITING", "ACTIVE"]);
  if (!ready || ready.length < 2) {
    return { started: false, reason: "not enough players with chips" };
  }

  const result = await startHandCore(admin, {
    id: room.id,
    status: effectiveStatus,
    blind_small_cop: room.blind_small_cop,
    blind_big_cop: room.blind_big_cop,
    card_mode: room.card_mode,
  });
  if (result.error) {
    console.error("[autoStartVirtualHand]", result.error);
    return { started: false, reason: result.error };
  }
  return { started: true };
}
