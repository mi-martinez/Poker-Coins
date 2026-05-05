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
