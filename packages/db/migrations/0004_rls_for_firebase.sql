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
