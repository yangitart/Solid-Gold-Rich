import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  elapsedCalendarDays,
  elapsedComparisonBounds,
  inDateRange,
} from '../src/shared/domain/dates/dateRange';
import {
  periodBounds,
  previousPeriodBounds,
} from '../src/features/finance/domain/services/financeDomain';

test('previous weekly and monthly statistics compare the same elapsed portion', () => {
  const now = new Date(2026, 8, 23, 12);
  const currentWeek = periodBounds('week', now, 1);
  const week = elapsedComparisonBounds(currentWeek, previousPeriodBounds('week', currentWeek), now);
  assert.equal(week.start.getTime(), new Date(2026, 8, 14).getTime());
  assert.equal(week.end.getTime(), new Date(2026, 8, 16, 12).getTime());
  const currentMonth = periodBounds('month', now, 1);
  const month = elapsedComparisonBounds(
    currentMonth,
    previousPeriodBounds('month', currentMonth),
    now,
  );
  assert.equal(month.start.getTime(), new Date(2026, 7, 1).getTime());
  assert.equal(month.end.getTime(), new Date(2026, 7, 23, 12).getTime());
  assert.equal(inDateRange(new Date(2026, 8, 16, 11, 59).toISOString(), week), true);
  assert.equal(inDateRange(new Date(2026, 8, 16, 12).toISOString(), week), false);
});

test('daily averages use elapsed local calendar days, including the current day once', () => {
  const start = new Date(2026, 8, 21);
  const futureEnd = new Date(2026, 8, 28);
  assert.equal(elapsedCalendarDays({ start, end: futureEnd }, new Date(2026, 8, 23, 12)), 3);
  assert.equal(
    elapsedCalendarDays(
      { start: new Date(2026, 8, 1), end: new Date(2026, 10, 1) },
      new Date(2026, 9, 3, 12),
    ),
    33,
  );
  assert.equal(
    elapsedCalendarDays(
      { start: new Date(2026, 8, 24), end: futureEnd },
      new Date(2026, 8, 23, 12),
    ),
    0,
  );
});
