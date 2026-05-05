"use client";

import { useState, useTransition } from "react";
import { formatCop } from "@poker-coins/game";
import { closeHandAction } from "@/app/_actions/close-hand";

interface Candidate {
  seatId: string;
  seatIndex: number;
  nickname: string;
  status: string;
}

export function WinnerPicker({
  roomCode,
  potCop,
  candidates,
}: {
  roomCode: string;
  potCop: number;
  candidates: Candidate[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <div className="rounded-md border border-amber-700/40 bg-amber-950/30 p-3 text-center text-sm text-amber-200">
        No hay candidatos en juego.
      </div>
    );
  }

  function toggle(seatId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) next.delete(seatId);
      else next.add(seatId);
      return next;
    });
  }

  function confirm() {
    if (selected.size === 0) return;
    setError(null);
    const fd = new FormData();
    fd.append("room_code", roomCode);
    selected.forEach((id) => fd.append("winner_seat_id", id));
    startTransition(async () => {
      const result = await closeHandAction({}, fd);
      if (result?.error) setError(result.error);
    });
  }

  const sharePerWinner =
    selected.size > 0
      ? Math.floor(potCop / selected.size)
      : 0;
  const remainder = potCop - sharePerWinner * selected.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-amber-300">
          Declarar ganador(es) — selecciona uno o varios
        </p>
        <p className="text-sm font-semibold tabular-nums text-amber-200">
          Pozo {formatCop(potCop)}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {candidates.map((c) => {
          const checked = selected.has(c.seatId);
          return (
            <li key={c.seatId}>
              <button
                type="button"
                onClick={() => toggle(c.seatId)}
                disabled={pending}
                className={`w-full rounded-md border px-3 py-3 text-left transition disabled:opacity-60 ${
                  checked
                    ? "border-amber-500 bg-amber-600/30 ring-2 ring-amber-500"
                    : "border-white/10 bg-black/30 hover:bg-black/50"
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>
                    #{c.seatIndex} · {c.nickname}
                  </span>
                  {checked && (
                    <span className="text-xs uppercase tracking-widest text-amber-200">
                      ✓ ganador
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400">{c.status}</div>
              </button>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && (
        <div className="rounded-md border border-amber-600/40 bg-amber-950/20 p-3 text-xs text-amber-200">
          {selected.size === 1 ? (
            <>Recibe el pozo completo: {formatCop(potCop)}</>
          ) : (
            <>
              Reparto: {formatCop(sharePerWinner)} c/u · {selected.size} ganadores
              {remainder > 0 && (
                <> · residuo {formatCop(remainder)} al primero</>
              )}
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={confirm}
        disabled={pending || selected.size === 0}
        className="rounded-lg bg-amber-600 py-3 font-semibold text-zinc-950 transition hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending
          ? "Repartiendo..."
          : selected.size === 0
            ? "Selecciona al menos uno"
            : `Repartir entre ${selected.size} ganador${selected.size > 1 ? "es" : ""}`}
      </button>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
