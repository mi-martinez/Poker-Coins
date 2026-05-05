import { formatCop } from "@poker-coins/game";

export interface GameEvent {
  id: string;
  ts: string;
  kind:
    | "HAND_START"
    | "HAND_END"
    | "ACTION"
    | "CHIP_REQUEST"
    | "CHIP_RESOLVED"
    | "PAYOUT";
  actor?: string; // nickname
  label: string;
  amountCop?: number;
  detail?: string;
}

const ACTION_LABEL: Record<string, string> = {
  CHECK: "pasa",
  CALL: "iguala",
  RAISE: "sube",
  FOLD: "se retira",
  ALL_IN: "all-in",
  SMALL_BLIND: "small blind",
  BIG_BLIND: "big blind",
};

const KIND_TONE: Record<string, string> = {
  HAND_START: "border-amber-600/40 bg-amber-950/30 text-amber-200",
  HAND_END: "border-emerald-600/40 bg-emerald-950/30 text-emerald-200",
  ACTION: "border-white/10 bg-black/30 text-zinc-300",
  CHIP_REQUEST: "border-amber-700/40 bg-amber-950/20 text-amber-300",
  CHIP_RESOLVED: "border-emerald-700/40 bg-emerald-950/20 text-emerald-300",
  PAYOUT: "border-amber-500/60 bg-amber-900/30 text-amber-200",
};

const dt = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function EventHistory({ events }: { events: GameEvent[] }) {
  return (
    <details className="felt-card rounded-xl p-4">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-widest text-zinc-300/80">
        Historial · {events.length} eventos
      </summary>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Sin eventos aún.</p>
      ) : (
        <ul className="mt-3 max-h-96 overflow-y-auto pr-1">
          {events.map((e) => {
            const tone =
              KIND_TONE[e.kind] ?? "border-white/10 bg-black/30 text-zinc-300";
            return (
              <li
                key={e.id}
                className={`mb-1.5 flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-xs ${tone}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <time className="font-mono tabular-nums text-zinc-500">
                    {dt.format(new Date(e.ts))}
                  </time>
                  <span className="truncate">
                    {e.actor && (
                      <span className="font-semibold">{e.actor}</span>
                    )}
                    {e.actor && " "}
                    {e.label}
                    {e.detail && (
                      <span className="ml-1 text-zinc-500">{e.detail}</span>
                    )}
                  </span>
                </div>
                {e.amountCop !== undefined && (
                  <span className="font-semibold tabular-nums">
                    {formatCop(e.amountCop)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

// Helper que el dealer page usa para construir el array de eventos a
// partir de queries de actions, chip_requests, hands, payouts.
export interface BuildEventsInput {
  hands: {
    id: string;
    hand_number: number;
    started_at: string;
    ended_at: string | null;
  }[];
  actions: {
    id: string;
    hand_id: string;
    seat_id: string;
    type: string;
    amount_cop: number;
    created_at: string;
  }[];
  chipRequests: {
    id: string;
    user_id: string;
    amount_cop: number;
    status: string;
    requested_at: string;
    resolved_at: string | null;
  }[];
  payouts: {
    id: string;
    hand_id: string;
    seat_id: string;
    amount_cop: number;
    created_at: string;
  }[];
  nicknameBySeatId: Map<string, string>;
  nicknameByUserId: Map<string, string>;
}

export function buildEvents(input: BuildEventsInput): GameEvent[] {
  const events: GameEvent[] = [];
  const handNumberById = new Map(
    input.hands.map((h) => [h.id, h.hand_number]),
  );

  for (const h of input.hands) {
    events.push({
      id: `hand-start-${h.id}`,
      ts: h.started_at,
      kind: "HAND_START",
      label: `Mano #${h.hand_number} iniciada`,
    });
    if (h.ended_at) {
      events.push({
        id: `hand-end-${h.id}`,
        ts: h.ended_at,
        kind: "HAND_END",
        label: `Mano #${h.hand_number} cerrada`,
      });
    }
  }

  for (const a of input.actions) {
    const handNum = handNumberById.get(a.hand_id);
    events.push({
      id: `act-${a.id}`,
      ts: a.created_at,
      kind: "ACTION",
      actor: input.nicknameBySeatId.get(a.seat_id),
      label: ACTION_LABEL[a.type] ?? a.type,
      amountCop: a.amount_cop > 0 ? a.amount_cop : undefined,
      detail: handNum ? `· mano #${handNum}` : undefined,
    });
  }

  for (const cr of input.chipRequests) {
    events.push({
      id: `cr-req-${cr.id}`,
      ts: cr.requested_at,
      kind: "CHIP_REQUEST",
      actor: input.nicknameByUserId.get(cr.user_id),
      label: "pidió fichas",
      amountCop: cr.amount_cop,
    });
    if (cr.resolved_at && cr.status !== "PENDING") {
      events.push({
        id: `cr-res-${cr.id}`,
        ts: cr.resolved_at,
        kind: "CHIP_RESOLVED",
        actor: input.nicknameByUserId.get(cr.user_id),
        label:
          cr.status === "APPROVED"
            ? "solicitud aprobada"
            : "solicitud rechazada",
        amountCop: cr.amount_cop,
      });
    }
  }

  for (const p of input.payouts) {
    const handNum = handNumberById.get(p.hand_id);
    events.push({
      id: `payout-${p.id}`,
      ts: p.created_at,
      kind: "PAYOUT",
      actor: input.nicknameBySeatId.get(p.seat_id),
      label: "ganó el pozo",
      amountCop: p.amount_cop,
      detail: handNum ? `· mano #${handNum}` : undefined,
    });
  }

  // Más recientes arriba
  events.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return events;
}
