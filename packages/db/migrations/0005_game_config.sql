-- Poker Coins — game configuration + per-seat codes.

-- 1. Tipo de juego ---------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'game_type') then
    create type game_type as enum ('CASH', 'TOURNAMENT');
  end if;
end $$;

-- 2. Configuración del juego en rooms --------------------------------
alter table public.rooms
  add column if not exists game_type game_type not null default 'CASH',
  add column if not exists min_buy_in_cop integer
    check (min_buy_in_cop is null or (min_buy_in_cop >= 500 and min_buy_in_cop % 500 = 0)),
  add column if not exists tournament_cost_cop integer
    check (tournament_cost_cop is null or (tournament_cost_cop >= 500 and tournament_cost_cop % 500 = 0)),
  add column if not exists rebuy_enabled boolean not null default false,
  add column if not exists rebuy_cost_cop integer
    check (rebuy_cost_cop is null or (rebuy_cost_cop >= 500 and rebuy_cost_cop % 500 = 0)),
  add column if not exists max_rebuys integer
    check (max_rebuys is null or max_rebuys >= 0),
  add column if not exists turn_timer_enabled boolean not null default true,
  add column if not exists turn_timer_seconds integer not null default 30
    check (turn_timer_seconds between 5 and 300);

-- 3. Seats: código por posición + user_id nullable -------------------
alter table public.seats
  add column if not exists seat_code text;

alter table public.seats
  alter column user_id drop not null;

-- Índice único parcial sobre seat_code (donde no es null)
create unique index if not exists seats_seat_code_unique
  on public.seats (seat_code)
  where seat_code is not null;

-- 4. Eliminar la antigua restricción unique (room_id, user_id) y
-- reemplazarla por una versión que solo aplique cuando user_id no es
-- null (Postgres ya trata null != null en UNIQUE pero hacemos explícito).
alter table public.seats
  drop constraint if exists seats_room_id_user_id_key;

create unique index if not exists seats_room_user_unique
  on public.seats (room_id, user_id)
  where user_id is not null;

-- 5. Coherencia de configuración por tipo ----------------------------
alter table public.rooms
  drop constraint if exists rooms_config_coherent;
alter table public.rooms
  add constraint rooms_config_coherent check (
    case
      when game_type = 'CASH' then
        min_buy_in_cop is not null
        and tournament_cost_cop is null
        and rebuy_cost_cop is null
        and max_rebuys is null
        and rebuy_enabled = false
      when game_type = 'TOURNAMENT' then
        tournament_cost_cop is not null
        and min_buy_in_cop is null
        and (
          (rebuy_enabled = true and rebuy_cost_cop is not null and max_rebuys is not null)
          or (rebuy_enabled = false and rebuy_cost_cop is null and max_rebuys is null)
        )
      else true
    end
  );
