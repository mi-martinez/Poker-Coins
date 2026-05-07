-- Poker Coins — modo de cartas (físicas vs virtuales).
--
-- PHYSICAL: hoy. El dealer humano reparte cartas reales y declara el
--   ganador en el UI. La app sólo gestiona apuestas/turnos/pozo.
--
-- VIRTUAL: el sistema reparte cartas vía deckofcardsapi.com, las muestra
--   en pantalla y al llegar al showdown evalúa la mejor mano y crea
--   los payouts automáticamente.

create type card_mode as enum ('PHYSICAL', 'VIRTUAL');

alter table public.rooms
  add column card_mode card_mode not null default 'PHYSICAL';

-- Estado de cartas por mano (sólo se usa en modo VIRTUAL)
alter table public.hands
  add column deck_id text,
  add column community_cards jsonb;

alter table public.hand_participants
  add column hole_cards jsonb;

-- RLS: las hole_cards no deben verse hasta el showdown. La política
-- existente sobre hand_participants ya filtra por seat ownership o
-- dealer; las queries server-side usan service role y filtran a mano.
-- No agregamos política nueva — el client nunca lee hand_participants
-- directamente, sólo recibe lo que la página server component decide
-- exponer.
