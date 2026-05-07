// Carta de poker visual — recibe el código de deckofcardsapi (ej.
// "AS" = As de espadas, "0H" = 10 de corazones, "KD" = K de diamantes).
// Usa los PNG oficiales del repo crobertsbmw/deckofcards (226×314 px,
// ya cropped) servidos por deckofcardsapi.com/static/img/<CODE>.png.
// El PNG ya tiene el fondo blanco y borde de la carta — no envolvemos
// con white/bg/ring para evitar el efecto "carta dentro de tarjeta".

interface Props {
  /** Código de 2 chars: rank ("A","2"-"9","0","J","Q","K") + suit ("S","H","D","C") */
  code: string;
  /** Tamaño en clases Tailwind */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

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

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-14 w-10",
  md: "h-24 w-[68px] sm:h-28 sm:w-20",
  lg: "h-32 w-24",
  xl: "h-40 w-28",
};

const ASSET_BASE = "https://deckofcardsapi.com/static/img";

export function PlayingCard({ code, size = "md", className = "" }: Props) {
  if (!code || code.length < 2) {
    return null;
  }
  const upper = code.toUpperCase();
  const rank = upper[0]!;
  const suit = upper[upper.length - 1]!;
  const spokenRank = RANK_NAME[rank] ?? rank;
  const spokenSuit = SUIT_NAME[suit] ?? suit;
  const dim = SIZE[size];
  const src = `${ASSET_BASE}/${upper}.png`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${spokenRank} de ${spokenSuit}`}
      draggable={false}
      className={`block select-none rounded-md shadow-lg ${dim} ${className}`}
    />
  );
}
