import type { HandPhase } from "./types";

const ORDER: readonly HandPhase[] = [
  "PREFLOP",
  "FLOP",
  "TURN",
  "RIVER",
  "SHOWDOWN",
  "COMPLETE",
];

export function nextPhase(phase: HandPhase): HandPhase | null {
  const idx = ORDER.indexOf(phase);
  if (idx === -1 || idx === ORDER.length - 1) return null;
  return ORDER[idx + 1] ?? null;
}

export function isBettingPhase(phase: HandPhase): boolean {
  return (
    phase === "PREFLOP" ||
    phase === "FLOP" ||
    phase === "TURN" ||
    phase === "RIVER"
  );
}
