"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

// Overlay fullscreen que aparece cuando la mano está en showdown con
// múltiples jugadores aún en juego — el dealer debe revisar las cartas
// físicas y declarar al ganador. Se cierra solo cuando el dealer
// completa closeHandAction y la mano se marca como ended_at.
export function WaitingWinnerOverlay({ visible }: { visible: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!visible) return;
      const tl = gsap.timeline();
      if (root.current) {
        tl.fromTo(
          root.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.35, ease: "power2.out" },
        );
      }
      if (titleRef.current) {
        tl.fromTo(
          titleRef.current,
          { y: 40, autoAlpha: 0, scale: 0.9 },
          {
            y: 0,
            autoAlpha: 1,
            scale: 1,
            duration: 0.5,
            ease: "back.out(1.4)",
          },
          "-=0.1",
        );
      }
      if (subtitleRef.current) {
        tl.fromTo(
          subtitleRef.current,
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
          "-=0.2",
        );
      }
      // Pulso continuo de los puntos
      if (dotsRef.current) {
        const dots = dotsRef.current.querySelectorAll<HTMLSpanElement>("span");
        gsap.to(dots, {
          autoAlpha: 0.3,
          duration: 0.6,
          stagger: { each: 0.18, repeat: -1, yoyo: true },
          ease: "sine.inOut",
        });
      }
    },
    { dependencies: [visible] },
  );

  if (!visible) return null;

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9400] flex flex-col items-center justify-center gap-6 bg-black/85 backdrop-blur-md"
    >
      <div ref={titleRef} className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-amber-300/80">
          Showdown
        </p>
        <h2 className="font-display text-5xl font-bold tracking-wider text-amber-200 drop-shadow-[0_4px_20px_rgba(245,158,11,0.4)] sm:text-6xl">
          Esperando ganador
        </h2>
      </div>
      <div ref={subtitleRef} className="text-center">
        <p className="text-zinc-300">
          El dealer está revisando las cartas físicas
        </p>
      </div>
      <div ref={dotsRef} className="flex gap-2 text-3xl text-amber-300">
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </div>
    </div>
  );
}
