import {
  buildPaymentSCurve,
  formatSCurveDate,
  type PaymentCair,
} from "@/lib/payment-scurve";
import { formatRupiah } from "@/lib/money";

type Props = {
  payments: PaymentCair[];
  /** Acuan 100% (kontrak / pekerjaan selesai) */
  baseline: number;
  baselineLabel?: string;
  className?: string;
};

/**
 * Mini kurva-S kumulatif pembayaran klien → Owner,
 * sumbu X = tanggal cair, Y = % dari acuan.
 */
export function PaymentSCurve({
  payments,
  baseline,
  baselineLabel = "kontrak",
  className = "",
}: Props) {
  const data = buildPaymentSCurve({ payments, baseline });
  const W = 360;
  const H = 148;
  const pad = { top: 16, right: 14, bottom: 28, left: 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  if (data.points.length === 0 || baseline <= 0) {
    return (
      <div
        className={`rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-4 py-3 ${className}`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Kurva pembayaran
          </h3>
          <span className="text-[11px] text-[var(--ink-faint)]">0%</span>
        </div>
        <p className="mt-1 text-xs text-[var(--ink-faint)]">
          Belum ada pembayaran klien tercatat.
        </p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-2 h-28 w-full"
          role="img"
          aria-label="Kurva pembayaran kosong"
        >
          <line
            x1={pad.left}
            y1={pad.top + innerH}
            x2={pad.left + innerW}
            y2={pad.top + innerH}
            stroke="var(--line-soft)"
            strokeWidth="1"
          />
          <line
            x1={pad.left}
            y1={pad.top}
            x2={pad.left}
            y2={pad.top + innerH}
            stroke="var(--line-soft)"
            strokeWidth="1"
          />
        </svg>
      </div>
    );
  }

  const yMax = Math.max(100, ...data.points.map((p) => p.percent), 1);
  const t0 = data.points[0].t;
  const t1 = data.points[data.points.length - 1].t;
  const tSpan = Math.max(t1 - t0, 1);

  const xOf = (t: number) => pad.left + ((t - t0) / tSpan) * innerW;
  const yOf = (pct: number) =>
    pad.top + innerH - (Math.min(pct, yMax) / yMax) * innerH;

  // Path tangga lembut (horizontal lalu vertikal) agar mirip kurva-S kumulatif
  const pathParts: string[] = [];
  data.points.forEach((p, i) => {
    const x = xOf(p.t);
    const y = yOf(p.percent);
    if (i === 0) {
      pathParts.push(`M ${x} ${y}`);
      return;
    }
    const prev = data.points[i - 1];
    const xPrev = xOf(prev.t);
    const yPrev = yOf(prev.percent);
    // naik vertikal di tanggal cair, lalu tahan sampai cair berikutnya
    pathParts.push(`L ${x} ${yPrev}`);
    pathParts.push(`L ${x} ${y}`);
  });
  const linePath = pathParts.join(" ");

  const last = data.points[data.points.length - 1];
  const areaPath = `${linePath} L ${xOf(last.t)} ${pad.top + innerH} L ${xOf(data.points[0].t)} ${pad.top + innerH} Z`;

  const yTicks = [0, 50, 100].filter((v) => v <= yMax + 0.01);
  if (yMax > 100 && !yTicks.includes(Math.round(yMax))) {
    yTicks.push(Math.round(yMax));
  }

  const cairMarks = data.points.filter((p) => p.amount > 0);

  return (
    <div
      className={`rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] px-4 py-3 ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Kurva pembayaran
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
            Kumulatif klien → Owner · % dari {baselineLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-[var(--accent)]">
            {data.finalPercent}%
          </p>
          <p className="text-[11px] tabular-nums text-[var(--ink-faint)]">
            {formatRupiah(data.totalPaid)}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 h-[7.5rem] w-full"
        role="img"
        aria-label={`Kurva pembayaran ${data.finalPercent} persen`}
      >
        <defs>
          <linearGradient id="scurveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* grid % */}
        {yTicks.map((tick) => {
          const y = yOf(tick);
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + innerW}
                y2={y}
                stroke="var(--line-soft)"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                textAnchor="end"
                fill="var(--ink-faint)"
                fontSize="9"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#scurveFill)" className="scurve-area" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="scurve-line"
        />

        {cairMarks.map((p) => (
          <circle
            key={`${p.t}-${p.cumulative}`}
            cx={xOf(p.t)}
            cy={yOf(p.percent)}
            r="3.2"
            fill="var(--surface)"
            stroke="var(--accent)"
            strokeWidth="1.6"
          >
            <title>
              {formatSCurveDate(p.date)} · {formatRupiah(p.amount)} ·{" "}
              {p.percent}%
            </title>
          </circle>
        ))}

        {data.startDate ? (
          <text
            x={pad.left}
            y={H - 8}
            fill="var(--ink-faint)"
            fontSize="9"
          >
            {formatSCurveDate(data.startDate)}
          </text>
        ) : null}
        {data.endDate &&
        data.startDate &&
        data.endDate.getTime() !== data.startDate.getTime() ? (
          <text
            x={pad.left + innerW}
            y={H - 8}
            textAnchor="end"
            fill="var(--ink-faint)"
            fontSize="9"
          >
            {formatSCurveDate(data.endDate)}
          </text>
        ) : null}
      </svg>

      <style>{`
        .scurve-line {
          stroke-dasharray: 480;
          stroke-dashoffset: 480;
          animation: scurve-draw 1.1s ease-out forwards;
        }
        .scurve-area {
          opacity: 0;
          animation: scurve-fade 0.6s ease-out 0.35s forwards;
        }
        @keyframes scurve-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes scurve-fade {
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .scurve-line, .scurve-area { animation: none; stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
