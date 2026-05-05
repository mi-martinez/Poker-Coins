"use client";

import { useActionState } from "react";
import { startHandAction, type StartHandState } from "@/app/_actions/hands";

const initialState: StartHandState = {};

export function StartHandButton({ roomCode }: { roomCode: string }) {
  const [state, formAction, pending] = useActionState(
    startHandAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="room_code" value={roomCode} />
      <button
        type="submit"
        disabled={pending}
        className="felt-pulse w-full rounded-lg bg-amber-600 py-3 font-semibold text-zinc-950 transition hover:scale-[1.02] hover:bg-amber-500 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Iniciando..." : "Iniciar mano"}
      </button>
      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
