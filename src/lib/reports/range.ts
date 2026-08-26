export type ReportRangeKey = "today" | "week" | "month" | "custom";

export function getFirstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function resolveReportRange(
  rangeKey?: string | string[],
  fromParam?: string | string[],
  toParam?: string | string[]
) {
  const normalizedRange = (getFirstParam(rangeKey) ?? "month").toLowerCase();
  const now = new Date();

  const parseDate = (value: string | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const fromInput = parseDate(getFirstParam(fromParam));
  const toInput = parseDate(getFirstParam(toParam));

  let start: Date;
  let end: Date;
  let selected: ReportRangeKey = "month";

  if (normalizedRange === "today") {
    selected = "today";
    start = startOfDay(now);
    end = endOfDay(now);
  } else if (normalizedRange === "week") {
    selected = "week";
    const day = now.getDay();
    const diff = (day + 6) % 7;
    start = startOfDay(new Date(now));
    start.setDate(now.getDate() - diff);
    end = endOfDay(now);
  } else if (normalizedRange === "custom" && fromInput && toInput) {
    selected = "custom";
    start = startOfDay(fromInput);
    end = endOfDay(toInput);
  } else {
    selected = "month";
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = endOfDay(now);
  }

  if (start > end) {
    [start, end] = [end, start];
  }

  return {
    key: selected,
    start,
    end,
    label: selected === "month" ? "This month" : selected === "week" ? "This week" : selected === "today" ? "Today" : "Custom range",
  };
}

export function getPreviousRange(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start);
  previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return {
    start: previousStart,
    end: previousEnd,
  };
}
