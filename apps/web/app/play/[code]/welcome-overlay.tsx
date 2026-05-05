"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const SEEN_KEY = "pc:seen-hands";

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

// Muestra una animación fullscreen "Iniciando · Buena suerte" cuando
// el jugador entra a una mano nueva (handId que aún no ha visto).
export function WelcomeOverlay({ handId }: { handId: string | null }) {
  const [show, setShow] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!handId) return;
    const seen = readSeen();
    if (seen.has(handId)) return;
    setShow(true);
    markSeen(handId);
  }, [handId]);

  useEffect(() => {
    if (!show) return;
    const tl = gsap.timeline({
      onComplete: () => setShow(false),
    });

    if (root.current) {
      tl.fromTo(
        root.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3, ease: "power2.out" },
      );
    }
    if (titleRef.current) {
      tl.fromTo(
        titleRef.current,
        { y: 40, autoAlpha: 0, scale: 0.85 },
        {
          y: 0,
          autoAlpha: 1,
          scale: 1,
          duration: 0.6,
          ease: "back.out(1.6)",
        },
        "-=0.1",
      );
    }
    if (subtitleRef.current) {
      tl.fromTo(
        subtitleRef.current,
        { y: 20, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out" },
        "-=0.2",
      );
    }
    tl.to({}, { duration: 1.4 }); // hold
    if (root.current) {
      tl.to(root.current, {
        autoAlpha: 0,
        duration: 0.5,
        ease: "power2.in",
      });
    }

    return () => {
      tl.kill();
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      ref={root}
      className="pointer-events-none fixed inset-0 z-[9000] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
      aria-hidden="true"
    >
      <div
        ref={titleRef}
        className="font-display text-6xl font-bold tracking-wider text-amber-300 drop-shadow-[0_4px_24px_rgba(245,158,11,0.4)]"
      >
        Iniciando juego
      </div>
      <div
        ref={subtitleRef}
        className="mt-6 text-3xl font-semibold text-white drop-shadow-lg"
      >
        Buena suerte
      </div>
    </div>
  );
}
