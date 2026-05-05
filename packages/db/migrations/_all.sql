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
-- Poker Coins — RLS policies + auth helpers.
-- Asume que la migración 0001 ya corrió y que Anonymous Sign-Ins está
-- habilitado en Authentication → Providers de Supabase.

-- Helper functions ---------------------------------------------------
-- SECURITY DEFINER para que las policies puedan consultar tablas sin
-- recursión infinita en sus propias policies.

create or replace function public.is_dealer_of(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and r.dealer_user_id = auth.uid()
  );
$$;

create or replace function public.is_seated_in(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seats s
    where s.room_id = p_room_id
      and s.user_id = auth.uid()
      and s.status <> 'LEFT'
  );
$$;

create or replace function public.room_id_of_seat(p_seat_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select room_id from public.seats where id = p_seat_id;
$$;

create or replace function public.room_id_of_hand(p_hand_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select room_id from public.hands where id = p_hand_id;
$$;

grant execute on function public.is_dealer_of(uuid) to authenticated;
grant execute on function public.is_seated_in(uuid) to authenticated;
grant execute on function public.room_id_of_seat(uuid) to authenticated;
grant execute on function public.room_id_of_hand(uuid) to authenticated;

-- users --------------------------------------------------------------
create policy "users_select_self_or_room_peer"
on public.users for select
to authenticated
using (
  id = auth.uid()
  -- O bien el usuario está en una sala donde yo estoy/soy dealer.
  or exists (
    select 1 from public.seats s
    where s.user_id = users.id
      and (
        public.is_seated_in(s.room_id)
        or public.is_dealer_of(s.room_id)
      )
  )
);

create policy "users_insert_self"
on public.users for insert
to authenticated
with check (id = auth.uid());

create policy "users_update_self"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- rooms --------------------------------------------------------------
-- Todos los authenticated pueden leer rooms por code (lookup al unirse).
-- En la práctica el código mismo actúa como secret de bajo perfil.
create policy "rooms_select_authenticated"
on public.rooms for select
to authenticated
using (true);

create policy "rooms_insert_self_as_dealer"
on public.rooms for insert
to authenticated
with check (dealer_user_id = auth.uid());

create policy "rooms_update_dealer"
on public.rooms for update
to authenticated
using (dealer_user_id = auth.uid())
with check (dealer_user_id = auth.uid());

-- seats --------------------------------------------------------------
create policy "seats_select_in_same_room"
on public.seats for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_dealer_of(room_id)
  or public.is_seated_in(room_id)
);

create policy "seats_insert_self"
on public.seats for insert
to authenticated
with check (user_id = auth.uid());

create policy "seats_update_self_or_dealer"
on public.seats for update
to authenticated
using (user_id = auth.uid() or public.is_dealer_of(room_id))
with check (user_id = auth.uid() or public.is_dealer_of(room_id));

-- chip_requests ------------------------------------------------------
create policy "chip_requests_select_self_or_dealer"
on public.chip_requests for select
to authenticated
using (user_id = auth.uid() or public.is_dealer_of(room_id));

create policy "chip_requests_insert_self"
on public.chip_requests for insert
to authenticated
with check (user_id = auth.uid());

create policy "chip_requests_update_dealer"
on public.chip_requests for update
to authenticated
using (public.is_dealer_of(room_id))
with check (public.is_dealer_of(room_id));

-- hands --------------------------------------------------------------
create policy "hands_select_in_room"
on public.hands for select
to authenticated
using (public.is_dealer_of(room_id) or public.is_seated_in(room_id));

create policy "hands_insert_dealer"
on public.hands for insert
to authenticated
with check (public.is_dealer_of(room_id));

create policy "hands_update_dealer"
on public.hands for update
to authenticated
using (public.is_dealer_of(room_id))
with check (public.is_dealer_of(room_id));

-- hand_participants --------------------------------------------------
create policy "hp_select_in_room"
on public.hand_participants for select
to authenticated
using (
  public.is_dealer_of(public.room_id_of_hand(hand_id))
  or public.is_seated_in(public.room_id_of_hand(hand_id))
);

create policy "hp_insert_dealer"
on public.hand_participants for insert
to authenticated
with check (public.is_dealer_of(public.room_id_of_hand(hand_id)));

create policy "hp_update_dealer_or_self"
on public.hand_participants for update
to authenticated
using (
  public.is_dealer_of(public.room_id_of_hand(hand_id))
  or public.room_id_of_seat(seat_id) is not null
)
with check (
  public.is_dealer_of(public.room_id_of_hand(hand_id))
  or public.room_id_of_seat(seat_id) is not null
);

-- actions ------------------------------------------------------------
-- Inserts de acciones de jugador validados desde server action: el
-- jugador puede insertar su propia acción si es su turno (la lógica
-- está en el server, no en RLS — la policy solo limita por room).
create policy "actions_select_in_room"
on public.actions for select
to authenticated
using (
  public.is_dealer_of(public.room_id_of_hand(hand_id))
  or public.is_seated_in(public.room_id_of_hand(hand_id))
);

create policy "actions_insert_self_or_dealer"
on public.actions for insert
to authenticated
with check (
  -- el seat pertenece a quien escribe, o el dealer está actuando.
  exists (
    select 1 from public.seats s
    where s.id = seat_id
      and (s.user_id = auth.uid() or public.is_dealer_of(s.room_id))
  )
);

-- payouts ------------------------------------------------------------
create policy "payouts_select_in_room"
on public.payouts for select
to authenticated
using (
  public.is_dealer_of(public.room_id_of_hand(hand_id))
  or public.is_seated_in(public.room_id_of_hand(hand_id))
);

create policy "payouts_insert_dealer"
on public.payouts for insert
to authenticated
with check (public.is_dealer_of(public.room_id_of_hand(hand_id)));

-- ledger_entries -----------------------------------------------------
create policy "ledger_select_self_or_dealer"
on public.ledger_entries for select
to authenticated
using (
  exists (
    select 1 from public.seats s
    where s.id = seat_id
      and (s.user_id = auth.uid() or public.is_dealer_of(s.room_id))
  )
);

-- Inserts en ledger SOLO desde server (admin client). No hay policy de
-- insert para authenticated → bloqueado a menos que sea con la secret
-- key (que bypassa RLS).
-- Poker Coins — migrar auth a Firebase Third-Party Auth.
-- Asume que en Supabase Dashboard ya configuraste:
--   Authentication → Sign In / Up → Third Party Auth → Add Firebase
--   con project_id = pokercoins-7828c.

-- 1. Romper dependencia con auth.users (Supabase Auth).
alter table public.users drop constraint if exists users_id_fkey;
alter table public.users alter column id set default gen_random_uuid();

-- 2. Añadir columna firebase_uid (la fuente de verdad de identidad ahora).
alter table public.users
  add column if not exists firebase_uid text unique;

-- 3. Helper: traduce el sub del JWT de Firebase al uuid interno de
-- public.users. SECURITY DEFINER para que las policies puedan usarla
-- sin recursión.
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users
  where firebase_uid = auth.jwt() ->> 'sub';
$$;

grant execute on function public.current_user_id() to authenticated;

-- 4. Reescribir is_dealer_of e is_seated_in para que usen current_user_id().
create or replace function public.is_dealer_of(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and r.dealer_user_id = public.current_user_id()
  );
$$;

create or replace function public.is_seated_in(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seats s
    where s.room_id = p_room_id
      and s.user_id = public.current_user_id()
      and s.status <> 'LEFT'
  );
$$;
-- Poker Coins — actualizar RLS policies para Firebase Third-Party Auth.
-- Reemplaza todas las referencias a auth.uid() (Supabase Auth UUID) por
-- public.current_user_id() (uuid interno mapeado desde firebase_uid).

-- Drop previous policies (idempotente)
drop policy if exists "users_select_self_or_room_peer" on public.users;
drop policy if exists "users_insert_self" on public.users;
drop policy if exists "users_update_self" on public.users;

drop policy if exists "rooms_select_authenticated" on public.rooms;
drop policy if exists "rooms_insert_self_as_dealer" on public.rooms;
drop policy if exists "rooms_update_dealer" on public.rooms;

drop policy if exists "seats_select_in_same_room" on public.seats;
drop policy if exists "seats_insert_self" on public.seats;
drop policy if exists "seats_update_self_or_dealer" on public.seats;

drop policy if exists "chip_requests_select_self_or_dealer" on public.chip_requests;
drop policy if exists "chip_requests_insert_self" on public.chip_requests;
drop policy if exists "chip_requests_update_dealer" on public.chip_requests;

drop policy if exists "hands_select_in_room" on public.hands;
drop policy if exists "hands_insert_dealer" on public.hands;
drop policy if exists "hands_update_dealer" on public.hands;

drop policy if exists "hp_select_in_room" on public.hand_participants;
drop policy if exists "hp_insert_dealer" on public.hand_participants;
drop policy if exists "hp_update_dealer_or_self" on public.hand_participants;

drop policy if exists "actions_select_in_room" on public.actions;
drop policy if exists "actions_insert_self_or_dealer" on public.actions;

drop policy if exists "payouts_select_in_room" on public.payouts;
drop policy if exists "payouts_insert_dealer" on public.payouts;

drop policy if exists "ledger_select_self_or_dealer" on public.ledger_entries;

-- users --------------------------------------------------------------
create policy "users_select_self_or_room_peer"
on public.users for select
to authenticated
using (
  id = public.current_user_id()
  or exists (
    select 1 from public.seats s
    where s.user_id = users.id
      and (
        public.is_seated_in(s.room_id)
        or public.is_dealer_of(s.room_id)
      )
  )
);

-- Insert se hace SIEMPRE desde el route handler con admin client; no
-- damos policy de insert al rol authenticated.

create policy "users_update_self"
on public.users for update
to authenticated
using (id = public.current_user_id())
with check (id = public.current_user_id());

-- rooms --------------------------------------------------------------
create policy "rooms_select_authenticated"
on public.rooms for select
to authenticated
using (true);

create policy "rooms_insert_self_as_dealer"
on public.rooms for insert
to authenticated
with check (dealer_user_id = public.current_user_id());

create policy "rooms_update_dealer"
on public.rooms for update
to authenticated
using (dealer_user_id = public.current_user_id())
with check (dealer_user_id = public.current_user_id());

-- seats --------------------------------------------------------------
create policy "seats_select_in_same_room"
on public.seats for select
to authenticated
using (
  user_id = public.current_user_id()
  or public.is_dealer_of(room_id)
  or public.is_seated_in(room_id)
);

create policy "seats_insert_self"
on public.seats for insert
to authenticated
with check (user_id = public.current_user_id());

create policy "seats_update_self_or_dealer"
on public.seats for update
to authenticated
using (user_id = public.current_user_id() or public.is_dealer_of(room_id))
with check (user_id = public.current_user_id() or public.is_dealer_of(room_id));

-- chip_requests ------------------------------------------------------
create policy "chip_requests_select_self_or_dealer"
on public.chip_requests for select
to authenticated
using (user_id = public.current_user_id() or public.is_dealer_of(room_id));

create policy "chip_requests_insert_self"
on public.chip_requests for insert
to authenticated
with check (user_id = public.current_user_id());

create policy "chip_requests_update_dealer"
on public.chip_requests for update
to authenticated
using (public.is_dealer_of(room_id))
with check (public.is_dealer_of(room_id));

-- hands --------------------------------------------------------------
create policy "hands_select_in_room"
on public.hands for select
to authenticated
using (public.is_dealer_of(room_id) or public.is_seated_in(room_id));

create policy "hands_insert_dealer"
on public.hands for insert
to authenticated
with check (public.is_dealer_of(room_id));

create policy "hands_update_dealer"
on public.hands for update
to authenticated
using (public.is_dealer_of(room_id))
with check (public.is_dealer_of(room_id));

-- hand_participants --------------------------------------------------
create policy "hp_select_in_room"
on public.hand_participants for select
to authenticated
using (
  public.is_dealer_of(public.room_id_of_hand(hand_id))
  or public.is_seated_in(public.room_id_of_hand(hand_id))
);

create policy "hp_insert_dealer"
on public.hand_participants for insert
to authenticated
with check (public.is_dealer_of(public.room_id_of_hand(hand_id)));

create policy "hp_update_dealer"
on public.hand_participants for update
to authenticated
using (public.is_dealer_of(public.room_id_of_hand(hand_id)))
with check (public.is_dealer_of(public.room_id_of_hand(hand_id)));

-- actions ------------------------------------------------------------
create policy "actions_select_in_room"
on public.actions for select
to authenticated
using (
  public.is_dealer_of(public.room_id_of_hand(hand_id))
  or public.is_seated_in(public.room_id_of_hand(hand_id))
);

create policy "actions_insert_self_or_dealer"
on public.actions for insert
to authenticated
with check (
  exists (
    select 1 from public.seats s
    where s.id = seat_id
      and (
        s.user_id = public.current_user_id()
        or public.is_dealer_of(s.room_id)
      )
  )
);

-- payouts ------------------------------------------------------------
create policy "payouts_select_in_room"
on public.payouts for select
to authenticated
using (
  public.is_dealer_of(public.room_id_of_hand(hand_id))
  or public.is_seated_in(public.room_id_of_hand(hand_id))
);

create policy "payouts_insert_dealer"
on public.payouts for insert
to authenticated
with check (public.is_dealer_of(public.room_id_of_hand(hand_id)));

-- ledger_entries -----------------------------------------------------
create policy "ledger_select_self_or_dealer"
on public.ledger_entries for select
to authenticated
using (
  exists (
    select 1 from public.seats s
    where s.id = seat_id
      and (
        s.user_id = public.current_user_id()
        or public.is_dealer_of(s.room_id)
      )
  )
);
