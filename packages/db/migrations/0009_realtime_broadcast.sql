-- Poker Coins — broadcast en tiempo real via Postgres triggers.
-- Cada cambio relevante hace realtime.send a un canal por sala.
-- Los clientes se suscriben con el publishable key (no requiere
-- Third-Party Auth bridge porque broadcast público no aplica RLS).

create or replace function public.broadcast_room_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_table text := tg_table_name;
begin
  if v_table in ('seats', 'chip_requests', 'hands') then
    v_room_id := NEW.room_id;
  elsif v_table = 'rooms' then
    v_room_id := NEW.id;
  elsif v_table in ('hand_participants', 'actions', 'payouts') then
    select room_id into v_room_id from public.hands where id = NEW.hand_id;
  end if;

  if v_room_id is not null then
    perform realtime.send(
      jsonb_build_object(
        'table', v_table,
        'op', tg_op,
        'ts', extract(epoch from now())
      ),
      'change',
      'room:' || v_room_id::text,
      false  -- public channel
    );
  end if;
  return NEW;
end;
$$;

-- Triggers en cada tabla relevante (insert + update; delete raro en gameplay)
drop trigger if exists broadcast_seats_change on public.seats;
create trigger broadcast_seats_change
  after insert or update on public.seats
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_chip_requests_change on public.chip_requests;
create trigger broadcast_chip_requests_change
  after insert or update on public.chip_requests
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_hands_change on public.hands;
create trigger broadcast_hands_change
  after insert or update on public.hands
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_hand_participants_change on public.hand_participants;
create trigger broadcast_hand_participants_change
  after insert or update on public.hand_participants
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_actions_change on public.actions;
create trigger broadcast_actions_change
  after insert or update on public.actions
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_payouts_change on public.payouts;
create trigger broadcast_payouts_change
  after insert or update on public.payouts
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_rooms_change on public.rooms;
create trigger broadcast_rooms_change
  after update on public.rooms
  for each row execute function public.broadcast_room_change();
