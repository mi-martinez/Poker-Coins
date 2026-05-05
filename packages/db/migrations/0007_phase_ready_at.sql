-- Poker Coins — timestamp de "ronda cerrada y lista para repartir".
-- El cliente lee este campo para mostrar el countdown (10s) antes de
-- avanzar de fase automáticamente.

alter table public.hands
  add column if not exists phase_ready_at timestamptz;
