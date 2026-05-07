import "server-only";

// Cliente para deckofcardsapi.com — un mazo barajado, sin auth, gratis.
// Docs: https://deckofcardsapi.com/
//
// El servicio mantiene el estado del deck server-side; nosotros sólo
// guardamos el deck_id en hands.deck_id y vamos sacando cartas a medida
// que avanzamos las fases.

const BASE = "https://deckofcardsapi.com/api/deck";

export interface ApiCard {
  /** Código de 2 caracteres: "AS", "KH", "0D" (T → "0") */
  code: string;
  /** "ACE", "KING", "10", "5", etc. */
  value: string;
  /** "SPADES" | "HEARTS" | "DIAMONDS" | "CLUBS" */
  suit: string;
  /** URL de imagen oficial — opcional, no la usamos hoy */
  image: string;
}

interface NewDeckResponse {
  success: boolean;
  deck_id: string;
  shuffled: boolean;
  remaining: number;
}

interface DrawResponse {
  success: boolean;
  deck_id: string;
  cards: ApiCard[];
  remaining: number;
}

async function call<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`deckofcardsapi error ${res.status}: ${url}`);
  }
  const json = (await res.json()) as T & { success?: boolean };
  if (json.success === false) {
    throw new Error(`deckofcardsapi failure: ${url}`);
  }
  return json as T;
}

/** Crea un mazo nuevo (1 baraja, 52 cartas) ya barajado. */
export async function createDeck(): Promise<string> {
  const data = await call<NewDeckResponse>(
    `${BASE}/new/shuffle/?deck_count=1`,
  );
  return data.deck_id;
}

/** Saca N cartas del deck. Las cartas no vuelven al mazo. */
export async function drawCards(
  deckId: string,
  count: number,
): Promise<ApiCard[]> {
  if (count <= 0) return [];
  const data = await call<DrawResponse>(
    `${BASE}/${encodeURIComponent(deckId)}/draw/?count=${count}`,
  );
  return data.cards;
}

/** Helper: saca N cartas y devuelve sólo los códigos. */
export async function drawCardCodes(
  deckId: string,
  count: number,
): Promise<string[]> {
  const cards = await drawCards(deckId, count);
  return cards.map((c) => c.code);
}
