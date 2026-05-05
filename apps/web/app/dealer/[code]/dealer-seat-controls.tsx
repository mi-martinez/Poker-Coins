"use client";

import { useTransition } from "react";
import {
  dealerForceFoldAction,
  toggleSitOutAction,
} from "@/app/_actions/dealer-controls";

interface Props {
  roomCode: string;
  seatId: string;
  canFold: boolean; // hay mano activa y el participante está IN
  isSittingOut: boolean;
}

export function DealerSeatControls({
  roomCode,
  seatId,
  canFold,
  isSittingOut,
}: Props) {
  const [pending, startTransition] = useTransition();

  function fold() {
    if (!confirm("¿Foldear por este jugador?")) return;
    const fd = new FormData();
    fd.append("room_code", roomCode);
    fd.append("seat_id", seatId);
    startTransition(async () => {
      await dealerForceFoldAction(fd);
    });
  }

  function toggleSitOut() {
    const fd = new FormData();
    fd.append("room_code", roomCode);
    fd.append("seat_id", seatId);
    startTransition(async () => {
      await toggleSitOutAction(fd);
    });
  }

  return (
    <div className="flex gap-1">
      {canFold && (
        <button
          type="button"
          onClick={fold}
          disabled={pending}
          className="rounded-md border border-red-700/50 bg-red-950/20 px-2 py-1 text-[10px] font-semibold text-red-300 transition hover:bg-red-900/40 disabled:opacity-50"
          title="Foldear por el jugador"
        >
          Fold
        </button>
      )}
      <button
        type="button"
        onClick={toggleSitOut}
        disabled={pending}
        className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${
          isSittingOut
            ? "border-emerald-600/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40"
            : "border-zinc-600/60 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60"
        }`}
        title={
          isSittingOut
            ? "Volver a entrar en la próxima mano"
            : "Sentar fuera (no juega próxima mano)"
        }
      >
        {isSittingOut ? "Volver" : "Sentar fuera"}
      </button>
    </div>
  );
}
