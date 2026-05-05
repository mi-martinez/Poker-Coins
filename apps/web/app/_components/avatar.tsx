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
// Cuando disabled, se muestra en escala de grises y opacidad reducida.
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

  const ring = ringColor
    ? { boxShadow: `0 0 0 2px ${ringColor}` }
    : undefined;

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: size * 0.42,
    ...ring,
  };

  if (avatarUrl) {
    return (
      <span
        title={nickname}
        style={baseStyle}
        className={`inline-flex items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900 ${
          disabled ? "opacity-40 grayscale" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={nickname}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
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
      className={`inline-flex items-center justify-center rounded-full border border-white/10 font-bold text-white ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {initial}
    </span>
  );
}
