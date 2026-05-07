"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { PlayingCard } from "./playing-card";

type Phase =
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "COMPLETE";

const CARDS_FOR_PHASE: Record<Phase, number> = {
  PREFLOP: 0,
  FLOP: 3,
  TURN: 4,
  RIVER: 5,
  SHOWDOWN: 5,
  COMPLETE: 5,
};

interface Props {
  phase: Phase;
  /** Si está presente, modo VIRTUAL: muestra las cartas reales recibidas. */
  cards?: string[] | null;
}

// Indicador del street actual. En modo PHYSICAL muestra dorsos genéricos
// (las cartas reales están en la mesa). En modo VIRTUAL recibe `cards`
// con los códigos de deckofcardsapi y los renderiza con palo + rank.
export function CommunityCards({ phase, cards }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const prevCount = useRef<number>(0);
  const dealtCount =
    cards && cards.length > 0 ? cards.length : (CARDS_FOR_PHASE[phase] ?? 0);
  const targetCount = Math.min(dealtCount, 5);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const els = el.querySelectorAll<HTMLDivElement>("[data-card-dealt]");
      const newly: HTMLDivElement[] = [];
      els.forEach((card) => {
        const idx = Number(card.dataset.idx ?? "-1");
        if (idx >= prevCount.current && idx < targetCount) newly.push(card);
      });
      if (newly.length > 0) {
        gsap.fromTo(
          newly,
          { y: -80, rotate: -25, autoAlpha: 0, scale: 0.6 },
          {
            y: 0,
            rotate: 0,
            autoAlpha: 1,
            scale: 1,
            duration: 0.55,
            stagger: 0.12,
            ease: "back.out(1.5)",
          },
        );
      }
      prevCount.current = targetCount;
    },
    { dependencies: [targetCount] },
  );

  return (
    <div
      ref={root}
      className="flex items-center justify-center gap-2 py-2"
      aria-label="Cartas comunitarias"
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const dealt = i < targetCount;
        if (!dealt) {
          return (
            <div
              key={i}
              className="h-20 w-14 rounded-md border-2 border-dashed border-white/10 bg-black/20 sm:h-24 sm:w-16"
              aria-hidden="true"
            />
          );
        }
        const code = cards?.[i];
        return (
          <div key={i} data-card-dealt data-idx={i}>
            {code ? (
              <PlayingCard code={code} size="md" />
            ) : (
              <div className="relative h-20 w-14 rounded-md border-2 border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-300 shadow-lg sm:h-24 sm:w-16">
                <div className="absolute inset-1 rounded-sm bg-gradient-to-br from-felt-dark to-felt opacity-90" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
