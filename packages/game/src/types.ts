export type HandPhase =
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "COMPLETE";

export type ParticipantStatus = "IN" | "FOLDED" | "ALL_IN";

export type ActionType =
  | "SMALL_BLIND"
  | "BIG_BLIND"
  | "CHECK"
  | "CALL"
  | "RAISE"
  | "FOLD"
  | "ALL_IN";

export interface Participant {
  seatId: string;
  seatIndex: number;
  chipsBalanceCop: number;
  status: ParticipantStatus;
  currentBetCop: number;
  totalBetCop: number;
}

export interface HandState {
  handId: string;
  phase: HandPhase;
  potCop: number;
  blindSmallCop: number;
  blindBigCop: number;
  dealerSeatIndex: number;
  currentTurnSeatId: string | null;
  currentBetCop: number;
  lastRaiseCop: number;
  participants: Participant[];
}
