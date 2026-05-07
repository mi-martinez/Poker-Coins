import "server-only";

// Texas Hold'em betting round termination rules. Reusado por play.ts
// (acciones de jugador) y dealer-controls.ts (force-fold).
//
// Reglas:
//   * Si no quedan participantes IN: todos están ALL_IN, ronda cerrada.
//   * Si queda exactamente 1 IN:
//       - si su bet < max bet entre vivos (IN+ALL_IN): debe actuar
//         (responder a un ALL_IN pendiente).
//       - si igualó o supera el max: ronda cerrada.
//   * Si quedan ≥2 IN: cerrada cuando todos los IN igualaron el max
//     bet vivo Y todos los IN ya actuaron en esta fase.

export interface ParticipantState {
  seat_id: string;
  status: "IN" | "FOLDED" | "ALL_IN";
  current_bet_cop: number;
}

export interface SeatState {
  id: string;
  seat_index: number;
}

/**
 * Determina si la ronda de apuestas terminó. Se evalúa DESPUÉS de
 * aplicar la acción del actor.
 */
export function isBettingClosed(
  participants: ParticipantState[],
  seatsActedThisPhase: Set<string>,
): boolean {
  const live = participants.filter(
    (p) => p.status === "IN" || p.status === "ALL_IN",
  );
  const inOnly = participants.filter((p) => p.status === "IN");

  if (inOnly.length === 0) return true;

  const maxLiveBet = Math.max(...live.map((p) => p.current_bet_cop), 0);
  const allMatched = inOnly.every(
    (p) => p.current_bet_cop >= maxLiveBet,
  );
  if (!allMatched) return false;

  const allActed = inOnly.every((p) => seatsActedThisPhase.has(p.seat_id));
  return allActed;
}

/**
 * Devuelve el seat_id del siguiente actor IN, en orden cíclico desde
 * el dealer button. Funciona también cuando sólo queda 1 IN (lo
 * devuelve a él, para que pueda responder a un ALL_IN pendiente).
 * Si no hay IN, devuelve null.
 *
 * `fromSeatId` es el actor que acaba de actuar — buscamos el siguiente.
 */
export function nextActorSeatId(
  seats: SeatState[],
  participants: ParticipantState[],
  fromSeatId: string,
  dealerSeatIdx: number,
): string | null {
  const inSeats = seats.filter((s) => {
    const p = participants.find((pp) => pp.seat_id === s.id);
    return p && p.status === "IN";
  });
  if (inSeats.length === 0) return null;
  if (inSeats.length === 1) return inSeats[0]!.id;

  const ordered = [...inSeats].sort((a, b) => {
    const aDist = (a.seat_index - dealerSeatIdx + 1000) % 1000;
    const bDist = (b.seat_index - dealerSeatIdx + 1000) % 1000;
    return aDist - bDist;
  });
  const idx = ordered.findIndex((s) => s.id === fromSeatId);
  if (idx === -1) return ordered[0]!.id;
  return ordered[(idx + 1) % ordered.length]!.id;
}
