// Inline SVG line chart, no dependencies. Plots one value over time (used for
// top-set weight history). Scales to its container width via viewBox.

interface ChartPoint {
  date: string; // ISO
  value: number;
}

interface ChartProps {
  points: ChartPoint[];
  /** Unit shown on the y-axis labels, e.g. "lb". */
  unit?: string;
  height?: number;
}

const W = 320; // viewBox units; the SVG scales to 100% width
const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 20;

export function Chart({ points, unit = "", height = 140 }: ChartProps) {
  if (points.length < 2) {
    return <p className="dim small">Not enough history yet for a chart.</p>;
  }

  const H = height;
  const xs = points.map((p) => new Date(p.date).getTime());
  const ys = points.map((p) => p.value);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  // Pad the y-range a little so flat lines and the top point aren't on the edge.
  const yLo = yMin === yMax ? yMin - 5 : yMin - (yMax - yMin) * 0.1;
  const yHi = yMin === yMax ? yMax + 5 : yMax + (yMax - yMin) * 0.1;

  const px = (t: number) =>
    xMax === xMin
      ? PAD_L
      : PAD_L + ((t - xMin) / (xMax - xMin)) * (W - PAD_L - PAD_R);
  const py = (v: number) =>
    PAD_T + (1 - (v - yLo) / (yHi - yLo)) * (H - PAD_T - PAD_B);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${px(xs[i]).toFixed(1)} ${py(p.value).toFixed(1)}`)
    .join(" ");

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Weight over time, ${yMin}${unit} to ${yMax}${unit}`}
      preserveAspectRatio="none"
    >
      {/* y gridlines at min and max */}
      {[yMax, yMin].map((v) => (
        <g key={v}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={py(v)}
            y2={py(v)}
            className="chart-grid"
          />
          <text x={0} y={py(v) + 3} className="chart-axis">
            {v}
            {unit}
          </text>
        </g>
      ))}

      <path d={line} className="chart-line" fill="none" />

      {points.map((p, i) => (
        <circle key={i} cx={px(xs[i])} cy={py(p.value)} r={2.6} className="chart-dot" />
      ))}

      <text x={PAD_L} y={H - 6} className="chart-axis">
        {fmtDate(xMin)}
      </text>
      <text x={W - PAD_R} y={H - 6} textAnchor="end" className="chart-axis">
        {fmtDate(xMax)}
      </text>
    </svg>
  );
}
