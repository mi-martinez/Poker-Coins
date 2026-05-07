"use client";

import { useState } from "react";
import { PlayingCard } from "./playing-card";

interface Props {
  cards: string[];
  /** Tamaño base (cuando no está expandido) */
  baseSize?: "sm" | "md";
  /** className extra para el wrapper absoluto */
  className?: string;
}

// Cartas del jugador siempre visibles, posicionadas para superponerse
// con el borde inferior del avatar (los padres deben ser `relative`).
// Por defecto se muestran pequeñas; click o hover las amplía. El click
// queda "pegado" como toggle para que las puedan leer en pantallas
// táctiles donde no hay hover.
export function HoleCardsBadge({
  cards,
  baseSize = "sm",
  className = "",
}: Props) {
  const [pinned, setPinned] = useState(false);
  if (cards.length === 0) return null;
  return (
    <div
      className={`group absolute left-1/2 bottom-0 z-20 -translate-x-1/2 translate-y-1/3 cursor-pointer ${className}`}
      onClick={() => setPinned((v) => !v)}
      role="button"
      aria-pressed={pinned}
      aria-label={pinned ? "Ocultar tus cartas" : "Ampliar tus cartas"}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPinned((v) => !v);
        }
      }}
    >
      <div
        className={`flex gap-1.5 transition-all duration-300 ease-out will-change-transform ${
          pinned
            ? "scale-[2] -translate-y-16"
            : "group-hover:scale-[1.6] group-hover:-translate-y-10"
        }`}
        style={{ transformOrigin: "center bottom" }}
      >
        {cards.map((c, i) => (
          <div
            key={`${c}-${i}`}
            className={`transition-transform ${
              i === 0 ? "-rotate-6" : "rotate-6"
            }`}
          >
            <PlayingCard code={c} size={baseSize} />
          </div>
        ))}
      </div>
    </div>
  );
}
