"use client";

import { useState } from "react";
import { PlayingCard } from "./playing-card";

// Versión inline del badge de cartas (sin posicionamiento absoluto).
// Para mostrar tus cartas debajo de la mesa o en cualquier flujo
// vertical. Click toggle expand; hover también amplía mientras dura.
export function MyHoleCardsInline({ cards }: { cards: string[] }) {
  const [pinned, setPinned] = useState(false);
  if (cards.length === 0) return null;
  return (
    <div
      className="group flex cursor-pointer justify-center py-1"
      onClick={() => setPinned((v) => !v)}
      role="button"
      aria-pressed={pinned}
      aria-label={pinned ? "Reducir tus cartas" : "Ampliar tus cartas"}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPinned((v) => !v);
        }
      }}
    >
      <div
        className={`flex gap-2 transition-transform duration-300 ease-out ${
          pinned ? "scale-150" : "group-hover:scale-125"
        }`}
        style={{ transformOrigin: "center center" }}
      >
        {cards.map((c, i) => (
          <div
            key={`${c}-${i}`}
            className={i === 0 ? "-rotate-3" : "rotate-3"}
          >
            <PlayingCard code={c} size="md" />
          </div>
        ))}
      </div>
    </div>
  );
}
