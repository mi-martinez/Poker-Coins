// Carta de poker visual — recibe el código de deckofcardsapi (ej.
// "AS" = As de espadas, "0H" = 10 de corazones, "KD" = K de diamantes).
// Renderiza la carta con su rank y palo en colores apropiados.

interface Props {
  /** Código de 2 chars: rank ("A","2"-"9","0","J","Q","K") + suit ("S","H","D","C") */
  code: string;
  /** Tamaño en clases Tailwind */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SUIT_GLYPH: Record<string, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const SUIT_NAME: Record<string, string> = {
  S: "espadas",
  H: "corazones",
  D: "diamantes",
  C: "tréboles",
};

const RANK_NAME: Record<string, string> = {
  A: "As",
  K: "Rey",
  Q: "Reina",
  J: "Jota",
  "0": "10",
  T: "10",
};

const SUIT_RED = new Set(["H", "D"]);

const SIZE: Record<NonNullable<Props["size"]>, { wrap: string; rank: string; suit: string }> = {
  sm: {
    wrap: "h-12 w-9",
    rank: "text-base leading-none",
    suit: "text-base leading-none",
  },
  md: {
    wrap: "h-20 w-14 sm:h-24 sm:w-16",
    rank: "text-2xl leading-none sm:text-3xl",
    suit: "text-2xl leading-none sm:text-3xl",
  },
  lg: {
    wrap: "h-28 w-20",
    rank: "text-4xl leading-none",
    suit: "text-4xl leading-none",
  },
};

function displayRank(c: string): string {
  if (c === "0") return "10";
  return c;
}

export function PlayingCard({ code, size = "md", className = "" }: Props) {
  if (!code || code.length < 2) {
    return null;
  }
  const rank = code[0]!.toUpperCase();
  const suit = code[code.length - 1]!.toUpperCase();
  const isRed = SUIT_RED.has(suit);
  const dim = SIZE[size];
  const spokenRank = RANK_NAME[rank] ?? rank;
  const spokenSuit = SUIT_NAME[suit] ?? suit;
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-md border-2 border-zinc-300 bg-gradient-to-br from-white to-zinc-100 shadow-lg ${dim.wrap} ${className}`}
      aria-label={`${spokenRank} de ${spokenSuit}`}
    >
      <span
        className={`font-display font-bold tabular-nums ${dim.rank} ${
          isRed ? "text-red-600" : "text-zinc-900"
        }`}
      >
        {displayRank(rank)}
      </span>
      <span
        className={`${dim.suit} ${isRed ? "text-red-600" : "text-zinc-900"}`}
        aria-hidden="true"
      >
        {SUIT_GLYPH[suit] ?? suit}
      </span>
    </div>
  );
}
