"use client";

import { useActionState } from "react";
import { formatCop } from "@poker-coins/game";
import {
  requestChipsAction,
  type RequestChipsState,
} from "@/app/_actions/chips";

const initialState: RequestChipsState = {};

export function RequestChipsForm({
  roomCode,
  minBuyIn,
}: {
  roomCode: string;
  minBuyIn: number;
}) {
  const [state, formAction, pending] = useActionState(
    requestChipsAction,
    initialState,
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <h2 className="mb-3 text-sm uppercase tracking-widest text-zinc-400">
        Pedir fichas al dealer
      </h2>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="room_code" value={roomCode} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">
            Monto (mín {formatCop(minBuyIn)})
          </span>
          <input
            name="amount_cop"
            type="number"
            min={minBuyIn}
            step={500}
            defaultValue={minBuyIn}
            required
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>
        {state.error && (
          <p className="text-sm text-red-400" role="alert">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-felt py-2 text-sm font-semibold hover:bg-felt-light disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Solicitar fichas"}
        </button>
      </form>
    </section>
  );
}
