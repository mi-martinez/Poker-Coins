"use client";

import { useEffect, useState } from "react";

// Muestra un overlay obligando a girar el dispositivo a horizontal cuando:
//  - el viewport está en portrait, Y
//  - el dispositivo es mobile (touch + ancho corto).
// En tablets/desktop el guard nunca se activa.
export function OrientationGuard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      const isSmall = window.matchMedia("(max-width: 900px)").matches;
      const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      setShow(isPortrait && isSmall && isTouch);
    };

    evaluate();
    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener("change", evaluate);
    window.addEventListener("resize", evaluate);
    return () => {
      mq.removeEventListener("change", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-black/95 p-8 text-center"
    >
      <RotateIcon />
      <h2 className="text-2xl font-bold">Gira tu dispositivo</h2>
      <p className="max-w-xs text-zinc-300">
        Esta app está diseñada para usarse en horizontal. Por favor rota tu dispositivo.
      </p>
    </div>
  );
}

function RotateIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-24 w-24 animate-pulse text-felt-light"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="14" y="6" width="20" height="36" rx="3" />
      <path d="M40 28 q12 0 12 14" />
      <path d="M48 36 l4 6 6 -4" />
    </svg>
  );
}
