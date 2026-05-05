"use client";

import { useState, useTransition } from "react";
import { closeRoomAction } from "@/app/_actions/rooms";

export function CloseRoomButton({
  roomCode,
  variant = "compact",
}: {
  roomCode: string;
  variant?: "compact" | "full";
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      // auto-cancela el "are you sure" después de 4s sin confirmar
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    const fd = new FormData();
    fd.append("room_code", roomCode);
    startTransition(async () => {
      await closeRoomAction(fd);
      setConfirming(false);
    });
  }

  const base =
    "rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const sizing =
    variant === "full" ? "w-full px-4 py-2 text-sm" : "px-3 py-1 text-xs";
  const color = confirming
    ? "bg-red-600 text-white hover:bg-red-500"
    : "border border-zinc-600/60 bg-black/30 hover:bg-red-900/40 hover:border-red-600/60";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`${base} ${sizing} ${color}`}
    >
      {pending
        ? "Cerrando..."
        : confirming
          ? "¿Confirmar cierre?"
          : "Cerrar sala"}
    </button>
  );
}
