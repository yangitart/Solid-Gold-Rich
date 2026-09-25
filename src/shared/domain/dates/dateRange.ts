export type DateRange = { start: Date; end: Date };

/** Half-open range: include the start, exclude the next period's first instant. */
export function inDateRange(date: string, range: DateRange) {
  const timestamp = new Date(date).getTime();
  return timestamp >= range.start.getTime() && timestamp < range.end.getTime();
}

// Compare a period-to-date against the same elapsed part of the previous period.
export function elapsedComparisonBounds(
  current: DateRange,
  previous: DateRange,
  reference: Date,
): DateRange {
  const elapsed = Math.max(0, reference.getTime() - current.start.getTime());
  return {
    start: previous.start,
    end: new Date(Math.min(previous.end.getTime(), previous.start.getTime() + elapsed)),
  };
}

export function elapsedCalendarDays(range: DateRange, reference: Date) {
  const lastIncluded = Math.min(reference.getTime(), range.end.getTime() - 1);
  if (lastIncluded < range.start.getTime()) return 0;
  const start = new Date(range.start);
  const end = new Date(lastIncluded);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}
