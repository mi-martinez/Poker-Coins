// Hash determinista de un string a un número 0-360 (matiz de color)
function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

export interface AvatarProps {
  nickname: string;
  avatarUrl?: string | null;
  disabled?: boolean;
  size?: number;
  ringColor?: string;
}

// Avatar circular. Si hay avatarUrl (Google), lo usa; si no, fallback a
// inicial sobre fondo coloreado deterministamente desde el nickname.
// El contenedor `display: block` con `aspect-ratio: 1/1` y `object-cover`
// garantiza que la imagen quede SIEMPRE perfectamente circular, sin
// importar la proporción original.
export function Avatar({
  nickname,
  avatarUrl,
  disabled = false,
  size = 32,
  ringColor,
}: AvatarProps) {
  const initial = (nickname || "?").trim().charAt(0).toUpperCase();
  const hue = hashHue(nickname);
  const bg = `hsl(${hue}, 55%, 45%)`;

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    aspectRatio: "1 / 1",
    fontSize: size * 0.42,
    ...(ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : {}),
  };

  if (avatarUrl) {
    return (
      <span
        title={nickname}
        style={baseStyle}
        className={`relative block overflow-hidden rounded-full bg-zinc-900 ${
          disabled ? "opacity-40 grayscale" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={nickname}
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      </span>
    );
  }

  return (
    <span
      title={nickname}
      style={{
        ...baseStyle,
        background: disabled ? "#3f3f46" : bg,
      }}
      className={`inline-flex items-center justify-center rounded-full font-bold text-white ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {initial}
    </span>
  );
}
