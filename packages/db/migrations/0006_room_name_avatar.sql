-- Poker Coins — nombre de sala (estilo griego) + avatar de usuario.

alter table public.rooms add column if not exists name text;
alter table public.users add column if not exists avatar_url text;
