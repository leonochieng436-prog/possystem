type PieSlice = { label: string; value: number; color: string };

type PieChartProps = {
  slices: PieSlice[];
  formatValue?: (value: number) => string;
};

export function PieChart({ slices, formatValue = (value) => value.toLocaleString() }: PieChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;
  const gradient = total > 0
    ? slices.map((slice) => {
        const start = (offset / total) * 100;
        offset += slice.value;
        return `${slice.color} ${start}% ${(offset / total) * 100}%`;
      }).join(", ")
    : "var(--surface-muted) 0% 100%";

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[150px_1fr]">
      <div className="mx-auto grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label="Comparison breakdown">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-surface text-center">
          <span className="font-tabular text-sm font-semibold">{formatValue(total)}</span>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {slices.map((slice) => {
          const share = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return <div key={slice.label} className="flex items-center justify-between gap-3 text-[12px]"><span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} /><span className="truncate">{slice.label}</span></span><span className="shrink-0 font-tabular text-muted-foreground">{share}%</span></div>;
        })}
        {slices.length === 0 && <p className="text-sm text-muted-foreground">No comparison data available.</p>}
      </div>
    </div>
  );
}
