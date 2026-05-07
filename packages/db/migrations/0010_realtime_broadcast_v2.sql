-- Poker Coins — endurece el broadcast en tiempo real.
-- Cambios respecto a 0009:
--   * Maneja DELETE además de INSERT/UPDATE (usa coalesce(NEW, OLD)).
--   * `return coalesce(NEW, OLD)` para que triggers AFTER DELETE no
--     fallen al retornar NULL en algunos paths.
--   * Recrea triggers para incluir DELETE en su WHEN clause.

create or replace function public.broadcast_room_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_table text := tg_table_name;
  v_row record;
begin
  v_row := coalesce(NEW, OLD);

  if v_table in ('seats', 'chip_requests', 'hands') then
    v_room_id := v_row.room_id;
  elsif v_table = 'rooms' then
    v_room_id := v_row.id;
  elsif v_table in ('hand_participants', 'actions', 'payouts') then
    select room_id into v_room_id from public.hands where id = v_row.hand_id;
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
  return coalesce(NEW, OLD);
end;
$$;

-- Re-crea triggers incluyendo DELETE
drop trigger if exists broadcast_seats_change on public.seats;
create trigger broadcast_seats_change
  after insert or update or delete on public.seats
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_chip_requests_change on public.chip_requests;
create trigger broadcast_chip_requests_change
  after insert or update or delete on public.chip_requests
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_hands_change on public.hands;
create trigger broadcast_hands_change
  after insert or update or delete on public.hands
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_hand_participants_change on public.hand_participants;
create trigger broadcast_hand_participants_change
  after insert or update or delete on public.hand_participants
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_actions_change on public.actions;
create trigger broadcast_actions_change
  after insert or update or delete on public.actions
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_payouts_change on public.payouts;
create trigger broadcast_payouts_change
  after insert or update or delete on public.payouts
  for each row execute function public.broadcast_room_change();

drop trigger if exists broadcast_rooms_change on public.rooms;
create trigger broadcast_rooms_change
  after update or delete on public.rooms
  for each row execute function public.broadcast_room_change();
