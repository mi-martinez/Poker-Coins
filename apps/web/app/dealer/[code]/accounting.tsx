import { formatCop } from "@poker-coins/game";

interface SeatRow {
  id: string;
  seat_index: number;
  user_id: string | null;
  chips_balance_cop: number;
}

interface LedgerEntry {
  seat_id: string;
  delta_cop: number;
  created_at: string;
}

interface UserRow {
  id: string;
  nickname: string;
}

// Hash de nickname → matiz HSL (mismo enfoque que Avatar)
function colorFor(nickname: string): string {
  let h = 0;
  for (let i = 0; i < nickname.length; i++) {
    h = (h * 31 + nickname.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 65%, 60%)`;
}

interface SeatSummary {
  seat_id: string;
  seat_index: number;
  nickname: string;
  color: string;
  balance: number;
  totalIn: number;
  totalOut: number;
  net: number;
  series: { t: number; balance: number }[];
}

function buildSummaries(
  seats: SeatRow[],
  ledger: LedgerEntry[],
  usersById: Map<string, UserRow>,
): SeatSummary[] {
  const result: SeatSummary[] = [];
  const occupied = seats.filter((s) => s.user_id);

  for (const seat of occupied) {
    const u = usersById.get(seat.user_id!);
    const entries = ledger
      .filter((l) => l.seat_id === seat.id)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

    let cum = 0;
    const series: { t: number; balance: number }[] = [];
    for (const e of entries) {
      cum += e.delta_cop;
      series.push({ t: new Date(e.created_at).getTime(), balance: cum });
    }
    if (series.length === 0) {
      // Sin movimientos aún — un punto en 0
      series.push({ t: Date.now(), balance: 0 });
    }

    const totalIn = entries
      .filter((e) => e.delta_cop > 0)
      .reduce((s, e) => s + e.delta_cop, 0);
    const totalOut = entries
      .filter((e) => e.delta_cop < 0)
      .reduce((s, e) => s + Math.abs(e.delta_cop), 0);

    result.push({
      seat_id: seat.id,
      seat_index: seat.seat_index,
      nickname: u?.nickname ?? "?",
      color: colorFor(u?.nickname ?? "?"),
      balance: seat.chips_balance_cop,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      series,
    });
  }
  return result;
}

function buildChart(summaries: SeatSummary[]): {
  paths: { color: string; d: string; nickname: string }[];
  domain: { tMin: number; tMax: number; bMin: number; bMax: number };
} {
  const allPoints = summaries.flatMap((s) => s.series);
  const tMin = Math.min(...allPoints.map((p) => p.t));
  const tMax = Math.max(...allPoints.map((p) => p.t));
  const bMin = Math.min(0, ...allPoints.map((p) => p.balance));
  const bMaxRaw = Math.max(0, ...allPoints.map((p) => p.balance));
  const bMax = bMaxRaw === bMin ? bMin + 1000 : bMaxRaw;

  const W = 100;
  const H = 100;

  const paths = summaries.map((s) => {
    if (s.series.length === 0) return { color: s.color, d: "", nickname: s.nickname };
    const pts = s.series.map((p) => {
      const x =
        tMax === tMin ? W / 2 : ((p.t - tMin) / (tMax - tMin)) * W;
      const y = H - ((p.balance - bMin) / (bMax - bMin)) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return {
      color: s.color,
      d: `M ${pts.join(" L ")}`,
      nickname: s.nickname,
    };
  });

  return {
    paths,
    domain: { tMin, tMax, bMin, bMax },
  };
}

export function Accounting({
  seats,
  ledger,
  usersById,
}: {
  seats: SeatRow[];
  ledger: LedgerEntry[];
  usersById: Map<string, UserRow>;
}) {
  const summaries = buildSummaries(seats, ledger, usersById);
  if (summaries.length === 0) {
    return null;
  }

  const totalChipsInPlay = summaries.reduce((s, x) => s + x.balance, 0);
  const totalNetMovement = summaries.reduce((s, x) => s + x.net, 0);

  const { paths, domain } = buildChart(summaries);

  return (
    <details className="felt-card rounded-xl p-4">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-widest text-zinc-300/80">
        Contabilidad · {summaries.length} jugadores
      </summary>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">
            Fichas en juego
          </p>
          <p className="text-lg font-bold tabular-nums">
            {formatCop(totalChipsInPlay)}
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">
            Movimiento neto
          </p>
          <p className="text-lg font-bold tabular-nums">
            {formatCop(totalNetMovement)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-zinc-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold">Jugador</th>
              <th className="px-2 py-1.5 text-right font-semibold">Balance</th>
              <th className="px-2 py-1.5 text-right font-semibold">Entradas</th>
              <th className="px-2 py-1.5 text-right font-semibold">Salidas</th>
              <th className="px-2 py-1.5 text-right font-semibold">Neto</th>
            </tr>
          </thead>
          <tbody>
            {summaries
              .sort((a, b) => b.balance - a.balance)
              .map((s) => (
                <tr
                  key={s.seat_id}
                  className="border-t border-white/5"
                >
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span>
                        #{s.seat_index} {s.nickname}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatCop(s.balance)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-emerald-300">
                    +{formatCop(s.totalIn)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-red-300">
                    -{formatCop(s.totalOut)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums font-semibold ${
                      s.net >= 0 ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {s.net >= 0 ? "+" : ""}
                    {formatCop(s.net)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-400">
          Evolución de balances
        </p>
        <div className="rounded-md border border-white/10 bg-black/40 p-3">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-40 w-full"
          >
            {/* Líneas de referencia */}
            <line
              x1="0"
              y1={(100 * domain.bMax) / (domain.bMax - domain.bMin)}
              x2="100"
              y2={(100 * domain.bMax) / (domain.bMax - domain.bMin)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="1,1"
              strokeWidth="0.4"
            />
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
            {summaries.map((s) => (
              <span
                key={s.seat_id}
                className="flex items-center gap-1.5 text-zinc-300"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.nickname}
              </span>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
