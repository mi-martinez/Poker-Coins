import { PokerChipSVG } from "./poker-chip-svg";

// Chip con dos caras para rotaciones 3D realistas. La cara back tiene
// rotateY(180deg) y un translateZ negativo para separación visible.
// El parent debe definir `perspective` en el container para que el
// rotateX/rotateY se vea con profundidad.
export function PokerChip3D({
  bg,
  ring,
  size,
  thickness = 3,
}: {
  bg: string;
  ring: string;
  size: number;
  thickness?: number;
}) {
  return (
    <div
      className="relative h-full w-full"
      style={{
        transformStyle: "preserve-3d",
        width: size,
        height: size,
      }}
    >
      {/* Cara superior */}
      <div
        className="absolute inset-0"
        style={{ transform: `translateZ(${thickness / 2}px)` }}
      >
        <PokerChipSVG bg={bg} ring={ring} size={size} />
      </div>
      {/* Cara inferior (mismo SVG pero girado) */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translateZ(${-thickness / 2}px) rotateY(180deg)`,
        }}
      >
        <PokerChipSVG bg={bg} ring={ring} size={size} />
      </div>
    </div>
  );
}
