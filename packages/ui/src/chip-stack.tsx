import { Chip } from "./chip";
import { CHIP_DENOMINATIONS, formatCop } from "@poker-coins/game";

export interface ChipStackProps {
  amountCop: number;
  showAmount?: boolean;
}

// Picks up to 4 representative chip colors based on amount magnitude.
function pickStack(amountCop: number) {
  if (amountCop <= 0) return [];
  const ordered = [...CHIP_DENOMINATIONS].reverse();
  const stack: string[] = [];
  let remaining = amountCop;
  for (const den of ordered) {
    if (remaining >= den.valueCop && stack.length < 4) {
      stack.push(den.color);
      remaining -= den.valueCop;
    }
  }
  if (stack.length === 0) stack.push(CHIP_DENOMINATIONS[0]!.color);
  return stack;
}

export function ChipStack({ amountCop, showAmount = true }: ChipStackProps) {
  const colors = pickStack(amountCop);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 40, height: 40 + colors.length * 4 }}>
        {colors.map((color, i) => (
          <div
            key={i}
            className="absolute left-0"
            style={{ bottom: i * 4 }}
          >
            <Chip color={color} size={40} />
          </div>
        ))}
      </div>
      {showAmount && (
        <span className="text-xs font-semibold tabular-nums">
          {formatCop(amountCop)}
        </span>
      )}
    </div>
  );
}
