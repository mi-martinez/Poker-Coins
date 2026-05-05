-- Poker Coins — timestamp del inicio del turno actual.
-- Se setea cada vez que current_turn_seat_id cambia. Los clientes
-- calculan el countdown a partir de turn_started_at + turn_timer_seconds.

alter table public.hands
  add column if not exists turn_started_at timestamptz;
