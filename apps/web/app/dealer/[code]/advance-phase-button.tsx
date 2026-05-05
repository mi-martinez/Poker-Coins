"use client";

import { useActionState } from "react";
import {
  advancePhaseAction,
  type AdvancePhaseState,
} from "@/app/_actions/phases";

const initial: AdvancePhaseState = {};

const NEXT_PHASE_LABEL: Record<string, string> = {
  PREFLOP: "Repartir flop",
  FLOP: "Repartir turn",
  TURN: "Repartir river",
  RIVER: "Ir a showdown",
};

export function AdvancePhaseButton({
  roomCode,
  currentPhase,
  highlight,
}: {
  roomCode: string;
  currentPhase: string;
  highlight?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    advancePhaseAction,
    initial,
  );
  const label = NEXT_PHASE_LABEL[currentPhase];
  if (!label) return null;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="room_code" value={roomCode} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg py-3 font-semibold transition disabled:opacity-60 ${
          highlight
            ? "felt-pulse bg-amber-600 text-zinc-950 hover:scale-[1.02] hover:bg-amber-500"
            : "border border-felt-light/40 bg-felt-dark/40 hover:bg-felt-dark/70"
        }`}
      >
        {pending ? "Repartiendo..." : label}
      </button>
      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
