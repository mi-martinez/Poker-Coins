-- Poker Coins — initial schema
-- Run via Supabase SQL editor or `supabase db push`.

-- Enums --------------------------------------------------------------
create type room_status as enum ('LOBBY', 'ACTIVE', 'PAUSED', 'CLOSED');
create type seat_status as enum ('WAITING', 'ACTIVE', 'SITTING_OUT', 'LEFT');
create type chip_request_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type hand_phase as enum ('PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'COMPLETE');
create type participant_status as enum ('IN', 'FOLDED', 'ALL_IN');
create type action_type as enum (
  'SMALL_BLIND', 'BIG_BLIND', 'CHECK', 'CALL', 'RAISE', 'FOLD', 'ALL_IN'
);

-- Users --------------------------------------------------------------
-- Linked 1:1 with auth.users (Supabase). For anon-auth flow, the
-- auth.users row is created automatically; we mirror nickname here.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (length(nickname) between 1 and 20),
  created_at timestamptz not null default now()
);

-- Rooms --------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  dealer_user_id uuid not null references public.users(id) on delete restrict,
  status room_status not null default 'LOBBY',
  blind_small_cop integer not null check (blind_small_cop > 0),
  blind_big_cop integer not null check (blind_big_cop > blind_small_cop),
  max_seats integer not null default 9 check (max_seats between 2 and 10),
  created_at timestamptz not null default now()
);

create index rooms_code_idx on public.rooms (code);
create index rooms_dealer_idx on public.rooms (dealer_user_id);

-- Seats --------------------------------------------------------------
create table public.seats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  seat_index smallint not null check (seat_index between 0 and 9),
  chips_balance_cop integer not null default 0 check (chips_balance_cop >= 0),
  status seat_status not null default 'WAITING',
  created_at timestamptz not null default now(),
  unique (room_id, seat_index),
  unique (room_id, user_id)
);

create index seats_room_idx on public.seats (room_id);

-- Chip requests ------------------------------------------------------
create table public.chip_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount_cop integer not null check (amount_cop >= 500 and amount_cop % 500 = 0),
  status chip_request_status not null default 'PENDING',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index chip_requests_room_status_idx
  on public.chip_requests (room_id, status);

-- Hands --------------------------------------------------------------
create table public.hands (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  hand_number integer not null check (hand_number > 0),
  dealer_seat_index smallint not null,
  phase hand_phase not null default 'PREFLOP',
  pot_cop integer not null default 0 check (pot_cop >= 0),
  current_turn_seat_id uuid references public.seats(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (room_id, hand_number)
);

create index hands_room_idx on public.hands (room_id);

-- Hand participants --------------------------------------------------
create table public.hand_participants (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references public.hands(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  status participant_status not null default 'IN',
  current_bet_cop integer not null default 0 check (current_bet_cop >= 0),
  total_bet_cop integer not null default 0 check (total_bet_cop >= 0),
  unique (hand_id, seat_id)
);

create index hand_participants_hand_idx on public.hand_participants (hand_id);

-- Actions ------------------------------------------------------------
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references public.hands(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  phase hand_phase not null,
  type action_type not null,
  amount_cop integer not null default 0 check (amount_cop >= 0),
  created_at timestamptz not null default now()
);

create index actions_hand_idx on public.actions (hand_id, created_at);

-- Payouts ------------------------------------------------------------
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references public.hands(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  amount_cop integer not null check (amount_cop > 0),
  reason text,
  created_at timestamptz not null default now()
);

create index payouts_hand_idx on public.payouts (hand_id);

-- Ledger entries -----------------------------------------------------
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats(id) on delete cascade,
  delta_cop integer not null,
  hand_id uuid references public.hands(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index ledger_entries_seat_idx on public.ledger_entries (seat_id, created_at);

-- Realtime: enable replication for the tables jugadores y dealer
-- need to subscribe to.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.seats;
alter publication supabase_realtime add table public.chip_requests;
alter publication supabase_realtime add table public.hands;
alter publication supabase_realtime add table public.hand_participants;
alter publication supabase_realtime add table public.actions;
alter publication supabase_realtime add table public.payouts;

-- RLS placeholder: enable on all tables. Policies se definen en una
-- migración posterior cuando los flujos del MVP estén implementados.
alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.seats enable row level security;
alter table public.chip_requests enable row level security;
alter table public.hands enable row level security;
alter table public.hand_participants enable row level security;
alter table public.actions enable row level security;
alter table public.payouts enable row level security;
alter table public.ledger_entries enable row level security;
