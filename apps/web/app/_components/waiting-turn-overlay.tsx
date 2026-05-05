"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatCop } from "@poker-coins/game";
import { Avatar } from "./avatar";

interface LastAction {
  id: string;
  nickname: string;
  type: string;
  amountCop: number;
}

interface Props {
  visible: boolean;
  nickname: string;
  avatarUrl: string | null;
  seatIndex: number;
  turnStartedAt: string | null;
  timerSeconds: number;
  timerEnabled: boolean;
  potCop: number;
  lastAction: LastAction | null;
}

const ACTION_LABEL: Record<string, string> = {
  CHECK: "Check",
  CALL: "Paga",
  RAISE: "Sube a",
  FOLD: "Se retira",
  ALL_IN: "All-in",
  SMALL_BLIND: "Small blind",
  BIG_BLIND: "Big blind",
};

const ACTION_TONE: Record<string, string> = {
  CHECK: "text-zinc-200 border-white/20",
  CALL: "text-emerald-300 border-emerald-500/40",
  RAISE: "text-amber-300 border-amber-500/50",
  FOLD: "text-red-300 border-red-500/40",
  ALL_IN: "text-amber-200 border-amber-400 bg-amber-950/40",
  SMALL_BLIND: "text-zinc-300 border-white/15",
  BIG_BLIND: "text-zinc-300 border-white/15",
};

const ACTION_NEEDS_AMOUNT = new Set([
  "CALL",
  "RAISE",
  "ALL_IN",
  "SMALL_BLIND",
  "BIG_BLIND",
]);

// Overlay fullscreen mostrando: última acción · siguiente turno (avatar +
// timer) · pozo. Se actualiza cada vez que entra una acción nueva.
export function WaitingTurnOverlay({
  visible,
  nickname,
  avatarUrl,
  seatIndex,
  turnStartedAt,
  timerSeconds,
  timerEnabled,
  potCop,
  lastAction,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const avatarWrapRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const potRef = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Mount-in
  useGSAP(
    () => {
      if (!visible) return;
      const tl = gsap.timeline();
      if (root.current) {
        tl.fromTo(
          root.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.3, ease: "power2.out" },
        );
      }
      if (avatarWrapRef.current) {
        tl.fromTo(
          avatarWrapRef.current,
          { scale: 0.5, autoAlpha: 0 },
          {
            scale: 1,
            autoAlpha: 1,
            duration: 0.5,
            ease: "back.out(1.6)",
          },
          "-=0.1",
        );
      }
      if (titleRef.current) {
        tl.fromTo(
          titleRef.current,
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
          "-=0.2",
        );
      }
      if (potRef.current) {
        tl.fromTo(
          potRef.current,
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
          "-=0.3",
        );
      }
    },
    { dependencies: [visible, nickname] },
  );

  // Re-anima el banner cuando llega una acción nueva
  useGSAP(
    () => {
      if (!visible || !bannerRef.current || !lastAction) return;
      gsap.fromTo(
        bannerRef.current,
        { y: -30, autoAlpha: 0, scale: 0.92 },
        {
          y: 0,
          autoAlpha: 1,
          scale: 1,
          duration: 0.5,
          ease: "back.out(1.5)",
        },
      );
    },
    { dependencies: [lastAction?.id, visible] },
  );

  // Pulse del pozo cuando cambia
  useGSAP(
    () => {
      if (!visible || !potRef.current) return;
      gsap.fromTo(
        potRef.current,
        { scale: 1.1 },
        { scale: 1, duration: 0.4, ease: "power2.out" },
      );
    },
    { dependencies: [potCop, visible] },
  );

  // Countdown
  useEffect(() => {
    if (!visible || !timerEnabled || !turnStartedAt) {
      setRemaining(null);
      return;
    }
    const deadline =
      new Date(turnStartedAt).getTime() + timerSeconds * 1000;
    const tick = () => {
      setRemaining(Math.max(0, deadline - Date.now()));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [visible, turnStartedAt, timerSeconds, timerEnabled]);

  if (!visible) return null;

  const seconds = remaining !== null ? Math.ceil(remaining / 1000) : null;
  const totalMs = timerSeconds * 1000;
  const progress =
    remaining !== null ? Math.max(0, Math.min(1, remaining / totalMs)) : 1;

  const RADIUS = 90;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - progress);
  const danger = remaining !== null && remaining < 5000;

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9300] flex flex-col items-center justify-between gap-4 bg-black/85 px-6 py-10 backdrop-blur-md"
    >
      {/* Banner: última acción */}
      {lastAction ? (
        <div
          ref={bannerRef}
          className={`mt-2 flex max-w-md items-center gap-3 rounded-full border px-5 py-3 backdrop-blur ${
            ACTION_TONE[lastAction.type] ?? "text-zinc-200 border-white/20"
          }`}
        >
          <span className="font-display text-2xl tracking-wide">
            {lastAction.nickname}
          </span>
          <span className="text-zinc-500">·</span>
          <span className="text-lg font-semibold">
            {ACTION_LABEL[lastAction.type] ?? lastAction.type}
            {ACTION_NEEDS_AMOUNT.has(lastAction.type) &&
              lastAction.amountCop > 0 && (
                <span className="ml-1.5 tabular-nums">
                  {formatCop(lastAction.amountCop)}
                </span>
              )}
          </span>
        </div>
      ) : (
        <div className="mt-2" />
      )}

      {/* Hero: avatar + nombre + countdown */}
      <div className="flex flex-col items-center gap-5">
        <div ref={avatarWrapRef} className="relative h-56 w-56">
          {timerEnabled && remaining !== null && (
            <svg
              viewBox="0 0 200 200"
              className="absolute inset-0 -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="6"
              />
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke={danger ? "#ef4444" : "#f59e0b"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 0.2s linear" }}
              />
            </svg>
          )}
          <div className="absolute inset-6 flex items-center justify-center">
            <Avatar
              nickname={nickname}
              avatarUrl={avatarUrl}
              size={160}
              ringColor={danger ? "#ef4444" : "#f59e0b"}
            />
          </div>
        </div>

        <div ref={titleRef} className="flex flex-col items-center gap-1">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300/80">
            Esperando turno
          </p>
          <h2 className="font-display text-5xl font-bold tracking-wider text-amber-200 drop-shadow-[0_4px_20px_rgba(245,158,11,0.4)] sm:text-6xl">
            {nickname}
          </h2>
          <p className="text-sm text-zinc-300/70">Asiento #{seatIndex}</p>
        </div>

        {timerEnabled && seconds !== null && (
          <div className="flex flex-col items-center">
            <div
              className={`font-display text-6xl font-bold tabular-nums drop-shadow-lg ${
                danger ? "text-red-400" : "text-zinc-100"
              }`}
            >
              {seconds}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-300/70">
              segundos
            </div>
          </div>
        )}
      </div>

      {/* Footer: pozo */}
      <div ref={potRef} className="flex flex-col items-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-300/60">
          Pozo
        </p>
        <p className="font-display text-4xl font-bold tabular-nums text-zinc-100 drop-shadow-lg sm:text-5xl">
          {formatCop(potCop)}
        </p>
      </div>
    </div>
  );
}
