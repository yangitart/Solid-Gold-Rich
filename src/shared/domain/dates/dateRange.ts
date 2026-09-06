export type DateRange = { start: Date; end: Date };

/** Half-open range: include the start, exclude the next period's first instant. */
export function inDateRange(date: string, range: DateRange) {
  const timestamp = new Date(date).getTime();
  return timestamp >= range.start.getTime() && timestamp < range.end.getTime();
}
