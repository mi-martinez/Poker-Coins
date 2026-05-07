// Wrapper sobre pokersolver. Recibe códigos de carta como los devuelve
// deckofcardsapi.com (ej. "AS", "KH", "0D" — la T se codifica como 0)
// y los normaliza al formato que espera pokersolver ("As", "Kh", "Td").

import { Hand, type SolverHand } from "./_pokersolver";

// Convierte un código de la API ("AS", "0H", "TC") al formato
// pokersolver ("As", "Th", "Tc"). Las decenas pueden venir como "0" o
// "T" según la API; ambas se mapean a "T".
export function normalizeCard(apiCode: string): string {
  if (!apiCode || apiCode.length < 2) return apiCode;
  let rank = apiCode[0]!.toUpperCase();
  const suit = apiCode[apiCode.length - 1]!.toLowerCase();
  if (rank === "0") rank = "T";
  return `${rank}${suit}`;
}

export interface EvaluatedHand {
  /** seat_id del participante */
  seatId: string;
  /** Mejor mano descrita en lenguaje natural ("Two Pair, Q's & J's") */
  description: string;
  /** Nombre técnico del rank ("Two Pair", "Flush", etc.) */
  name: string;
  /** Cartas usadas para la mejor mano (5 cartas en formato pokersolver) */
  cards: string[];
}

/**
 * Evalúa el showdown de Texas Hold'em.
 *
 * @param participants  Cada participante IN o ALL_IN con su seat_id +
 *                      hole_cards (2 strings tipo "AS", "0H").
 * @param communityCards 5 cartas comunitarias (board completo).
 * @returns lista de seat_ids ganadores (puede ser >1 si hay split) +
 *          la evaluación por participante (para mostrar en UI).
 */
export function evaluateShowdown(
  participants: { seatId: string; holeCards: string[] }[],
  communityCards: string[],
): {
  winnerSeatIds: string[];
  hands: EvaluatedHand[];
} {
  if (participants.length === 0) {
    return { winnerSeatIds: [], hands: [] };
  }

  const board = communityCards.map(normalizeCard);

  const solved: { participant: { seatId: string }; hand: SolverHand }[] =
    participants.map((p) => {
      const cards = [...p.holeCards.map(normalizeCard), ...board];
      return { participant: p, hand: Hand.solve(cards) };
    });

  const winnerHands = Hand.winners(solved.map((s) => s.hand));
  const winnerSeatIds = solved
    .filter((s) => winnerHands.includes(s.hand))
    .map((s) => s.participant.seatId);

  const hands: EvaluatedHand[] = solved.map(({ participant, hand }) => ({
    seatId: participant.seatId,
    description: hand.descr ?? hand.toString(),
    name: hand.name,
    cards: hand.cards.map((c) => String(c)),
  }));

  return { winnerSeatIds, hands };
}
