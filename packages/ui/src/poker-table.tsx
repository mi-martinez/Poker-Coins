import type { ReactNode } from "react";

export interface PokerTableProps {
  children?: ReactNode;
  potSlot?: ReactNode;
  centerSlot?: ReactNode;
}

// Mesa ovalada estilo Zynga. Los asientos se distribuyen alrededor mediante
// posicionamiento absoluto en CSS — este componente solo provee el "felt"
// y un slot central para bote y comunidad.
export function PokerTable({ children, potSlot, centerSlot }: PokerTableProps) {
  return (
    <div className="relative w-full max-w-3xl aspect-[2/1]">
      <div
        className="absolute inset-0 rounded-[50%] border-8 border-amber-900/60 bg-gradient-to-br from-felt-light via-felt to-felt-dark shadow-[inset_0_0_60px_rgba(0,0,0,0.6)]"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          {centerSlot}
          {potSlot && (
            <div className="text-sm uppercase tracking-widest text-zinc-100/80">
              {potSlot}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
