"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generateRoomCode,
  isValidRoomCode,
  randomGreekName,
} from "@poker-coins/game";
import type { Database } from "@poker-coins/db";
import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";

type RoomInsert = Database["public"]["Tables"]["rooms"]["Insert"];

// ─── createRoomAction ────────────────────────────────────────────────

export interface CreateRoomFormState {
  error?: string;
}

export async function createRoomAction(
  _prev: CreateRoomFormState,
  formData: FormData,
): Promise<CreateRoomFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dealer");

  const blindSmall = Number(formData.get("blind_small") ?? 500);
  const blindBig = Number(formData.get("blind_big") ?? 1000);
  const maxSeats = Number(formData.get("max_seats") ?? 9);
  const gameType = String(formData.get("game_type") ?? "CASH") as
    | "CASH"
    | "TOURNAMENT";
  const minBuyIn = Number(formData.get("min_buy_in") || 0);
  const tournamentCost = Number(formData.get("tournament_cost") || 0);
  const rebuyEnabled = formData.get("rebuy_enabled") === "on";
  const rebuyCost = Number(formData.get("rebuy_cost") || 0);
  const maxRebuys = Number(formData.get("max_rebuys") || 0);
  const turnTimerEnabled = formData.get("turn_timer_enabled") === "on";
  const turnTimerSeconds = Number(formData.get("turn_timer_seconds") || 30);

  // Validaciones comunes
  if (!Number.isFinite(blindSmall) || blindSmall <= 0 || blindSmall % 500 !== 0) {
    return { error: "Ciega pequeña inválida (múltiplo de 500)." };
  }
  if (!Number.isFinite(blindBig) || blindBig <= blindSmall || blindBig % 500 !== 0) {
    return { error: "Ciega grande debe ser mayor que la pequeña y múltiplo de 500." };
  }
  if (!Number.isInteger(maxSeats) || maxSeats < 2 || maxSeats > 10) {
    return { error: "Asientos máximos: entre 2 y 10." };
  }
  if (gameType !== "CASH" && gameType !== "TOURNAMENT") {
    return { error: "Tipo de juego inválido." };
  }
  if (
    turnTimerEnabled &&
    (!Number.isInteger(turnTimerSeconds) ||
      turnTimerSeconds < 5 ||
      turnTimerSeconds > 300)
  ) {
    return { error: "Tiempo por turno: entre 5 y 300 segundos." };
  }

  // Validaciones específicas por tipo
  const baseInsert: Omit<RoomInsert, "code"> = {
    dealer_user_id: user.id,
    blind_small_cop: blindSmall,
    blind_big_cop: blindBig,
    max_seats: maxSeats,
    game_type: gameType,
    turn_timer_enabled: turnTimerEnabled,
    turn_timer_seconds: turnTimerEnabled ? turnTimerSeconds : 30,
    name: randomGreekName(),
  };

  let insertPayload: Omit<RoomInsert, "code">;
  if (gameType === "CASH") {
    if (!Number.isFinite(minBuyIn) || minBuyIn < 500 || minBuyIn % 500 !== 0) {
      return { error: "Buy-in mínimo: ≥ 500 y múltiplo de 500." };
    }
    insertPayload = {
      ...baseInsert,
      min_buy_in_cop: minBuyIn,
      status: "ACTIVE",
    };
  } else {
    if (
      !Number.isFinite(tournamentCost) ||
      tournamentCost < 500 ||
      tournamentCost % 500 !== 0
    ) {
      return { error: "Costo de entrada del torneo: ≥ 500 y múltiplo de 500." };
    }
    if (rebuyEnabled) {
      if (!Number.isFinite(rebuyCost) || rebuyCost < 500 || rebuyCost % 500 !== 0) {
        return { error: "Costo de recompra: ≥ 500 y múltiplo de 500." };
      }
      if (!Number.isInteger(maxRebuys) || maxRebuys < 1 || maxRebuys > 20) {
        return { error: "Recompras máximas: entre 1 y 20." };
      }
    }
    insertPayload = {
      ...baseInsert,
      tournament_cost_cop: tournamentCost,
      rebuy_enabled: rebuyEnabled,
      rebuy_cost_cop: rebuyEnabled ? rebuyCost : null,
      max_rebuys: rebuyEnabled ? maxRebuys : null,
      status: "LOBBY",
    };
  }

  const admin = createAdminClient();

  // Insertar sala con código único (reintenta hasta 5 veces si colisiona)
  let roomId = "";
  let roomCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRoomCode();
    const { data, error } = await admin
      .from("rooms")
      .insert({ ...insertPayload, code: candidate })
      .select("id, code")
      .single();
    if (!error && data) {
      roomId = data.id;
      roomCode = data.code;
      break;
    }
    if (error && !error.message.includes("rooms_code_key")) {
      return { error: `No se pudo crear sala: ${error.message}` };
    }
  }
  if (!roomId) return { error: "No se pudo generar un código único." };

  // Pre-crear N posiciones con código único cada una
  const seats = [];
  const usedCodes = new Set<string>([roomCode]);
  for (let i = 0; i < maxSeats; i++) {
    let code = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateRoomCode();
      if (!usedCodes.has(candidate)) {
        code = candidate;
        usedCodes.add(candidate);
        break;
      }
    }
    if (!code) {
      // Rollback parcial: borrar la sala
      await admin.from("rooms").delete().eq("id", roomId);
      return { error: "No se pudieron generar códigos únicos para posiciones." };
    }
    seats.push({
      room_id: roomId,
      seat_index: i,
      seat_code: code,
      status: "WAITING" as const,
    });
  }

  const { error: seatsErr } = await admin.from("seats").insert(seats);
  if (seatsErr) {
    await admin.from("rooms").delete().eq("id", roomId);
    return { error: `No se pudieron crear posiciones: ${seatsErr.message}` };
  }

  redirect(`/dealer/${roomCode}` as never);
}

// ─── joinSeatAction ──────────────────────────────────────────────────

export interface JoinSeatFormState {
  error?: string;
}

export async function joinSeatAction(
  _prev: JoinSeatFormState,
  formData: FormData,
): Promise<JoinSeatFormState> {
  const seatCode = String(formData.get("seat_code") ?? "").toUpperCase().trim();

  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/sign-in?next=/play${seatCode ? `?seat_code=${seatCode}` : ""}`,
    );
  }

  if (!isValidRoomCode(seatCode)) {
    return { error: "Código de posición inválido (6 caracteres)." };
  }

  const admin = createAdminClient();

  const { data: seat, error: seatErr } = await admin
    .from("seats")
    .select("id, room_id, user_id, status")
    .eq("seat_code", seatCode)
    .maybeSingle();

  if (seatErr || !seat) return { error: "Posición no encontrada." };

  // Si ya está ocupada por otro usuario, rechazar
  if (seat.user_id && seat.user_id !== user.id) {
    return { error: "Esta posición ya está ocupada por otro jugador." };
  }

  // Si el usuario ya tiene otra posición en la misma sala, redirigir a esa
  if (!seat.user_id) {
    const { data: existing } = await admin
      .from("seats")
      .select("id")
      .eq("room_id", seat.room_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      // Tiene otra posición en la sala — bloquear (no permitir doble)
      return {
        error: "Ya tienes otra posición en esta sala. Pídele al dealer un cambio.",
      };
    }

    // Asignar usuario a la posición
    const { error: updErr } = await admin
      .from("seats")
      .update({
        user_id: user.id,
        status: "WAITING",
      })
      .eq("id", seat.id);
    if (updErr) return { error: `No se pudo unir: ${updErr.message}` };
  }

  // Recuperar el código de sala para el redirect
  const { data: room } = await admin
    .from("rooms")
    .select("code, dealer_user_id")
    .eq("id", seat.room_id)
    .single();
  if (!room) return { error: "Sala no encontrada." };

  if (room.dealer_user_id === user.id) {
    redirect(`/dealer/${room.code}` as never);
  }

  redirect(`/play/${room.code}` as never);
}

// ─── closeRoomAction ─────────────────────────────────────────────────

export async function closeRoomAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();
  if (!roomCode) return;

  const admin = createAdminClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id, dealer_user_id, status")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room || room.dealer_user_id !== user.id) return;
  if (room.status === "CLOSED") return;

  await admin
    .from("rooms")
    .update({ status: "CLOSED" })
    .eq("id", room.id);

  revalidatePath(`/dealer`);
}
