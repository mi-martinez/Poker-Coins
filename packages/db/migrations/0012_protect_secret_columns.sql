-- Poker Coins — protege columnas secretas de cheating.
--
-- Las RLS policies hp_select_in_room y hands_select_in_room permiten a
-- cualquier jugador sentado en la sala leer todas las filas de
-- hand_participants y hands. Eso incluye:
--   * hole_cards de oponentes (cheating directo).
--   * deck_id, que cualquiera podría usar contra deckofcardsapi.com
--     para inspeccionar las cartas que vienen.
--
-- PostgreSQL no permite filtrar columnas en RLS, pero sí privilegios
-- column-level: revocamos SELECT amplio y lo otorgamos sólo a las
-- columnas no-secretas. Las RLS de fila siguen aplicando.
--
-- Nuestro código del servidor usa service_role (createAdminClient) y
-- bypasea estos grants — sigue leyendo todo. Lo único que cambia es
-- el cliente authenticated: si un usuario malicioso conecta con su
-- JWT y hace SELECT *, postgres rechaza esas columnas.
--
-- Para mostrar cartas reveladas en showdown / final, el page server
-- component lee con admin y filtra qué pasa al cliente.

-- hand_participants: oculta hole_cards a clientes authenticated.
revoke select on public.hand_participants from authenticated;
grant select (
  id,
  hand_id,
  seat_id,
  status,
  current_bet_cop,
  total_bet_cop
) on public.hand_participants to authenticated;

-- hands: oculta deck_id (community_cards sí es público — son cartas
-- ya repartidas en la mesa que todos ven).
revoke select on public.hands from authenticated;
grant select (
  id,
  room_id,
  hand_number,
  dealer_seat_index,
  phase,
  pot_cop,
  current_turn_seat_id,
  phase_ready_at,
  turn_started_at,
  community_cards,
  started_at,
  ended_at
) on public.hands to authenticated;
