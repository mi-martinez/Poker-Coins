"use client";

import { useEffect, useRef } from "react";
import { sounds } from "@/lib/sounds";

interface Props {
  lastActionId: string | null;
  lastActionType: string | null;
  phase: string | null;
  isMyTurn: boolean;
  endedHandId: string | null;
}

// Component-only side effect que mapea cambios de estado del juego a
// efectos de sonido. No renderiza nada.
export function GameSounds({
  lastActionId,
  lastActionType,
  phase,
  isMyTurn,
  endedHandId,
}: Props) {
  const prevAction = useRef<string | null>(null);
  const prevPhase = useRef<string | null>(null);
  const prevTurn = useRef<boolean>(false);
  const prevWin = useRef<string | null>(null);
  const mounted = useRef(false);

  // En el primer mount, almacenar valores actuales sin disparar (para que
  // cargar la página no haga sonar todo el historial).
  useEffect(() => {
    if (!mounted.current) {
      prevAction.current = lastActionId;
      prevPhase.current = phase;
      prevTurn.current = isMyTurn;
      prevWin.current = endedHandId;
      mounted.current = true;
    }
  }, [lastActionId, phase, isMyTurn, endedHandId]);

  // Acción del juego (CHECK/CALL/RAISE/FOLD/ALL_IN/blinds)
  useEffect(() => {
    if (!mounted.current) return;
    if (!lastActionId || lastActionId === prevAction.current) return;
    prevAction.current = lastActionId;
    if (!lastActionType) return;
    switch (lastActionType) {
      case "CHECK":
        sounds.knock();
        break;
      case "CALL":
      case "SMALL_BLIND":
      case "BIG_BLIND":
        sounds.chipDrop();
        break;
      case "RAISE":
      case "ALL_IN":
        sounds.chipStack();
        break;
      case "FOLD":
        sounds.fold();
        break;
    }
  }, [lastActionId, lastActionType]);

  // Cambio de fase (deal de cartas)
  useEffect(() => {
    if (!mounted.current) return;
    if (!phase || phase === prevPhase.current) return;
    const prev = prevPhase.current;
    prevPhase.current = phase;
    if (!prev) return;
    if (phase === "FLOP" || phase === "TURN" || phase === "RIVER") {
      sounds.cardDeal();
    }
  }, [phase]);

  // Te toca el turno
  useEffect(() => {
    if (!mounted.current) return;
    if (isMyTurn && !prevTurn.current) {
      sounds.notify();
    }
    prevTurn.current = isMyTurn;
  }, [isMyTurn]);

  // Mano terminada con ganador
  useEffect(() => {
    if (!mounted.current) return;
    if (!endedHandId || endedHandId === prevWin.current) return;
    prevWin.current = endedHandId;
    sounds.cheer();
    sounds.chipCascade(10);
  }, [endedHandId]);

  return null;
}
