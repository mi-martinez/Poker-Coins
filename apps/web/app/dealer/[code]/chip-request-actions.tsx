"use client";

import { useTransition } from "react";
import {
  approveChipRequestAction,
  rejectChipRequestAction,
} from "@/app/_actions/chips";

export function ChipRequestActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();

  function approve() {
    const fd = new FormData();
    fd.append("request_id", requestId);
    startTransition(async () => {
      await approveChipRequestAction(fd);
    });
  }
  function reject() {
    const fd = new FormData();
    fd.append("request_id", requestId);
    startTransition(async () => {
      await rejectChipRequestAction(fd);
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={approve}
        disabled={pending}
        className="rounded-md bg-felt px-3 py-1 text-sm font-semibold transition hover:bg-felt-light disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "..." : "Aprobar"}
      </button>
      <button
        type="button"
        onClick={reject}
        disabled={pending}
        className="rounded-md border border-zinc-700 px-3 py-1 text-sm transition hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Rechazar
      </button>
    </div>
  );
}
