const ISO_DATE_NOON_SUFFIX = 'T12:00:00.000Z';

export const getIsoDatePart = (date?: string | null) => {
  if (!date) return '';
  return date.split('T')[0];
};

export const buildIsoDate = (year: number, month: number, day: number) => {
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

export const createStoredDate = (year: number, month: number, day: number) => {
  return `${buildIsoDate(year, month, day)}${ISO_DATE_NOON_SUFFIX}`;
};

export const serializeDateInput = (dateInput: string) => {
  if (!dateInput) return '';
  return `${dateInput}${ISO_DATE_NOON_SUFFIX}`;
};

export const formatDisplayDate = (date?: string | null) => {
  return getIsoDatePart(date);
};

export const getDateMonthPart = (date?: string | null) => {
  return getIsoDatePart(date).slice(0, 7);
};

export const getDateDayOfMonth = (date?: string | null) => {
  const isoDate = getIsoDatePart(date);
  if (!isoDate) return null;
  return Number(isoDate.slice(8, 10));
};

export const getLastDayOfMonth = (year: number, month: number) => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const getLocalMonthPart = (date: Date) => {
  return buildIsoDate(date.getFullYear(), date.getMonth() + 1, 1).slice(0, 7);
};
