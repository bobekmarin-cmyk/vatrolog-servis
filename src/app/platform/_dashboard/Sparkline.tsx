/**
 * Mali SVG sparkline (bez vanjske biblioteke). Prikazuje trend kroz N tocaka.
 * Sve scaling/path izracun je deterministican — moze biti i server-rendered.
 */

type Props = {
  values: number[];
  width?: number;
  height?: number;
  /** Tailwind klase za boju (npr. "text-emerald-500"). Default neutral. */
  className?: string;
  /** Aria label za citac ekrana (npr. "Trend zadnjih 30 dana: 5 prosjecno"). */
  ariaLabel?: string;
};

export function Sparkline({
  values,
  width = 80,
  height = 24,
  className = "text-slate-400",
  ariaLabel,
}: Props) {
  if (values.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={className}
        aria-hidden="true"
      >
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.5"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const path = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    `M0 ${height} ` +
    pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") +
    ` L${width} ${height} Z`;

  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
    >
      <path d={areaPath} fill="currentColor" opacity="0.15" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={1.8} fill="currentColor" />
    </svg>
  );
}
