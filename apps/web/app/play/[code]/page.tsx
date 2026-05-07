import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatCop } from "@poker-coins/game";
import { getCurrentUser } from "@/lib/auth-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { RealtimeRefresher } from "@/app/_components/realtime-refresher";
import { AnimateIn } from "@/app/_components/animate";
import { RequestChipsForm } from "./request-chips-form";
import { ClosedSummary } from "@/app/dealer/[code]/closed-summary";
import { WelcomeOverlay } from "./welcome-overlay";
import { ActionButtons } from "./action-buttons";
import { DealOverlay } from "@/app/_components/deal-overlay";
import { PokerTable } from "./poker-table";
import { WaitingWinnerOverlay } from "@/app/_components/waiting-winner-overlay";
import { WaitingTurnOverlay } from "@/app/_components/waiting-turn-overlay";
import { WinCelebration } from "@/app/_components/win-celebration";
import { WinAnnouncement } from "@/app/_components/win-announcement";
import { GameSounds } from "@/app/_components/game-sounds";
import { MyHoleCardsInline } from "@/app/_components/my-hole-cards-inline";

export default async function PlayRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/play/${code}`);

  const admin = createAdminClient();

  const { data: room } = await admin
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) notFound();
  if (room.dealer_user_id === user.id) {
    redirect(`/dealer/${code}` as never);
  }

  // Round-trip 1: todos los datos que solo dependen de room.id en paralelo
  const [
    { data: seats },
    { data: myPendingRequest },
    { data: activeHand },
    { data: lastEndedHand },
  ] = await Promise.all([
    admin
      .from("seats")
      .select("id, seat_index, status, chips_balance_cop, user_id")
      .eq("room_id", room.id)
      .order("seat_index"),
    admin
      .from("chip_requests")
      .select("id, amount_cop, requested_at")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("hands")
      .select(
        "id, hand_number, dealer_seat_index, phase, pot_cop, current_turn_seat_id, phase_ready_at, turn_started_at, community_cards",
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
  ]);

  const mySeat = (seats ?? []).find((s) => s.user_id === user.id) ?? null;
  if (!mySeat) {
    redirect("/play");
  }

  // Round-trip 2: users + hand_participants + last action + payouts del último cierre
  const userIds = (seats ?? [])
    .map((s) => s.user_id)
    .filter((id): id is string => Boolean(id));
  const [
    { data: users },
    { data: handParticipants },
    { data: lastAction },
    { data: lastPayouts },
  ] = await Promise.all([
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
      activeHand
        ? admin
            .from("hand_participants")
            .select(
              "id, seat_id, status, current_bet_cop, total_bet_cop, hole_cards",
            )
            .eq("hand_id", activeHand.id)
        : Promise.resolve({ data: null }),
      activeHand
        ? admin
            .from("actions")
            .select("id, type, amount_cop, seat_id, created_at")
            .eq("hand_id", activeHand.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      lastEndedHand
        ? admin
            .from("payouts")
            .select("id, hand_id, seat_id, amount_cop")
            .eq("hand_id", lastEndedHand.id)
        : Promise.resolve({ data: null }),
    ]);
  const usersById = new Map((users ?? []).map((u) => [u.id, u]));

  const isTournament = room.game_type === "TOURNAMENT";
  const tournamentLobby = isTournament && room.status === "LOBBY";
  const occupiedCount = (seats ?? []).filter((s) => s.user_id).length;

  if (room.status === "CLOSED") {
    return (
      <ClosedSummary
        room={room}
        seats={seats ?? []}
        nicknameById={
          new Map(
            [...usersById.values()].map((u) => [u.id, u.nickname]),
          )
        }
        perspective="player"
      />
    );
  }

  const participantBySeat = new Map(
    (handParticipants ?? []).map((p) => [p.seat_id, p]),
  );
  const myParticipant = participantBySeat.get(mySeat.id) ?? null;
  const isMyTurn = activeHand?.current_turn_seat_id === mySeat.id;
  const currentBet = (handParticipants ?? []).reduce(
    (max, p) => Math.max(max, p.current_bet_cop),
    0,
  );
  const myCurrentBet = myParticipant?.current_bet_cop ?? 0;
  const toCall = currentBet - myCurrentBet;

  // Datos para la PokerTable simulada (incluye al usuario)
  const tableSeats = (seats ?? [])
    .filter((s) => s.user_id)
    .map((s) => {
      const u = s.user_id ? usersById.get(s.user_id) : null;
      const p = participantBySeat.get(s.id);
      return {
        id: s.id,
        seatIndex: s.seat_index,
        userId: s.user_id,
        nickname: u?.nickname ?? "?",
        avatarUrl: u?.avatar_url ?? null,
        chipsBalance: s.chips_balance_cop,
        currentBet: p?.current_bet_cop ?? 0,
        status: (p?.status ?? s.status) as
          | "IN"
          | "FOLDED"
          | "ALL_IN"
          | "WAITING"
          | "ACTIVE"
          | "SITTING_OUT"
          | "LEFT",
        isMyTurn: activeHand?.current_turn_seat_id === s.id,
        isMe: s.user_id === user.id,
        isDealerButton:
          !!activeHand && activeHand.dealer_seat_index === s.seat_index,
      };
    });

  // Info del seat con el turno actual (para el overlay)
  const turnSeat =
    activeHand?.current_turn_seat_id
      ? (seats ?? []).find((s) => s.id === activeHand.current_turn_seat_id)
      : null;
  const turnUser = turnSeat?.user_id ? usersById.get(turnSeat.user_id) : null;
  const showWaitingTurn =
    !!activeHand &&
    !isMyTurn &&
    myParticipant?.status === "IN" &&
    !!turnSeat &&
    !activeHand.phase_ready_at &&
    activeHand.phase !== "SHOWDOWN";

  // Info de la última acción para el banner del overlay
  const lastActionInfo = (() => {
    if (!lastAction) return null;
    const seat = (seats ?? []).find((s) => s.id === lastAction.seat_id);
    const u = seat?.user_id ? usersById.get(seat.user_id) : null;
    return {
      id: lastAction.id,
      nickname: u?.nickname ?? "?",
      type: lastAction.type,
      amountCop: lastAction.amount_cop,
    };
  })();

  // Ganadores del último cierre (para WinCelebration / WinAnnouncement)
  const winners =
    lastEndedHand && lastPayouts && lastPayouts.length > 0
      ? lastPayouts.map((p) => {
          const seat = (seats ?? []).find((s) => s.id === p.seat_id);
          const u = seat?.user_id ? usersById.get(seat.user_id) : null;
          return {
            handId: lastEndedHand.id,
            nickname: u?.nickname ?? "?",
            amount: p.amount_cop,
            isMe: seat?.user_id === user.id,
            avatarUrl: u?.avatar_url ?? null,
          };
        })
      : null;
  const iAmAWinner = winners?.some((w) => w.isMe) ?? false;

  return (
    <main className="min-h-screen p-6">
      <RealtimeRefresher roomId={room.id} />
      <WelcomeOverlay handId={activeHand?.id ?? null} />
      {activeHand && (
        <DealOverlay
          roomCode={room.code}
          phase={activeHand.phase}
          phaseReadyAt={activeHand.phase_ready_at ?? null}
          isDealer={false}
          myHoleCards={
            room.card_mode === "VIRTUAL" &&
            Array.isArray(myParticipant?.hole_cards)
              ? (myParticipant!.hole_cards as string[])
              : null
          }
        />
      )}
      <WaitingWinnerOverlay
        visible={
          !!activeHand &&
          activeHand.phase === "SHOWDOWN" &&
          room.card_mode === "PHYSICAL" &&
          (handParticipants ?? []).filter(
            (p) => p.status === "IN" || p.status === "ALL_IN",
          ).length > 1
        }
      />
      <WaitingTurnOverlay
        visible={showWaitingTurn}
        nickname={turnUser?.nickname ?? "?"}
        avatarUrl={turnUser?.avatar_url ?? null}
        seatIndex={turnSeat?.seat_index ?? 0}
        turnStartedAt={activeHand?.turn_started_at ?? null}
        timerSeconds={room.turn_timer_seconds}
        timerEnabled={room.turn_timer_enabled}
        potCop={activeHand?.pot_cop ?? 0}
        lastAction={lastActionInfo}
        myHoleCards={
          room.card_mode === "VIRTUAL" &&
          Array.isArray(myParticipant?.hole_cards)
            ? (myParticipant!.hole_cards as string[])
            : null
        }
      />
      <WinCelebration winners={winners} />
      <WinAnnouncement winners={winners} perspectiveIsWinner={iAmAWinner} />
      <GameSounds
        lastActionId={lastActionInfo?.id ?? null}
        lastActionType={lastActionInfo?.type ?? null}
        phase={activeHand?.phase ?? null}
        isMyTurn={isMyTurn}
        endedHandId={lastEndedHand?.id ?? null}
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <AnimateIn preset="fadeUp">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold drop-shadow">
                {room.name ?? "Sala"}
              </h1>
              <p className="text-xs text-zinc-300/60">
                Código{" "}
                <span className="font-mono tracking-widest text-zinc-300">
                  {room.code}
                </span>
              </p>
              <p className="mt-1 text-xs text-zinc-300/80">
                {isTournament ? "Torneo" : "Mesa libre"} · Blinds{" "}
                {formatCop(room.blind_small_cop)} / {formatCop(room.blind_big_cop)}
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-zinc-300/70 hover:text-zinc-100"
            >
              Salir
            </Link>
          </header>
        </AnimateIn>

        <AnimateIn preset="scaleIn" delay={0.08}>
          <section className="felt-card rounded-2xl p-5 text-center">
            <p className="text-sm text-zinc-300/80">Tu balance</p>
            <p className="text-4xl font-bold tabular-nums drop-shadow">
              {formatCop(mySeat.chips_balance_cop)}
            </p>
            <p className="mt-1 text-xs text-zinc-300/70">
              Asiento #{mySeat.seat_index} · {mySeat.status}
              {myCurrentBet > 0 && (
                <>
                  {" · "}
                  <span className="text-amber-300">
                    apuesta {formatCop(myCurrentBet)}
                  </span>
                </>
              )}
            </p>
          </section>
        </AnimateIn>

        {activeHand && (
          <AnimateIn preset="fadeUp" delay={0.12}>
            <PokerTable
              seats={tableSeats}
              mySeatIndex={mySeat.seat_index}
              totalSeats={room.max_seats}
              potCop={activeHand.pot_cop}
              phase={activeHand.phase}
              handNumber={activeHand.hand_number}
              communityCards={
                room.card_mode === "VIRTUAL"
                  ? ((activeHand.community_cards ?? []) as string[])
                  : null
              }
            />
          </AnimateIn>
        )}

        {activeHand &&
          room.card_mode === "VIRTUAL" &&
          Array.isArray(myParticipant?.hole_cards) &&
          (myParticipant!.hole_cards as string[]).length === 2 && (
            <AnimateIn preset="scaleIn" delay={0.14}>
              <MyHoleCardsInline
                cards={myParticipant!.hole_cards as string[]}
              />
            </AnimateIn>
          )}

        {/* Estados sin mano activa: lobby de torneo / pedir fichas / solicitud pendiente */}
        {!activeHand && tournamentLobby ? (
          <AnimateIn preset="fadeUp" delay={0.16}>
            <section className="felt-pulse rounded-xl border border-amber-700/40 bg-amber-950/30 p-4 text-center">
              <p className="text-sm font-semibold text-amber-300">
                Esperando inicio del torneo
              </p>
              <p className="mt-1 text-xs text-zinc-300/80">
                {occupiedCount} de {room.max_seats} jugadores conectados · Buy-in{" "}
                {formatCop(room.tournament_cost_cop ?? 0)}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                El dealer iniciará el torneo cuando esté listo.
              </p>
            </section>
          </AnimateIn>
        ) : !activeHand && !isTournament && myPendingRequest ? (
          <AnimateIn preset="fadeUp" delay={0.16}>
            <section className="felt-pulse rounded-xl border border-amber-700/40 bg-amber-950/30 p-4 text-center">
              <p className="text-sm font-semibold text-amber-300">
                Solicitud pendiente
              </p>
              <p className="mt-1 text-xs text-zinc-300/80">
                Pediste {formatCop(myPendingRequest.amount_cop)} · esperando
                aprobación del dealer.
              </p>
            </section>
          </AnimateIn>
        ) : !activeHand && !isTournament && mySeat.chips_balance_cop === 0 ? (
          <AnimateIn preset="fadeUp" delay={0.16}>
            <RequestChipsForm
              roomCode={room.code}
              minBuyIn={room.min_buy_in_cop ?? 500}
            />
          </AnimateIn>
        ) : null}

        {/* Acciones — solo cuando es mi turno y estoy IN */}
        {activeHand && isMyTurn && myParticipant?.status === "IN" && (
          <AnimateIn preset="scaleIn" delay={0.16}>
            <ActionButtons
              roomCode={room.code}
              toCallCop={toCall}
              myChipsCop={mySeat.chips_balance_cop}
              currentBetCop={currentBet}
              bigBlindCop={room.blind_big_cop}
              myCurrentBetCop={myCurrentBet}
              potCop={activeHand.pot_cop}
            />
          </AnimateIn>
        )}

        {activeHand && myParticipant?.status === "FOLDED" && (
          <AnimateIn preset="fadeUp" delay={0.16}>
            <p className="rounded-md border border-zinc-700/40 bg-zinc-900/40 p-3 text-center text-sm text-zinc-400">
              Te retiraste de esta mano. Esperando la próxima.
            </p>
          </AnimateIn>
        )}

        {activeHand && myParticipant?.status === "ALL_IN" && (
          <AnimateIn preset="fadeUp" delay={0.16}>
            <p className="rounded-md border border-amber-700/40 bg-amber-950/30 p-3 text-center text-sm font-semibold text-amber-300">
              All-in · esperando resultado
            </p>
          </AnimateIn>
        )}

      </div>
    </main>
  );
}

