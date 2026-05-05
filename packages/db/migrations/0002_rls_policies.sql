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
