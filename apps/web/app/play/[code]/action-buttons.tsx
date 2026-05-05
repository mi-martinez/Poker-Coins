"use client";

import { useActionState, useRef, useState } from "react";
import { formatCop } from "@poker-coins/game";
import { playerAction, type PlayerActionState } from "@/app/_actions/play";

const initial: PlayerActionState = {};

interface Props {
  roomCode: string;
  toCallCop: number;
  myChipsCop: number;
  currentBetCop: number;
  bigBlindCop: number;
  myCurrentBetCop: number;
  potCop: number;
}

// Redondea hacia abajo al múltiplo de 500 más cercano (igual que las
// denominaciones de fichas).
function quantize(n: number): number {
  return Math.max(500, Math.floor(n / 500) * 500);
}

export function ActionButtons({
  roomCode,
  toCallCop,
  myChipsCop,
  currentBetCop,
  bigBlindCop,
  myCurrentBetCop,
  potCop,
}: Props) {
  const [state, formAction, pending] = useActionState(playerAction, initial);
  const [showCustom, setShowCustom] = useState(false);
  const raiseInputRef = useRef<HTMLInputElement>(null);

  const minRaise = currentBetCop + bigBlindCop;
  const maxRaise = myCurrentBetCop + myChipsCop;
  const canCheck = toCallCop === 0;
  const canCall = toCallCop > 0 && myChipsCop > 0;
  const canRaise = maxRaise >= minRaise;

  // Quick raise: cada chip pre-calcula a cuánto subir (total de mi apuesta
  // tras subir, no incremento). Filtra los que no calzan en [min, max].
  const base = Math.max(currentBetCop, bigBlindCop);
  const candidates = canRaise
    ? [
        { label: "2×", amount: quantize(base * 2) },
        { label: "3×", amount: quantize(base * 3) },
        { label: "Pot", amount: quantize(potCop + toCallCop) },
      ]
        .filter((q) => q.amount >= minRaise && q.amount <= maxRaise)
        // Dedup por amount (si 2× == 3× post quantize, etc.)
        .filter(
          (q, i, arr) => arr.findIndex((x) => x.amount === q.amount) === i,
        )
    : [];

  function setRaise(amount: number) {
    if (raiseInputRef.current) {
      raiseInputRef.current.value = String(amount);
    }
  }

  return (
    <section className="felt-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-amber-300">
        <span>Tu turno</span>
        {toCallCop > 0 && (
          <span className="text-zinc-300/80">
            Para igualar: {formatCop(toCallCop)}
          </span>
        )}
      </div>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="room_code" value={roomCode} />
        {/* Hidden input que recibe el monto de raise; los chips lo setean
            via DOM antes de submit. */}
        <input
          ref={raiseInputRef}
          type="hidden"
          name="raise_amount"
          defaultValue={canRaise ? minRaise : 0}
        />

        {/* Fila 1: acciones obvias */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="submit"
            name="action"
            value="FOLD"
            disabled={pending}
            className="rounded-lg border border-red-700/60 bg-red-950/30 py-3 font-semibold transition hover:bg-red-900/50 disabled:opacity-60"
          >
            Fold
          </button>
          {canCheck ? (
            <button
              type="submit"
              name="action"
              value="CHECK"
              disabled={pending}
              className="rounded-lg bg-felt py-3 font-semibold transition hover:bg-felt-light disabled:opacity-60"
            >
              Check
            </button>
          ) : (
            <button
              type="submit"
              name="action"
              value="CALL"
              disabled={pending || !canCall}
              className="rounded-lg bg-felt py-3 font-semibold transition hover:bg-felt-light disabled:opacity-60"
            >
              Call {formatCop(Math.min(toCallCop, myChipsCop))}
            </button>
          )}
        </div>

        {/* Fila 2: acciones rápidas de raise + all-in */}
        {(candidates.length > 0 || myChipsCop > 0) && (
          <div className="grid grid-flow-col auto-cols-fr gap-2">
            {candidates.map((q) => (
              <button
                key={q.label}
                type="submit"
                name="action"
                value="RAISE"
                onClick={() => setRaise(q.amount)}
                disabled={pending}
                className="rounded-lg border border-amber-600/60 bg-amber-950/30 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-900/40 disabled:opacity-60"
                title={`Subir a ${formatCop(q.amount)}`}
              >
                <div className="text-base font-bold">{q.label}</div>
                <div className="text-[10px] tabular-nums opacity-80">
                  {formatCop(q.amount)}
                </div>
              </button>
            ))}
            {myChipsCop > 0 && (
              <button
                type="submit"
                name="action"
                value="ALL_IN"
                disabled={pending}
                className="rounded-lg border border-amber-500 bg-amber-600 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-500 disabled:opacity-60"
                title={`All-in ${formatCop(myChipsCop)}`}
              >
                <div className="text-base font-bold">All-in</div>
                <div className="text-[10px] tabular-nums opacity-80">
                  {formatCop(myChipsCop)}
                </div>
              </button>
            )}
          </div>
        )}

        {/* Custom raise (collapsible) */}
        {canRaise && (
          <button
            type="button"
            onClick={() => setShowCustom((v) => !v)}
            className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            {showCustom ? "Ocultar" : "Otra cantidad"}
          </button>
        )}

        {showCustom && canRaise && (
          <div className="flex items-end gap-2 rounded-md border border-amber-700/30 bg-amber-950/20 p-3">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="uppercase tracking-widest text-amber-200">
                Subir a (total)
              </span>
              <input
                name="raise_amount_visible"
                type="number"
                min={minRaise}
                max={maxRaise}
                step={500}
                defaultValue={minRaise}
                onChange={(e) => setRaise(Number(e.target.value) || 0)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 tabular-nums"
              />
              <span className="text-[10px] text-zinc-400">
                Mín {formatCop(minRaise)} · Máx {formatCop(maxRaise)}
              </span>
            </label>
            <button
              type="submit"
              name="action"
              value="RAISE"
              disabled={pending}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-500 disabled:opacity-60"
            >
              Subir
            </button>
          </div>
        )}

        {state.error && (
          <p className="mt-1 text-sm text-red-400" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}
