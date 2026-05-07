"use server";

import { evaluateShowdown } from "@poker-coins/game";
import { createAdminClient } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth-server";
import { drawCardCodes } from "@/lib/deck";

const PHASE_ORDER = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;
type Phase = (typeof PHASE_ORDER)[number];

const COMMUNITY_DRAW: Partial<Record<Phase, number>> = {
  FLOP: 3,
  TURN: 1,
  RIVER: 1,
};

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
    .select("id, dealer_user_id, card_mode")
    .eq("code", roomCode)
    .maybeSingle();
  if (!room) return { error: "Sala no encontrada." };
  // Cualquier cliente (dealer o jugador) puede dispararlo cuando expira el
  // countdown — la atomicidad la garantiza el WHERE de la query.

  const { data: hand } = await admin
    .from("hands")
    .select(
      "id, phase, dealer_seat_index, current_turn_seat_id, pot_cop, deck_id, community_cards",
    )
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

  // ─── Modo VIRTUAL ──────────────────────────────────────────────────
  if (room.card_mode === "VIRTUAL" && hand.deck_id) {
    const drawCount = COMMUNITY_DRAW[nextPhase];
    if (drawCount && drawCount > 0) {
      try {
        const newCards = await drawCardCodes(hand.deck_id, drawCount);
        const existing = (hand.community_cards as string[] | null) ?? [];
        await admin
          .from("hands")
          .update({ community_cards: [...existing, ...newCards] })
          .eq("id", hand.id);
      } catch (e) {
        // Si la API falla, log + continuar — la fase ya cambió y los
        // jugadores verán cartas vacías. No es ideal pero menos malo
        // que dejar la mano colgada.
        console.error("[advancePhase] draw cards failed:", e);
      }
    }

    if (nextPhase === "SHOWDOWN") {
      await resolveVirtualShowdown(admin, hand.id);
    }
  }

  return {};
}

// ─── Auto-resolución del showdown en modo VIRTUAL ───────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

async function resolveVirtualShowdown(admin: AdminClient, handId: string) {
  // Cargar estado final de la mano para evaluar
  const { data: hand } = await admin
    .from("hands")
    .select(
      "id, room_id, pot_cop, community_cards, ended_at, deck_id",
    )
    .eq("id", handId)
    .maybeSingle();
  if (!hand || hand.ended_at) return;

  const { data: parts } = await admin
    .from("hand_participants")
    .select("seat_id, status, hole_cards, total_bet_cop")
    .eq("hand_id", hand.id);

  const contenders = (parts ?? []).filter(
    (p) =>
      (p.status === "IN" || p.status === "ALL_IN") &&
      Array.isArray(p.hole_cards) &&
      (p.hole_cards as unknown[]).length === 2,
  );
  if (contenders.length === 0) return;

  // Si por algún motivo faltaran cartas comunitarias (ej. all-in
  // antes del river y no se llegó a repartir todo), las completamos
  // sacando las que falten. Texas Hold'em siempre necesita 5.
  let community = (hand.community_cards as string[] | null) ?? [];
  if (community.length < 5 && hand.deck_id) {
    try {
      const more = await drawCardCodes(hand.deck_id, 5 - community.length);
      community = [...community, ...more];
      await admin
        .from("hands")
        .update({ community_cards: community })
        .eq("id", hand.id);
    } catch (e) {
      console.error("[resolveShowdown] complete board failed:", e);
    }
  }

  // Si solo queda un contender (el resto foldeó), gana sin evaluar.
  // En cualquier otro caso necesitamos board de 5 cartas y 2 hole
  // cards por contender; si la API falló y el estado quedó incompleto,
  // abortamos en vez de pagar mal el pozo. La mano queda en SHOWDOWN
  // sin ended_at y el dealer puede resolver manualmente.
  let winnerSeatIds: string[];
  if (contenders.length === 1) {
    winnerSeatIds = [contenders[0]!.seat_id];
  } else {
    if (community.length !== 5) {
      console.error(
        `[resolveShowdown] board incompleto (${community.length}/5) — aborto auto-resolución`,
      );
      return;
    }
    const allHaveHoleCards = contenders.every(
      (c) =>
        Array.isArray(c.hole_cards) &&
        (c.hole_cards as unknown[]).length === 2,
    );
    if (!allHaveHoleCards) {
      console.error(
        "[resolveShowdown] algún contender sin hole cards — aborto auto-resolución",
      );
      return;
    }
    try {
      const result = evaluateShowdown(
        contenders.map((c) => ({
          seatId: c.seat_id,
          holeCards: c.hole_cards as string[],
        })),
        community,
      );
      winnerSeatIds = result.winnerSeatIds;
    } catch (e) {
      console.error("[resolveShowdown] evaluateShowdown lanzó:", e);
      return;
    }
  }

  if (winnerSeatIds.length === 0) return;

  const pot = hand.pot_cop;
  const share = Math.floor(pot / winnerSeatIds.length);
  const remainder = pot - share * winnerSeatIds.length;

  // Acreditar a cada ganador en seats + payouts + ledger. Si no parte
  // exacto, el primero de la lista se queda con el residuo.
  const seatsToCredit = winnerSeatIds.map((sid, i) => ({
    seat_id: sid,
    amount: share + (i === 0 ? remainder : 0),
  }));

  for (const w of seatsToCredit) {
    const { data: seat } = await admin
      .from("seats")
      .select("chips_balance_cop")
      .eq("id", w.seat_id)
      .maybeSingle();
    if (!seat) continue;
    await admin
      .from("seats")
      .update({ chips_balance_cop: seat.chips_balance_cop + w.amount })
      .eq("id", w.seat_id);
  }

  await admin.from("payouts").insert(
    seatsToCredit.map((w) => ({
      hand_id: hand.id,
      seat_id: w.seat_id,
      amount_cop: w.amount,
    })),
  );

  await admin.from("ledger_entries").insert(
    seatsToCredit.map((w) => ({
      seat_id: w.seat_id,
      delta_cop: w.amount,
      hand_id: hand.id,
      reason: "POT_WIN",
    })),
  );

  await admin
    .from("hands")
    .update({
      ended_at: new Date().toISOString(),
      pot_cop: 0,
      current_turn_seat_id: null,
      phase_ready_at: null,
      turn_started_at: null,
    })
    .eq("id", hand.id)
    .is("ended_at", null);
}
