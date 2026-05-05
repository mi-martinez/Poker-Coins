// Ficha de poker SVG realista: borde oscuro, 8 cuñas alternadas
// (color/blanco) tipo casino, anillo interno y disco central con
// brillo lateral. Pensada para tamaños 24–80px sin perder definición.
export function PokerChipSVG({
  bg,
  ring,
  size,
}: {
  bg: string;
  ring: string;
  size: number;
}) {
  // Geometría de las 8 cuñas
  const wedges = Array.from({ length: 8 }, (_, i) => {
    const isStripe = i % 2 === 1;
    const start = i * 45 - 90;
    const end = start + 45;
    const r = 47;
    const x1 = 50 + r * Math.cos((start * Math.PI) / 180);
    const y1 = 50 + r * Math.sin((start * Math.PI) / 180);
    const x2 = 50 + r * Math.cos((end * Math.PI) / 180);
    const y2 = 50 + r * Math.sin((end * Math.PI) / 180);
    return {
      d: `M 50 50 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
      fill: isStripe ? "rgba(255,255,255,0.92)" : bg,
      key: i,
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.45))" }}
      aria-hidden="true"
    >
      {/* borde exterior oscuro */}
      <circle cx="50" cy="50" r="49" fill={ring} />
      {/* cuñas */}
      <g>
        {wedges.map((w) => (
          <path key={w.key} d={w.d} fill={w.fill} />
        ))}
      </g>
      {/* anillo interno */}
      <circle cx="50" cy="50" r="32" fill={ring} />
      {/* disco central */}
      <circle cx="50" cy="50" r="30" fill={bg} />
      {/* brillo lateral arriba */}
      <ellipse cx="42" cy="38" rx="14" ry="7" fill="rgba(255,255,255,0.28)" />
      {/* brillo punto */}
      <circle cx="38" cy="34" r="2" fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}
