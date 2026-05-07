import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatCop } from "@poker-coins/game";
import { getCurrentUser } from "@/lib/auth-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { RealtimeRefresher } from "@/app/_components/realtime-refresher";
import { AnimateIn } from "@/app/_components/animate";
import { startTournamentAction } from "@/app/_actions/tournament";
import { ChipRequestActions } from "./chip-request-actions";
import { CopySeatCode } from "./copy-seat-code";
import { CloseRoomButton } from "../close-room-button";
import { ClosedSummary } from "./closed-summary";
import { StartHandButton } from "./start-hand-button";
import { AdvancePhaseButton } from "./advance-phase-button";
import { CommunityCards } from "@/app/_components/community-cards";
import { DealOverlay } from "@/app/_components/deal-overlay";
import { WinCelebration } from "@/app/_components/win-celebration";
import { WinAnnouncement } from "@/app/_components/win-announcement";
import { GameSounds } from "@/app/_components/game-sounds";
import { WinnerPicker } from "./winner-picker";
import { DealerSeatControls } from "./dealer-seat-controls";
import { PlayerMiniView, type PlayerMiniViewData } from "./player-mini-view";
import { EventHistory, buildEvents } from "./event-history";
import { Accounting } from "./accounting";

export default async function DealerRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/dealer/${code}`);

  const admin = createAdminClient();

  const { data: room } = await admin
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) notFound();
  if (room.dealer_user_id !== user.id) {
    redirect(`/play/${code}` as never);
  }

  const [
    { data: seats },
    { data: pendingRequests },
    { data: activeHand },
    { data: lastEndedHand },
    { data: allHands },
    { data: allChipRequests },
  ] = await Promise.all([
    admin
      .from("seats")
      .select("id, seat_index, seat_code, status, chips_balance_cop, user_id")
      .eq("room_id", room.id)
      .order("seat_index"),
    admin
      .from("chip_requests")
      .select("id, amount_cop, requested_at, user_id")
      .eq("room_id", room.id)
      .eq("status", "PENDING")
      .order("requested_at"),
    admin
      .from("hands")
      .select(
        "id, hand_number, dealer_seat_index, phase, pot_cop, current_turn_seat_id, phase_ready_at, started_at, community_cards",
      )
      .eq("room_id", room.id)
      .is("ended_at", null)
      .maybeSingle(),
    admin
      .from("hands")
      .select("id, ended_at")
      .eq("room_id", room.id)
      .not("ended_at", "is", null)
      .order("ended_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Para el historial: últimas N manos del room
    admin
      .from("hands")
      .select("id, hand_number, started_at, ended_at")
      .eq("room_id", room.id)
      .order("started_at", { ascending: false })
      .limit(20),
    // Para el historial: todas las solicitudes de fichas (resueltas + pending)
    admin
      .from("chip_requests")
      .select(
        "id, user_id, amount_cop, status, requested_at, resolved_at",
      )
      .eq("room_id", room.id)
      .order("requested_at", { ascending: false })
      .limit(40),
  ]);

  const userIds = Array.from(
    new Set([
      ...(seats ?? []).flatMap((s) => (s.user_id ? [s.user_id] : [])),
      ...(pendingRequests ?? []).map((r) => r.user_id),
    ]),
  );

  const handIdsAll = (allHands ?? []).map((h) => h.id);
  const seatIdsAll = (seats ?? []).map((s) => s.id);

  // Round-trip 2: data dependiente de IDs anteriores en paralelo
  const [
    { data: handParticipants },
    { data: users },
    { data: lastPayouts },
    { data: lastAction },
    { data: historyActions },
    { data: historyPayouts },
    { data: ledgerEntries },
  ] = await Promise.all([
    activeHand
      ? admin
          .from("hand_participants")
          .select("id, seat_id, status, current_bet_cop, total_bet_cop")
          .eq("hand_id", activeHand.id)
      : Promise.resolve({ data: null }),
    userIds.length
      ? admin
          .from("users")
          .select("id, nickname, avatar_url")
          .in("id", userIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            nickname: string;
            avatar_url: string | null;
          }[],
        }),
    lastEndedHand
      ? admin
          .from("payouts")
          .select("id, hand_id, seat_id, amount_cop")
          .eq("hand_id", lastEndedHand.id)
      : Promise.resolve({ data: null }),
    activeHand
      ? admin
          .from("actions")
          .select("id, type")
          .eq("hand_id", activeHand.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    handIdsAll.length
      ? admin
          .from("actions")
          .select("id, hand_id, seat_id, type, amount_cop, created_at")
          .in("hand_id", handIdsAll)
          .order("created_at", { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] }),
    handIdsAll.length
      ? admin
          .from("payouts")
          .select("id, hand_id, seat_id, amount_cop, created_at")
          .in("hand_id", handIdsAll)
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] }),
    seatIdsAll.length
      ? admin
          .from("ledger_entries")
          .select("seat_id, delta_cop, created_at")
          .in("seat_id", seatIdsAll)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const nicknameById = new Map((users ?? []).map((u) => [u.id, u.nickname]));
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  // Para historial: nickname por seat (vía user_id)
  const nicknameBySeatId = new Map<string, string>();
  for (const s of seats ?? []) {
    if (s.user_id) {
      const nick = nicknameById.get(s.user_id) ?? "?";
      nicknameBySeatId.set(s.id, nick);
    }
  }

  const events = buildEvents({
    hands: allHands ?? [],
    actions: historyActions ?? [],
    chipRequests: allChipRequests ?? [],
    payouts: historyPayouts ?? [],
    nicknameBySeatId,
    nicknameByUserId: nicknameById,
  });

  // Indicador del botón del dealer (la posición en la mesa que tiene D)
  const dealerButtonSeat = activeHand
    ? (seats ?? []).find(
        (s) => s.seat_index === activeHand.dealer_seat_index,
      )
    : null;
  const dealerButtonNickname = dealerButtonSeat?.user_id
    ? nicknameById.get(dealerButtonSeat.user_id)
    : null;

  const winners =
    lastEndedHand && lastPayouts && lastPayouts.length > 0
      ? lastPayouts.map((p) => {
          const seat = (seats ?? []).find((s) => s.id === p.seat_id);
          const u = seat?.user_id ? userById.get(seat.user_id) : null;
          return {
            handId: lastEndedHand.id,
            nickname: u?.nickname ?? "?",
            amount: p.amount_cop,
            isMe: false, // dealer no juega
            avatarUrl: u?.avatar_url ?? null,
          };
        })
      : null;

  const occupied = (seats ?? []).filter((s) => s.user_id);
  const empty = (seats ?? []).filter((s) => !s.user_id);

  const isTournament = room.game_type === "TOURNAMENT";
  const canStart = isTournament && room.status === "LOBBY" && occupied.length >= 2;
  const playableSeats = occupied.filter(
    (s) => (s.chips_balance_cop ?? 0) > 0,
  );
  const canStartHand =
    room.status === "ACTIVE" && !activeHand && playableSeats.length >= 2;
  const participantBySeat = new Map(
    (handParticipants ?? []).map((p) => [p.seat_id, p]),
  );
  const turnSeatId = activeHand?.current_turn_seat_id ?? null;

  // Sobrevivientes (IN o ALL_IN). Los ALL_IN siguen en la mano hasta
  // showdown aunque no puedan apostar más.
  const liveParticipants = (handParticipants ?? []).filter(
    (p) => p.status === "IN" || p.status === "ALL_IN",
  );
  const roundClosed =
    !!activeHand && !turnSeatId && liveParticipants.length > 1;
  const showdownReached = activeHand?.phase === "SHOWDOWN";

  if (room.status === "CLOSED") {
    return (
      <ClosedSummary
        room={room}
        seats={seats ?? []}
        nicknameById={nicknameById}
        perspective="dealer"
      />
    );
  }

  return (
    <main className="min-h-screen p-6">
      <RealtimeRefresher roomId={room.id} />
      {activeHand && (
        <DealOverlay
          roomCode={room.code}
          phase={activeHand.phase}
          phaseReadyAt={activeHand.phase_ready_at ?? null}
          isDealer
          cardMode={room.card_mode}
        />
      )}
      <WinCelebration winners={winners} />
      <WinAnnouncement winners={winners} perspectiveIsWinner={false} />
      <GameSounds
        lastActionId={lastAction?.id ?? null}
        lastActionType={lastAction?.type ?? null}
        phase={activeHand?.phase ?? null}
        isMyTurn={false}
        endedHandId={lastEndedHand?.id ?? null}
      />
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <AnimateIn preset="fadeUp">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold drop-shadow">
              {room.name ?? "Sala"}
            </h1>
            <p className="text-xs text-zinc-300/70">
              Código{" "}
              <span className="font-mono tracking-widest text-zinc-200">
                {room.code}
              </span>
            </p>
            <p className="mt-1 text-sm text-zinc-300/80">
              {isTournament ? "Torneo" : "Mesa libre"} · Blinds{" "}
              {formatCop(room.blind_small_cop)} / {formatCop(room.blind_big_cop)} ·{" "}
              <span className="font-mono">{room.status}</span>
            </p>
            {isTournament ? (
              <p className="text-xs text-zinc-500">
                Buy-in {formatCop(room.tournament_cost_cop ?? 0)}
                {room.rebuy_enabled
                  ? ` · Recompra ${formatCop(room.rebuy_cost_cop ?? 0)} (máx ${room.max_rebuys})`
                  : " · Sin recompra"}
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                Buy-in mínimo {formatCop(room.min_buy_in_cop ?? 0)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dealer"
              className="text-sm text-zinc-300/70 hover:text-zinc-100"
            >
              ← Mis salas
            </Link>
            <CloseRoomButton roomCode={room.code} />
          </div>
        </header>
        </AnimateIn>

        {canStart && (
          <AnimateIn preset="scaleIn" delay={0.05}>
            <form action={startTournamentAction}>
              <input type="hidden" name="room_code" value={room.code} />
              <button
                type="submit"
                className="felt-pulse w-full rounded-lg bg-amber-600 py-3 font-semibold text-zinc-950 transition hover:scale-[1.02] hover:bg-amber-500 active:scale-[0.98]"
              >
                Iniciar torneo ({occupied.length} jugadores)
              </button>
            </form>
          </AnimateIn>
        )}
        {isTournament && room.status === "LOBBY" && occupied.length < 2 && (
          <AnimateIn preset="fadeUp" delay={0.05}>
            <p className="rounded-md border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">
              Esperando a que entren al menos 2 jugadores antes de poder iniciar el torneo.
            </p>
          </AnimateIn>
        )}

        {canStartHand && (
          <AnimateIn preset="scaleIn" delay={0.05}>
            <StartHandButton roomCode={room.code} />
          </AnimateIn>
        )}

        {dealerButtonNickname && dealerButtonSeat && (
          <AnimateIn preset="fadeUp" delay={0.05}>
            <div className="flex items-center justify-center gap-3 rounded-full border border-zinc-200/40 bg-zinc-100/10 px-4 py-2 backdrop-blur">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-900 shadow">
                D
              </span>
              <span className="text-xs uppercase tracking-widest text-zinc-300/80">
                Botón del dealer
              </span>
              <span className="text-sm font-semibold">
                #{dealerButtonSeat.seat_index} · {dealerButtonNickname}
              </span>
            </div>
          </AnimateIn>
        )}

        {activeHand && (
          <AnimateIn preset="scaleIn" delay={0.05}>
            <section className="felt-card rounded-2xl p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-300/70">
                    Mano #{activeHand.hand_number} · {activeHand.phase}
                  </p>
                  <p className="text-3xl font-bold tabular-nums drop-shadow">
                    {formatCop(activeHand.pot_cop)}
                  </p>
                  <p className="text-xs text-zinc-300/70">Pozo en juego</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-xs uppercase tracking-widest text-zinc-300/70">
                    Turno
                  </p>
                  <p className="font-semibold">
                    {(() => {
                      if (!turnSeatId) return "—";
                      const turnSeat = (seats ?? []).find(
                        (s) => s.id === turnSeatId,
                      );
                      if (!turnSeat) return "—";
                      const nick = turnSeat.user_id
                        ? (nicknameById.get(turnSeat.user_id) ?? "?")
                        : "?";
                      return `#${turnSeat.seat_index} · ${nick}`;
                    })()}
                  </p>
                </div>
              </div>

              <div className="my-4">
                <CommunityCards
                  phase={activeHand.phase}
                  cards={
                    room.card_mode === "VIRTUAL"
                      ? ((activeHand.community_cards ?? []) as string[])
                      : null
                  }
                />
              </div>

              {roundClosed && !showdownReached && !activeHand.phase_ready_at && (
                <div className="mb-3 rounded-md border border-amber-700/40 bg-amber-950/30 p-3">
                  <p className="text-center text-xs uppercase tracking-widest text-amber-300">
                    Ronda completa · listo para repartir
                  </p>
                  <div className="mt-2">
                    <AdvancePhaseButton
                      roomCode={room.code}
                      currentPhase={activeHand.phase}
                      highlight
                    />
                  </div>
                </div>
              )}

              {showdownReached && room.card_mode === "VIRTUAL" && (
                <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-center">
                  <p className="text-xs uppercase tracking-widest text-emerald-300">
                    Showdown · resolviendo automáticamente
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-300/70">
                    El sistema evaluó la mejor mano y repartió el pozo.
                  </p>
                </div>
              )}

              {showdownReached && room.card_mode === "PHYSICAL" && (
                <div className="mb-3 rounded-lg border border-amber-500/50 bg-amber-950/30 p-3">
                  <WinnerPicker
                    roomCode={room.code}
                    potCop={activeHand.pot_cop}
                    candidates={(seats ?? [])
                      .filter((s) => {
                        const p = participantBySeat.get(s.id);
                        return (
                          p &&
                          (p.status === "IN" || p.status === "ALL_IN") &&
                          s.user_id
                        );
                      })
                      .map((s) => ({
                        seatId: s.id,
                        seatIndex: s.seat_index,
                        nickname: s.user_id
                          ? (nicknameById.get(s.user_id) ?? "?")
                          : "?",
                        status:
                          participantBySeat.get(s.id)?.status ?? "IN",
                      }))}
                  />
                </div>
              )}

              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {(seats ?? [])
                  .filter((s) => participantBySeat.has(s.id))
                  .map((seat) => {
                    const p = participantBySeat.get(seat.id)!;
                    const isTurn = seat.id === turnSeatId;
                    const isDealerBtn =
                      seat.seat_index === activeHand.dealer_seat_index;
                    return (
                      <li
                        key={seat.id}
                        className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                          isTurn
                            ? "border-amber-500/60 bg-amber-950/30"
                            : "border-white/5 bg-black/30"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 font-semibold">
                            #{seat.seat_index} ·{" "}
                            {seat.user_id
                              ? (nicknameById.get(seat.user_id) ?? "?")
                              : "?"}
                            {isDealerBtn && (
                              <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] font-bold text-zinc-900">
                                D
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {p.status} ·{" "}
                            <span className="text-amber-300">
                              {formatCop(p.current_bet_cop)}
                            </span>{" "}
                            apostado
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-sm tabular-nums">
                            {formatCop(seat.chips_balance_cop)}
                          </div>
                          <DealerSeatControls
                            roomCode={room.code}
                            seatId={seat.id}
                            canFold={p.status === "IN"}
                            isSittingOut={seat.status === "SITTING_OUT"}
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          </AnimateIn>
        )}

        <AnimateIn preset="fadeUp" delay={0.1}>
        <section className="felt-card rounded-xl p-4">
          <h2 className="mb-1 text-lg font-semibold">
            Vista de jugadores ({occupied.length}/{room.max_seats})
          </h2>
          <p className="mb-3 text-xs text-zinc-300/60">
            Lo que cada jugador ve en su pantalla en tiempo real.
          </p>
          {occupied.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no entra ningún jugador.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {occupied.map((seat) => {
                const u = seat.user_id ? userById.get(seat.user_id) : null;
                const p = participantBySeat.get(seat.id) ?? null;
                const pendingForSeat = (pendingRequests ?? []).find(
                  (r) => r.user_id === seat.user_id,
                );
                const data: PlayerMiniViewData = {
                  seat: {
                    id: seat.id,
                    seat_index: seat.seat_index,
                    user_id: seat.user_id,
                    chips_balance_cop: seat.chips_balance_cop,
                    status: seat.status,
                  },
                  user: {
                    nickname: u?.nickname ?? "?",
                    avatar_url: u?.avatar_url ?? null,
                  },
                  participant: p
                    ? {
                        status: p.status,
                        current_bet_cop: p.current_bet_cop,
                      }
                    : null,
                  room: {
                    status: room.status,
                    game_type: room.game_type,
                  },
                  activeHand: activeHand
                    ? {
                        current_turn_seat_id: activeHand.current_turn_seat_id,
                        phase: activeHand.phase,
                        phase_ready_at: activeHand.phase_ready_at,
                      }
                    : null,
                  pendingRequestAmount: pendingForSeat?.amount_cop ?? null,
                  isDealerButton:
                    !!activeHand &&
                    activeHand.dealer_seat_index === seat.seat_index,
                };
                return (
                  <PlayerMiniView
                    key={seat.id}
                    data={data}
                    roomCode={room.code}
                  />
                );
              })}
            </div>
          )}
        </section>
        </AnimateIn>

        <AnimateIn preset="fadeUp" delay={0.18}>
        <section className="felt-card rounded-xl p-4">
          <h2 className="mb-1 text-lg font-semibold">
            Códigos de posiciones libres ({empty.length})
          </h2>
          <p className="mb-3 text-xs text-zinc-300/70">
            Comparte uno por jugador. Cada código define el asiento (turno).
          </p>
          {empty.length === 0 ? (
            <p className="text-sm text-zinc-400">Todas las posiciones están tomadas.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-3">
              {empty.map((seat) => (
                <li
                  key={seat.id}
                  className="flex items-center justify-between rounded-md border border-white/5 bg-black/30 px-3 py-2 transition hover:bg-black/50"
                >
                  <div>
                    <div className="text-xs text-zinc-400">Asiento</div>
                    <div className="font-semibold">#{seat.seat_index}</div>
                  </div>
                  <CopySeatCode code={seat.seat_code ?? ""} />
                </li>
              ))}
            </ul>
          )}
        </section>
        </AnimateIn>

        <AnimateIn preset="fadeUp" delay={0.26}>
        <section className="felt-card rounded-xl p-4">
          <h2 className="mb-3 text-lg font-semibold">
            Solicitudes de fichas ({pendingRequests?.length ?? 0})
          </h2>
          {!pendingRequests || pendingRequests.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay solicitudes pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2"
                >
                  <div>
                    <div className="font-semibold">
                      {nicknameById.get(req.user_id) ?? "?"}
                    </div>
                    <div className="text-xs text-zinc-400">
                      pidió {formatCop(req.amount_cop)}
                    </div>
                  </div>
                  <ChipRequestActions requestId={req.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
        </AnimateIn>

        <AnimateIn preset="fadeUp" delay={0.32}>
          <Accounting
            seats={(seats ?? []).map((s) => ({
              id: s.id,
              seat_index: s.seat_index,
              user_id: s.user_id,
              chips_balance_cop: s.chips_balance_cop,
            }))}
            ledger={ledgerEntries ?? []}
            usersById={
              new Map((users ?? []).map((u) => [u.id, u]))
            }
          />
        </AnimateIn>

        <AnimateIn preset="fadeUp" delay={0.36}>
          <EventHistory events={events} />
        </AnimateIn>
      </div>
    </main>
  );
}
