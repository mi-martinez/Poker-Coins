export interface ChipDenomination {
  color: string;
  valueCop: number;
  label: string;
}

export const CHIP_DENOMINATIONS: readonly ChipDenomination[] = [
  { color: "white", valueCop: 500, label: "$500" },
  { color: "red", valueCop: 1_000, label: "$1.000" },
  { color: "blue", valueCop: 5_000, label: "$5.000" },
  { color: "green", valueCop: 10_000, label: "$10.000" },
  { color: "black", valueCop: 50_000, label: "$50.000" },
  { color: "purple", valueCop: 100_000, label: "$100.000" },
] as const;

export const MIN_CHIP_DENOMINATION_COP = 500;

export function isValidChipAmount(amountCop: number): boolean {
  return (
    Number.isInteger(amountCop) &&
    amountCop >= MIN_CHIP_DENOMINATION_COP &&
    amountCop % MIN_CHIP_DENOMINATION_COP === 0
  );
}

const COP_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCop(amountCop: number): string {
  return COP_FORMATTER.format(amountCop);
}
