import { buildIsoDate, getIsoDatePart, getLastDayOfMonth } from './date';

/**
 * Semi-monthly (biweekly) period model.
 *
 * Official financial closing is semi-monthly, not monthly:
 *  - H1 = day 1 through day 15
 *  - H2 = day 16 through the last day of the month (leap-year aware)
 *
 * Monthly views may still exist as management summaries, but the official
 * closing and distribution snapshots are keyed by semi-monthly period.
 */

export type PeriodHalf = 'H1' | 'H2';

export interface SemiMonthlyPeriod {
  periodType: 'semi_monthly';
  periodKey: string; // "2026-05-H1" | "2026-05-H2"
  monthKey: string; // "2026-05"
  half: PeriodHalf;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  label: string; // "May 1–15, 2026"
}

const pad2 = (value: number): string => value.toString().padStart(2, '0');

const monthKeyOf = (year: number, month: number): string => `${year}-${pad2(month)}`;

const monthLongName = (year: number, month: number): string =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

export const formatPeriodLabel = (period: SemiMonthlyPeriod): string => period.label;

export const getPeriodKey = (period: SemiMonthlyPeriod): string => period.periodKey;

/** Builds a fully-resolved semi-monthly period for a given month + half. */
export const buildSemiMonthlyPeriod = (
  year: number,
  month: number,
  half: PeriodHalf
): SemiMonthlyPeriod => {
  const lastDay = getLastDayOfMonth(year, month);
  const startDay = half === 'H1' ? 1 : 16;
  const endDay = half === 'H1' ? 15 : lastDay;
  const monthName = monthLongName(year, month);

  return {
    periodType: 'semi_monthly',
    periodKey: `${monthKeyOf(year, month)}-${half}`,
    monthKey: monthKeyOf(year, month),
    half,
    startDate: buildIsoDate(year, month, startDay),
    endDate: buildIsoDate(year, month, endDay),
    label: `${monthName} ${startDay}–${endDay}, ${year}`,
  };
};

/** Returns the semi-monthly period that contains the given date. */
export const getSemiMonthlyPeriodForDate = (date: string | Date): SemiMonthlyPeriod => {
  let year: number;
  let month: number;
  let day: number;

  if (date instanceof Date) {
    year = date.getUTCFullYear();
    month = date.getUTCMonth() + 1;
    day = date.getUTCDate();
  } else {
    const iso = getIsoDatePart(date);
    [year, month, day] = iso.split('-').map(Number);
  }

  const half: PeriodHalf = day <= 15 ? 'H1' : 'H2';
  return buildSemiMonthlyPeriod(year, month, half);
};

/** Returns both semi-monthly periods (H1, H2) for a month. */
export const getSemiMonthlyPeriodsForMonth = (
  year: number,
  month: number
): [SemiMonthlyPeriod, SemiMonthlyPeriod] => [
  buildSemiMonthlyPeriod(year, month, 'H1'),
  buildSemiMonthlyPeriod(year, month, 'H2'),
];

/** Returns the period containing "now". */
export const getCurrentSemiMonthlyPeriod = (now: Date = new Date()): SemiMonthlyPeriod => {
  // Use local wall-clock fields so the period matches the user's calendar day.
  return buildSemiMonthlyPeriod(now.getFullYear(), now.getMonth() + 1, now.getDate() <= 15 ? 'H1' : 'H2');
};

/** Returns the period immediately before the given period (defaults to current). */
export const getPreviousSemiMonthlyPeriod = (
  period: SemiMonthlyPeriod = getCurrentSemiMonthlyPeriod()
): SemiMonthlyPeriod => {
  const [year, month] = period.monthKey.split('-').map(Number);

  if (period.half === 'H2') {
    return buildSemiMonthlyPeriod(year, month, 'H1');
  }

  // H1 -> previous month's H2
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return buildSemiMonthlyPeriod(prevYear, prevMonth, 'H2');
};

/** Parses a periodKey ("2026-05-H1") back into a resolved period. */
export const getPeriodFromKey = (periodKey: string): SemiMonthlyPeriod | null => {
  const match = /^(\d{4})-(\d{2})-(H1|H2)$/.exec(periodKey);
  if (!match) return null;
  const [, year, month, half] = match;
  return buildSemiMonthlyPeriod(Number(year), Number(month), half as PeriodHalf);
};

/** Resolves a period from a month key ("2026-05") and half. */
export const getPeriodFromMonthAndHalf = (monthKey: string, half: PeriodHalf): SemiMonthlyPeriod => {
  const [year, month] = monthKey.split('-').map(Number);
  return buildSemiMonthlyPeriod(year, month, half);
};

/** Suggested PDF filename base (no extension) for a period closing report. */
export const getPeriodReportFileName = (period: SemiMonthlyPeriod): string =>
  `Onebridge-Period-Closing-${period.periodKey}`;

/** True if a transaction date (ISO) falls within the period, inclusive. */
export const isDateInPeriod = (date: string | undefined | null, period: SemiMonthlyPeriod): boolean => {
  if (!date) return false;
  const iso = getIsoDatePart(date);
  return iso >= period.startDate && iso <= period.endDate;
};
