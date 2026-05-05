"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { advancePhaseAction } from "@/app/_actions/phases";

// Duración del countdown según la fase de origen — depende de cuántas
// cartas físicas tiene que repartir el dealer.
const COUNTDOWN_MS_BY_PHASE: Record<string, number> = {
  PREFLOP: 10_000, // → FLOP: 3 cartas
  FLOP: 5_000, //    → TURN: 1 carta
  TURN: 5_000, //    → RIVER: 1 carta
  RIVER: 3_000, //   → SHOWDOWN: solo transición
};

const NEXT_PHASE_LABEL: Record<string, string> = {
  PREFLOP: "Repartiendo flop",
  FLOP: "Repartiendo turn",
  TURN: "Repartiendo river",
  RIVER: "Showdown",
};

const NEXT_CARDS_COUNT: Record<string, number> = {
  PREFLOP: 3,
  FLOP: 1,
  TURN: 1,
  RIVER: 0,
};

interface Props {
  roomCode: string;
  phase: string;
  phaseReadyAt: string | null;
  // Solo el dealer dispara el avance al expirar el countdown — los
  // jugadores ven la animación y esperan el data refresh.
  isDealer: boolean;
}

export function DealOverlay({ roomCode, phase, phaseReadyAt, isDealer }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const fired = useRef(false);

  const countdownMs = COUNTDOWN_MS_BY_PHASE[phase] ?? 10_000;

  // Reset cuando cambia phase_ready_at (nueva ronda cerrada)
  useEffect(() => {
    if (!phaseReadyAt) {
      setRemaining(null);
      fired.current = false;
      return;
    }
    fired.current = false;
    const deadline = new Date(phaseReadyAt).getTime() + countdownMs;

    function tick() {
      const r = Math.max(0, deadline - Date.now());
      setRemaining(r);
      if (r <= 0 && isDealer && !fired.current) {
        fired.current = true;
        const fd = new FormData();
        fd.append("room_code", roomCode);
        startTransition(async () => {
          await advancePhaseAction({}, fd);
        });
      }
    }

    tick(); // pinta inmediatamente con el estado correcto
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [phaseReadyAt, isDealer, roomCode, countdownMs]);

  if (!phaseReadyAt || remaining === null) return null;

  const seconds = Math.ceil(remaining / 1000);
  const label = NEXT_PHASE_LABEL[phase] ?? "Repartiendo";
  const cardsCount = NEXT_CARDS_COUNT[phase] ?? 0;
  const totalProgress = 1 - remaining / countdownMs;

  return (
    <Overlay
      label={label}
      seconds={seconds}
      cardsCount={cardsCount}
      progress={totalProgress}
    />
  );
}

function Overlay({
  label,
  seconds,
  cardsCount,
  progress,
}: {
  label: string;
  seconds: number;
  cardsCount: number;
  progress: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Mount-in animation
  useGSAP(
    () => {
      if (root.current) {
        gsap.fromTo(
          root.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.35, ease: "power2.out" },
        );
      }
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { y: 60, autoAlpha: 0, scale: 0.85 },
          {
            y: 0,
            autoAlpha: 1,
            scale: 1,
            duration: 0.55,
            ease: "back.out(1.5)",
            delay: 0.1,
          },
        );
      }
      if (cardsRef.current && cardsCount > 0) {
        const els = cardsRef.current.querySelectorAll("[data-deal-card]");
        gsap.fromTo(
          els,
          { x: -300, y: -120, rotate: -45, autoAlpha: 0, scale: 0.6 },
          {
            x: 0,
            y: 0,
            rotate: 0,
            autoAlpha: 1,
            scale: 1,
            duration: 0.65,
            stagger: 0.18,
            ease: "back.out(1.4)",
            delay: 0.4,
          },
        );
      }
    },
    { dependencies: [] },
  );

  // Calcula el dasharray del anillo de progreso
  const RADIUS = 60;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - progress);

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9500] flex flex-col items-center justify-center gap-6 bg-black/85 backdrop-blur-md"
    >
      <div ref={titleRef} className="flex flex-col items-center gap-3">
        <p className="text-xs uppercase tracking-[0.4em] text-amber-300/80">
          Ronda completa
        </p>
        <h2 className="font-display text-6xl font-bold tracking-wider text-amber-200 drop-shadow-[0_4px_20px_rgba(245,158,11,0.4)] sm:text-7xl">
          {label}
        </h2>
      </div>

      {cardsCount > 0 && (
        <div ref={cardsRef} className="flex gap-3 py-4">
          {Array.from({ length: cardsCount }).map((_, i) => (
            <div
              key={i}
              data-deal-card
              className="relative h-28 w-20 rounded-lg border-2 border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-300 shadow-2xl sm:h-36 sm:w-24"
            >
              <div className="absolute inset-1.5 rounded-md bg-gradient-to-br from-felt-dark to-felt opacity-90" />
            </div>
          ))}
        </div>
      )}

      <div className="relative flex h-36 w-36 items-center justify-center">
        <svg viewBox="0 0 140 140" className="absolute inset-0 -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="6"
          />
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        <div className="text-center">
          <div className="font-display text-5xl font-bold tabular-nums text-amber-200">
            {seconds}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-300/70">
            segundos
          </div>
        </div>
      </div>
    </div>
  );
}
