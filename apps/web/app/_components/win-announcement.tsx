"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatCop } from "@poker-coins/game";
import { Avatar } from "./avatar";
import type { Winner } from "./win-celebration";

const SEEN_KEY = "pc:seen-announcements";
const VISIBLE_MS = 4500;

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(handId: string) {
  if (typeof window === "undefined") return;
  const set = readSeen();
  set.add(handId);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
}

// Overlay tradicional anunciando al ganador a los jugadores que NO
// ganaron y al dealer. Mismo estilo visual que los otros overlays
// (DealOverlay, WaitingTurnOverlay) — sin chip burst, solo reveal sobrio.
export function WinAnnouncement({
  winners,
  perspectiveIsWinner,
}: {
  winners: Winner[] | null;
  // Si el usuario actual es ganador, no mostrar este overlay (la
  // celebración la maneja WinCelebration).
  perspectiveIsWinner: boolean;
}) {
  const [active, setActive] = useState<Winner[] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!winners || winners.length === 0) return;
    if (perspectiveIsWinner) return;
    const handId = winners[0]!.handId;
    const seen = readSeen();
    if (seen.has(handId)) return;
    setActive(winners);
    markSeen(handId);
    const timer = setTimeout(() => setActive(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [winners, perspectiveIsWinner]);

  useGSAP(
    () => {
      if (!active) return;
      const tl = gsap.timeline();
      if (root.current) {
        tl.fromTo(
          root.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.3, ease: "power2.out" },
        );
      }
      if (headerRef.current) {
        tl.fromTo(
          headerRef.current,
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
          "-=0.1",
        );
      }
      if (cardRef.current) {
        tl.fromTo(
          cardRef.current,
          { scale: 0.85, autoAlpha: 0 },
          {
            scale: 1,
            autoAlpha: 1,
            duration: 0.5,
            ease: "back.out(1.4)",
          },
          "-=0.2",
        );
      }
      if (amountRef.current) {
        tl.fromTo(
          amountRef.current,
          { y: 16, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
          "-=0.25",
        );
      }
    },
    { dependencies: [active] },
  );

  if (!active) return null;

  const isSplit = active.length > 1;
  const totalAmount = active.reduce((s, w) => s + w.amount, 0);

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9500] flex flex-col items-center justify-center gap-6 bg-black/85 px-6 backdrop-blur-md"
    >
      <div ref={headerRef} className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-[0.4em] text-amber-300/80">
          {isSplit ? "Empate · ganadores" : "Ganador de la mano"}
        </p>
      </div>

      <div
        ref={cardRef}
        className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-amber-500/30 bg-black/60 px-8 py-6 backdrop-blur"
      >
        {active.map((w) => (
          <div key={w.nickname} className="flex flex-col items-center gap-2">
            <Avatar
              nickname={w.nickname}
              avatarUrl={w.avatarUrl ?? null}
              size={96}
              ringColor="#f59e0b"
            />
            <h2 className="font-display text-3xl font-bold tracking-wider text-amber-200 drop-shadow sm:text-4xl">
              {w.nickname}
            </h2>
            {isSplit && (
              <p className="text-sm font-semibold tabular-nums text-zinc-300">
                {formatCop(w.amount)}
              </p>
            )}
          </div>
        ))}
      </div>

      <div ref={amountRef} className="flex flex-col items-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-300/70">
          {isSplit ? "Pozo total" : "Gana"}
        </p>
        <p className="font-display text-5xl font-bold tabular-nums text-amber-300 drop-shadow-[0_4px_18px_rgba(245,158,11,0.5)] sm:text-6xl">
          {formatCop(totalAmount)}
        </p>
      </div>
    </div>
  );
}
