import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCop } from "@poker-coins/game";
import { getCurrentUser } from "@/lib/auth-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { AnimateIn } from "@/app/_components/animate";
import { Avatar } from "@/app/_components/avatar";
import { CloseRoomButton } from "./close-room-button";

interface SeatRow {
  id: string;
  room_id: string;
  user_id: string | null;
  seat_index: number;
  chips_balance_cop: number;
  status: string;
}

interface UserRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

export default async function DealerHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dealer");

  const admin = createAdminClient();

  const { data: openRooms } = await admin
    .from("rooms")
    .select(
      "id, code, name, game_type, status, blind_small_cop, blind_big_cop, max_seats, created_at",
    )
    .eq("dealer_user_id", user.id)
    .neq("status", "CLOSED")
    .order("created_at", { ascending: false });

  const { data: closedRooms } = await admin
    .from("rooms")
    .select("id, code, name, game_type, max_seats, created_at")
    .eq("dealer_user_id", user.id)
    .eq("status", "CLOSED")
    .order("created_at", { ascending: false })
    .limit(5);

  const openIds = (openRooms ?? []).map((r) => r.id);
  const seatsByRoom = new Map<string, SeatRow[]>();
  const currentTurnSeatByRoom = new Map<string, string>();
  const usersById = new Map<string, UserRow>();

  if (openIds.length > 0) {
    const [{ data: seats }, { data: hands }] = await Promise.all([
      admin
        .from("seats")
        .select("id, room_id, user_id, seat_index, chips_balance_cop, status")
        .in("room_id", openIds)
        .not("user_id", "is", null),
      admin
        .from("hands")
        .select("room_id, current_turn_seat_id")
        .in("room_id", openIds)
        .is("ended_at", null),
    ]);

    for (const s of seats ?? []) {
      const list = seatsByRoom.get(s.room_id) ?? [];
      list.push(s as SeatRow);
      seatsByRoom.set(s.room_id, list);
    }

    const userIds = Array.from(
      new Set((seats ?? []).flatMap((s) => (s.user_id ? [s.user_id] : []))),
    );
    if (userIds.length > 0) {
      const { data: users } = await admin
        .from("users")
        .select("id, nickname, avatar_url")
        .in("id", userIds);
      for (const u of users ?? []) {
        usersById.set(u.id, u as UserRow);
      }
    }

    const turnSeatIds = (hands ?? [])
      .map((h) => h.current_turn_seat_id)
      .filter((id): id is string => Boolean(id));
    if (turnSeatIds.length > 0) {
      const { data: turnSeats } = await admin
        .from("seats")
        .select("id, room_id, seat_index, user_id")
        .in("id", turnSeatIds);
      for (const s of turnSeats ?? []) {
        const nick =
          s.user_id && usersById.get(s.user_id)
            ? usersById.get(s.user_id)!.nickname
            : "?";
        currentTurnSeatByRoom.set(s.room_id, `#${s.seat_index} · ${nick}`);
      }
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <AnimateIn preset="fadeUp">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold drop-shadow">Mis salas</h1>
              <p className="text-xs text-zinc-300/70">Hola, {user.nickname}</p>
            </div>
            <Link
              href="/dealer/new"
              className="rounded-lg bg-felt px-4 py-2 text-sm font-semibold shadow-lg ring-1 ring-felt-light/30 transition hover:scale-[1.03] hover:bg-felt-light active:scale-[0.97]"
            >
              + Nueva sala
            </Link>
          </header>
        </AnimateIn>

        <AnimateIn preset="fadeUp" delay={0.08}>
          <h2 className="text-sm uppercase tracking-widest text-zinc-300/70">
            Mesas abiertas ({openRooms?.length ?? 0})
          </h2>
        </AnimateIn>

        {!openRooms || openRooms.length === 0 ? (
          <AnimateIn preset="scaleIn" delay={0.12}>
            <div className="felt-card rounded-2xl p-8 text-center">
              <p className="text-sm text-zinc-300/80">
                Aún no tienes salas abiertas.
              </p>
              <Link
                href="/dealer/new"
                className="mt-4 inline-block rounded-lg bg-felt px-4 py-2 text-sm font-semibold transition hover:bg-felt-light"
              >
                Crear primera sala
              </Link>
            </div>
          </AnimateIn>
        ) : (
          <AnimateIn preset="stagger" delay={0.12} className="flex flex-col gap-3">
            {openRooms.map((room) => {
              const roomSeats = seatsByRoom.get(room.id) ?? [];
              const sortedSeats = [...roomSeats].sort(
                (a, b) => b.chips_balance_cop - a.chips_balance_cop,
              );
              const turnLabel = currentTurnSeatByRoom.get(room.id);
              const statusLabel =
                room.status === "LOBBY"
                  ? "Esperando inicio"
                  : room.status === "ACTIVE"
                    ? turnLabel
                      ? `Turno: ${turnLabel}`
                      : "Mesa activa"
                    : room.status === "PAUSED"
                      ? "Pausada"
                      : room.status;
              const dateLabel = dateFmt.format(new Date(room.created_at));
              const title = room.name ?? room.code;

              return (
                <div key={room.id} className="felt-card rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <Link
                          href={`/dealer/${room.code}`}
                          className="font-display text-2xl tracking-wide hover:underline"
                        >
                          {title}
                        </Link>
                        <span className="text-xs text-zinc-300/70">
                          · {dateLabel}
                        </span>
                        <span className="rounded-md bg-felt-dark/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-felt-light">
                          {room.game_type === "TOURNAMENT" ? "Torneo" : "Cash"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-300/70">
                        Código{" "}
                        <span className="font-mono tracking-widest text-zinc-200">
                          {room.code}
                        </span>{" "}
                        · {roomSeats.length}/{room.max_seats} jugadores · Blinds{" "}
                        {formatCop(room.blind_small_cop)}/
                        {formatCop(room.blind_big_cop)}
                      </div>
                      <div className="text-xs text-zinc-400">{statusLabel}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Link
                        href={`/dealer/${room.code}`}
                        className="rounded-md border border-felt-light/40 bg-felt-dark/40 px-3 py-1 text-xs font-semibold transition hover:bg-felt-dark/70"
                      >
                        Abrir
                      </Link>
                      <CloseRoomButton roomCode={room.code} />
                    </div>
                  </div>

                  {sortedSeats.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-400">
                        En mesa
                      </span>
                      <div className="flex -space-x-2">
                        {sortedSeats.map((seat) => {
                          const u = seat.user_id
                            ? usersById.get(seat.user_id)
                            : undefined;
                          const isOut =
                            seat.chips_balance_cop === 0 ||
                            seat.status === "LEFT" ||
                            seat.status === "SITTING_OUT";
                          return (
                            <Avatar
                              key={seat.id}
                              nickname={u?.nickname ?? "?"}
                              avatarUrl={u?.avatar_url}
                              disabled={isOut}
                              size={32}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </AnimateIn>
        )}

        {closedRooms && closedRooms.length > 0 && (
          <AnimateIn preset="fadeUp" delay={0.2}>
            <details className="felt-card rounded-xl p-4">
              <summary className="cursor-pointer text-sm uppercase tracking-widest text-zinc-300/70">
                Mesas cerradas recientes ({closedRooms.length})
              </summary>
              <ul className="mt-3 flex flex-col gap-2">
                {closedRooms.map((room) => {
                  const dateLabel = dateFmt.format(new Date(room.created_at));
                  const title = room.name ?? room.code;
                  return (
                    <li
                      key={room.id}
                      className="flex items-center justify-between rounded-md border border-white/5 bg-black/30 px-3 py-2"
                    >
                      <Link
                        href={`/dealer/${room.code}`}
                        className="hover:underline"
                      >
                        <span className="font-display text-base tracking-wide">
                          {title}
                        </span>
                        <span className="ml-2 text-xs text-zinc-400">
                          · {dateLabel}
                        </span>
                      </Link>
                      <span className="font-mono text-xs tracking-widest text-zinc-500">
                        {room.code}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </AnimateIn>
        )}
      </div>
    </main>
  );
}
