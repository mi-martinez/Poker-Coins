// Adaptador interno para `pokersolver`. Encapsula la falta de tipos
// del paquete original con un cast local. Cualquier consumidor que
// importe desde `./hand-evaluator` (o desde el paquete `@poker-coins/
// game`) sólo ve los tipos públicos de SolverHand y Hand declarados
// aquí — sin necesidad de @types/pokersolver ni declare module ambient.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error pokersolver no expone tipos
import * as pokerLib from "pokersolver";

export interface SolverHand {
  cards: unknown[];
  rank: number;
  name: string;
  descr: string;
  toString(): string;
}

interface SolverHandStatic {
  solve(cards: string[]): SolverHand;
  winners(hands: SolverHand[]): SolverHand[];
}

export const Hand: SolverHandStatic = (
  pokerLib as unknown as { Hand: SolverHandStatic }
).Hand;
