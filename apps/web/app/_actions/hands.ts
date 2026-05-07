"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";
import { startHandCore } from "@/lib/start-hand-core";

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
    .select(
      "id, dealer_user_id, status, blind_small_cop, blind_big_cop, card_mode",
    )
    .eq("code", roomCode)
    .maybeSingle();
  if (!room) return { error: "Sala no encontrada." };
  if (room.dealer_user_id !== user.id) return { error: "No autorizado." };

  return startHandCore(admin, {
    id: room.id,
    status: room.status,
    blind_small_cop: room.blind_small_cop,
    blind_big_cop: room.blind_big_cop,
    card_mode: room.card_mode,
  });
}
