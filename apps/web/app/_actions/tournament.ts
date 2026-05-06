"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";

export async function startTournamentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const roomCode = String(formData.get("room_code") ?? "").toUpperCase();

  const admin = createAdminClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id, code, dealer_user_id, status, game_type, tournament_cost_cop")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room) return;
  if (room.dealer_user_id !== user.id) return;
  if (room.game_type !== "TOURNAMENT") return;
  if (room.status !== "LOBBY") return;

  // Asignar el buy-in del torneo a cada jugador con seat ocupado
  const { data: occupiedSeats } = await admin
    .from("seats")
    .select("id, chips_balance_cop")
    .eq("room_id", room.id)
    .not("user_id", "is", null);

  const buyIn = room.tournament_cost_cop ?? 0;
  if (occupiedSeats && occupiedSeats.length > 0) {
    for (const s of occupiedSeats) {
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
}
