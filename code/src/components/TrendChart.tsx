interface DataPoint {
  date: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  color: string;
  label: string;
  unit?: string;
  height?: number;
}

export default function TrendChart({ data, color, label, unit = "", height = 160 }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-6 text-[#555] text-xs">
        <p>暂无数据</p>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 20;
  const chartWidth = 600;
  const chartHeight = height - 40;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (chartWidth - padding * 2);
    const y = padding + (1 - (d.value - min) / range) * (chartHeight - padding * 2);
    return { x, y, value: d.value, date: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  const lastPoint = points[points.length - 1];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#888]">{label}</span>
        <span className="text-xs font-black" style={{ color }}>
          {lastPoint.value >= 1000 ? (lastPoint.value / 1000).toFixed(1) + "K" : lastPoint.value.toFixed(2)}
          {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${chartWidth} ${height}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line key={pct} x1={padding} y1={padding + (1 - pct) * (chartHeight - padding * 2)}
            x2={chartWidth - padding} y2={padding + (1 - pct) * (chartHeight - padding * 2)}
            stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        ))}

        {/* Area fill */}
        <path d={areaD} fill={`url(#grad-${label})`} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Last point dot */}
        <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill={color} />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="8" fill={color} opacity="0.2" />
      </svg>
    </div>
  );
}
