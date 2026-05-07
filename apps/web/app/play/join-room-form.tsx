"use client";

import { useActionState } from "react";
import {
  joinSeatAction,
  type JoinSeatFormState,
} from "@/app/_actions/rooms";

const initialState: JoinSeatFormState = {};

export function JoinRoomForm({ defaultCode }: { defaultCode?: string }) {
  const [state, formAction, pending] = useActionState(
    joinSeatAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Código de sala o de posición</span>
        <input
          name="seat_code"
          required
          maxLength={6}
          defaultValue={defaultCode}
          placeholder="ABC123"
          autoComplete="off"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 uppercase tracking-widest"
        />
        <span className="text-xs text-zinc-500">
          En salas virtuales basta el código de la sala. En presenciales,
          el dealer reparte un código de posición por jugador.
        </span>
      </label>
      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-felt py-3 font-semibold hover:bg-felt-light disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Tomar mi posición"}
      </button>
    </form>
  );
}
