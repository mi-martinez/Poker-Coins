import type { ActionType, HandState, Participant } from "./types";

export interface ActionOption {
  type: ActionType;
  minAmountCop?: number;
  maxAmountCop?: number;
}

export function activeParticipants(state: HandState): Participant[] {
  return state.participants.filter((p) => p.status === "IN");
}

export function isBettingRoundClosed(state: HandState): boolean {
  const live = activeParticipants(state);
  if (live.length <= 1) return true;
  // All live participants must have matched the current bet.
  return live.every((p) => p.currentBetCop === state.currentBetCop);
}

export function legalActionsFor(
  state: HandState,
  seatId: string,
): ActionOption[] {
  const player = state.participants.find((p) => p.seatId === seatId);
  if (!player || player.status !== "IN") return [];

  const toCall = state.currentBetCop - player.currentBetCop;
  const options: ActionOption[] = [];

  options.push({ type: "FOLD" });

  if (toCall === 0) {
    options.push({ type: "CHECK" });
  } else if (player.chipsBalanceCop > 0) {
    options.push({
      type: "CALL",
      minAmountCop: Math.min(toCall, player.chipsBalanceCop),
      maxAmountCop: Math.min(toCall, player.chipsBalanceCop),
    });
  }

  // Min raise = current bet + last raise size (or big blind if no raise yet).
  const minRaiseIncrement = Math.max(state.lastRaiseCop, state.blindBigCop);
  const minRaiseTotal = state.currentBetCop + minRaiseIncrement;
  const maxRaiseTotal = player.currentBetCop + player.chipsBalanceCop;

  if (maxRaiseTotal > state.currentBetCop) {
    if (maxRaiseTotal >= minRaiseTotal) {
      options.push({
        type: "RAISE",
        minAmountCop: minRaiseTotal,
        maxAmountCop: maxRaiseTotal,
      });
    }
    options.push({ type: "ALL_IN", minAmountCop: maxRaiseTotal });
  }

  return options;
}
