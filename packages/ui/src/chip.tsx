import type { CSSProperties } from "react";

const COLOR_MAP: Record<string, { bg: string; ring: string }> = {
  white: { bg: "#f5f5f5", ring: "#a3a3a3" },
  red: { bg: "#d33232", ring: "#7f1d1d" },
  blue: { bg: "#2d6cdf", ring: "#1e3a8a" },
  green: { bg: "#1f8a3f", ring: "#14532d" },
  black: { bg: "#1a1a1a", ring: "#525252" },
  purple: { bg: "#7c3aed", ring: "#4c1d95" },
};

export interface ChipProps {
  color: string;
  size?: number;
  label?: string;
}

export function Chip({ color, size = 40, label }: ChipProps) {
  const palette = COLOR_MAP[color] ?? COLOR_MAP.white!;
  const style: CSSProperties = {
    width: size,
    height: size,
    background: palette.bg,
    borderColor: palette.ring,
    color: palette.bg === "#f5f5f5" ? "#1a1a1a" : "#fafafa",
  };
  return (
    <div
      style={style}
      className="flex items-center justify-center rounded-full border-4 text-xs font-bold shadow-md"
    >
      {label}
    </div>
  );
}
