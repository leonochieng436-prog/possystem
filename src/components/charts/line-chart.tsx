type LineChartProps = {
  values: number[];
  labels: string[];
  valueLabel?: string;
};

export function LineChart({ values, labels, valueLabel = "Sales" }: LineChartProps) {
  const width = 720;
  const height = 260;
  const padding = { top: 20, right: 18, bottom: 34, left: 18 };
  const max = Math.max(...values, 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = values.map((value, index) => {
    const x = padding.left + (values.length === 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - (value / max) * chartHeight;
    return { x, y, value };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points.at(-1)?.x ?? padding.left},${padding.top + chartHeight} L${points[0]?.x ?? padding.left},${padding.top + chartHeight} Z`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{valueLabel}</span>
        <span className="font-tabular">{Math.max(...values, 0).toLocaleString()}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible" role="img" aria-label={`${valueLabel} trend`}>
        <defs>
          <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((step) => {
          const y = padding.top + chartHeight - step * chartHeight;
          return <line key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 5" />;
        })}
        <path d={area} fill="url(#sales-area)" />
        <path d={line} fill="none" stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {points.map((point, index) => <circle key={`${labels[index]}-${point.value}`} cx={point.x} cy={point.y} r="4" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2" />)}
        {labels.map((label, index) => <text key={label} x={points[index]?.x ?? 0} y={height - 8} textAnchor="middle" fill="var(--muted-foreground)" fontSize="11">{label}</text>)}
      </svg>
    </div>
  );
}
