// ============================================================================
// PHOENIX CENTRAL CALENDAR & DATE ENGINE
// ============================================================================

import type { Locale, SupportedLanguage } from "./i18n-runtime.js";

export type CalendarType = "jalali" | "gregorian" | "hijri";

export interface CalendarDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

export interface WeekdayInfo {
  readonly short: string;
  readonly full: string;
}

export interface MonthInfo {
  readonly year: number;
  readonly month: number;
  readonly monthName: string;
  readonly yearLabel: string;
  readonly daysInMonth: number;
  readonly firstDayOfWeekIndex: number; // 0..6 relative to the calendar's weekdays
}

export interface DateAdapter {
  readonly calendarType: CalendarType;
  readonly locale: Locale;
  toCalendarDate(date: Date): CalendarDateParts;
  fromCalendarDate(parts: CalendarDateParts): Date;
  getMonthInfo(year: number, month: number): MonthInfo;
  getWeekdays(): readonly WeekdayInfo[];
  getMonthNames(): readonly string[];
  formatDate(date: Date): string;
  formatDateTime(date: Date): string;
  formatMonth(date: Date): string;
  formatYear(date: Date): string;
  formatInput(date: Date): string;
  localizeDigits(value: string | number): string;
  getToday(): CalendarDateParts;
}

// ----------------------------------------------------------------------------
// Jalali (Solar Hijri) Mathematical Algorithms
// ----------------------------------------------------------------------------

export function isLeapJalaliYear(jy: number): boolean {
  return (((jy - (jy > 0 ? 474 : 473)) % 2820) + 474 + 38) * 682 % 2816 < 682;
}

export function jalaliDaysInMonth(jy: number, jm: number): number {
  if (jm < 1 || jm > 12) return 30;
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

export function gregorianToJalali(gy: number, gm: number, gd: number): CalendarDateParts {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + (g_d_m[gm - 1] ?? 0);
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy = jy <= 979 ? 621 : 1600;
  const adjJy = jy - (jy <= 979 ? 0 : 979);
  let days = 365 * adjJy + Math.floor(adjJy / 33) * 8 + Math.floor(((adjJy % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && days >= (sal_a[gm] ?? 0)) {
    days -= sal_a[gm] ?? 0;
    gm++;
  }
  return { gy, gm, gd: days + 1 };
}

// ----------------------------------------------------------------------------
// Hijri (Islamic Lunar) Algorithms
// ----------------------------------------------------------------------------

const intlIslamicParts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

export function gregorianToHijri(date: Date): CalendarDateParts {
  const parts = intlIslamicParts.formatToParts(date);
  let year = 1448;
  let month = 1;
  let day = 1;
  for (const part of parts) {
    if (part.type === "year") year = parseInt(part.value, 10);
    if (part.type === "month") month = parseInt(part.value, 10);
    if (part.type === "day") day = parseInt(part.value, 10);
  }
  return { year, month, day };
}

export function hijriToGregorian(hy: number, hm: number, hd: number): Date {
  const approxYear = 622 + Math.floor(hy * 0.970224);
  let testDate = new Date(Date.UTC(approxYear, Math.max(0, hm - 1), Math.max(1, hd)));
  let cur = gregorianToHijri(testDate);
  const diffDays = (hy - cur.year) * 354 + (hm - cur.month) * 29 + (hd - cur.day);
  testDate = new Date(testDate.getTime() + diffDays * 86400000);
  cur = gregorianToHijri(testDate);

  let guard = 0;
  while ((cur.year !== hy || cur.month !== hm || cur.day !== hd) && guard++ < 35) {
    let dayStep = (hy - cur.year) * 354 + (hm - cur.month) * 29 + (hd - cur.day);
    if (dayStep === 0) dayStep = cur.day < hd ? 1 : -1;
    testDate = new Date(testDate.getTime() + (dayStep > 0 ? 1 : -1) * 86400000);
    cur = gregorianToHijri(testDate);
  }
  return new Date(Date.UTC(testDate.getUTCFullYear(), testDate.getUTCMonth(), testDate.getUTCDate()));
}

export function hijriDaysInMonth(hy: number, hm: number): number {
  const m1 = hijriToGregorian(hy, hm, 1);
  const nextMonth = hm === 12 ? 1 : hm + 1;
  const nextYear = hm === 12 ? hy + 1 : hy;
  const m2 = hijriToGregorian(nextYear, nextMonth, 1);
  const diff = Math.round((m2.getTime() - m1.getTime()) / 86400000);
  return diff >= 29 && diff <= 30 ? diff : 30;
}

// ----------------------------------------------------------------------------
// Month & Weekday Constants
// ----------------------------------------------------------------------------

export const JALALI_MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
] as const;

export const JALALI_WEEKDAYS: readonly WeekdayInfo[] = [
  { short: "ش", full: "شنبه" },
  { short: "ی", full: "یکشنبه" },
  { short: "د", full: "دوشنبه" },
  { short: "س", full: "سه‌شنبه" },
  { short: "چ", full: "چهارشنبه" },
  { short: "پ", full: "پنج‌شنبه" },
  { short: "ج", full: "جمعه" },
] as const;

export const GREGORIAN_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const GREGORIAN_WEEKDAYS: readonly WeekdayInfo[] = [
  { short: "Sun", full: "Sunday" },
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
  { short: "Sat", full: "Saturday" },
] as const;

export const HIJRI_MONTH_NAMES = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
] as const;

export const HIJRI_WEEKDAYS: readonly WeekdayInfo[] = [
  { short: "سبت", full: "السبت" },
  { short: "أحد", full: "الأحد" },
  { short: "اثنين", full: "الاثنين" },
  { short: "ثلاثاء", full: "الثلاثاء" },
  { short: "أربعاء", full: "الأربعاء" },
  { short: "خميس", full: "الخميس" },
  { short: "جمعة", full: "الجمعة" },
] as const;

// ----------------------------------------------------------------------------
// Digit Localization
// ----------------------------------------------------------------------------

export function localizeDigits(value: string | number, locale: Locale): string {
  const str = String(value);
  if (locale === "fa") {
    return str.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)] ?? d);
  }
  if (locale === "ar") {
    return str.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);
  }
  return str;
}

// ----------------------------------------------------------------------------
// Adapters
// ----------------------------------------------------------------------------

export class JalaliAdapter implements DateAdapter {
  readonly calendarType = "jalali" as const;
  readonly locale: Locale = "fa";

  toCalendarDate(date: Date): CalendarDateParts {
    return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  fromCalendarDate(parts: CalendarDateParts): Date {
    const { gy, gm, gd } = jalaliToGregorian(parts.year, parts.month, parts.day);
    return new Date(gy, gm - 1, gd, 12, 0, 0);
  }

  getMonthInfo(year: number, month: number): MonthInfo {
    const daysInMonth = jalaliDaysInMonth(year, month);
    const monthName = JALALI_MONTH_NAMES[month - 1] ?? "";
    const firstDate = this.fromCalendarDate({ year, month, day: 1 });
    const firstDayOfWeekIndex = (firstDate.getDay() + 1) % 7;
    return {
      year,
      month,
      monthName,
      yearLabel: this.localizeDigits(year),
      daysInMonth,
      firstDayOfWeekIndex,
    };
  }

  getWeekdays(): readonly WeekdayInfo[] {
    return JALALI_WEEKDAYS;
  }

  getMonthNames(): readonly string[] {
    return JALALI_MONTH_NAMES;
  }

  formatDate(date: Date): string {
    const p = this.toCalendarDate(date);
    const mName = JALALI_MONTH_NAMES[p.month - 1] ?? "";
    return `${this.localizeDigits(p.day)} ${mName} ${this.localizeDigits(p.year)}`;
  }

  formatDateTime(date: Date): string {
    const dStr = this.formatDate(date);
    const hours = this.localizeDigits(String(date.getHours()).padStart(2, "0"));
    const minutes = this.localizeDigits(String(date.getMinutes()).padStart(2, "0"));
    return `${dStr}، ${hours}:${minutes}`;
  }

  formatMonth(date: Date): string {
    const p = this.toCalendarDate(date);
    const mName = JALALI_MONTH_NAMES[p.month - 1] ?? "";
    return `${mName} ${this.localizeDigits(p.year)}`;
  }

  formatYear(date: Date): string {
    const p = this.toCalendarDate(date);
    return this.localizeDigits(p.year);
  }

  formatInput(date: Date): string {
    const p = this.toCalendarDate(date);
    const y = this.localizeDigits(p.year);
    const m = this.localizeDigits(String(p.month).padStart(2, "0"));
    const d = this.localizeDigits(String(p.day).padStart(2, "0"));
    return `${y}/${m}/${d}`;
  }

  localizeDigits(value: string | number): string {
    return localizeDigits(value, "fa");
  }

  getToday(): CalendarDateParts {
    return this.toCalendarDate(new Date());
  }
}

export class GregorianAdapter implements DateAdapter {
  readonly calendarType = "gregorian" as const;
  readonly locale: Locale = "en";

  toCalendarDate(date: Date): CalendarDateParts {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  fromCalendarDate(parts: CalendarDateParts): Date {
    return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  }

  getMonthInfo(year: number, month: number): MonthInfo {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthName = GREGORIAN_MONTH_NAMES[month - 1] ?? "";
    const firstDate = new Date(year, month - 1, 1);
    const firstDayOfWeekIndex = firstDate.getDay();
    return {
      year,
      month,
      monthName,
      yearLabel: String(year),
      daysInMonth,
      firstDayOfWeekIndex,
    };
  }

  getWeekdays(): readonly WeekdayInfo[] {
    return GREGORIAN_WEEKDAYS;
  }

  getMonthNames(): readonly string[] {
    return GREGORIAN_MONTH_NAMES;
  }

  formatDate(date: Date): string {
    const p = this.toCalendarDate(date);
    const mName = GREGORIAN_MONTH_NAMES[p.month - 1] ?? "";
    return `${mName} ${p.day}, ${p.year}`;
  }

  formatDateTime(date: Date): string {
    const dStr = this.formatDate(date);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${dStr}, ${hours}:${minutes}`;
  }

  formatMonth(date: Date): string {
    const p = this.toCalendarDate(date);
    const mName = GREGORIAN_MONTH_NAMES[p.month - 1] ?? "";
    return `${mName} ${p.year}`;
  }

  formatYear(date: Date): string {
    return String(date.getFullYear());
  }

  formatInput(date: Date): string {
    const p = this.toCalendarDate(date);
    const m = String(p.month).padStart(2, "0");
    const d = String(p.day).padStart(2, "0");
    return `${p.year}-${m}-${d}`;
  }

  localizeDigits(value: string | number): string {
    return String(value);
  }

  getToday(): CalendarDateParts {
    return this.toCalendarDate(new Date());
  }
}

export class HijriAdapter implements DateAdapter {
  readonly calendarType = "hijri" as const;
  readonly locale: Locale = "ar";

  toCalendarDate(date: Date): CalendarDateParts {
    return gregorianToHijri(date);
  }

  fromCalendarDate(parts: CalendarDateParts): Date {
    return hijriToGregorian(parts.year, parts.month, parts.day);
  }

  getMonthInfo(year: number, month: number): MonthInfo {
    const daysInMonth = hijriDaysInMonth(year, month);
    const monthName = HIJRI_MONTH_NAMES[month - 1] ?? "";
    const firstDate = this.fromCalendarDate({ year, month, day: 1 });
    const firstDayOfWeekIndex = (firstDate.getDay() + 1) % 7;
    return {
      year,
      month,
      monthName,
      yearLabel: this.localizeDigits(year),
      daysInMonth,
      firstDayOfWeekIndex,
    };
  }

  getWeekdays(): readonly WeekdayInfo[] {
    return HIJRI_WEEKDAYS;
  }

  getMonthNames(): readonly string[] {
    return HIJRI_MONTH_NAMES;
  }

  formatDate(date: Date): string {
    const p = this.toCalendarDate(date);
    const mName = HIJRI_MONTH_NAMES[p.month - 1] ?? "";
    return `${this.localizeDigits(p.day)} ${mName} ${this.localizeDigits(p.year)}`;
  }

  formatDateTime(date: Date): string {
    const dStr = this.formatDate(date);
    const hours = this.localizeDigits(String(date.getHours()).padStart(2, "0"));
    const minutes = this.localizeDigits(String(date.getMinutes()).padStart(2, "0"));
    return `${dStr}، ${hours}:${minutes}`;
  }

  formatMonth(date: Date): string {
    const p = this.toCalendarDate(date);
    const mName = HIJRI_MONTH_NAMES[p.month - 1] ?? "";
    return `${mName} ${this.localizeDigits(p.year)}`;
  }

  formatYear(date: Date): string {
    const p = this.toCalendarDate(date);
    return this.localizeDigits(p.year);
  }

  formatInput(date: Date): string {
    const p = this.toCalendarDate(date);
    const y = this.localizeDigits(p.year);
    const m = this.localizeDigits(String(p.month).padStart(2, "0"));
    const d = this.localizeDigits(String(p.day).padStart(2, "0"));
    return `${y}/${m}/${d}`;
  }

  localizeDigits(value: string | number): string {
    return localizeDigits(value, "ar");
  }

  getToday(): CalendarDateParts {
    return this.toCalendarDate(new Date());
  }
}

// ----------------------------------------------------------------------------
// Adapter Singletons & Factory
// ----------------------------------------------------------------------------

export function getCalendarType(locale: Locale): CalendarType {
  switch (locale) {
    case "fa":
      return "jalali";
    case "ar":
      return "hijri";
    case "en":
    default:
      return "gregorian";
  }
}

const jalaliAdapter = new JalaliAdapter();
const gregorianAdapter = new GregorianAdapter();
const hijriAdapter = new HijriAdapter();

export function getDateAdapter(locale: Locale): DateAdapter {
  switch (locale) {
    case "fa":
      return jalaliAdapter;
    case "ar":
      return hijriAdapter;
    case "en":
    default:
      return gregorianAdapter;
  }
}

// Global active locale reference (set by LocaleService)
let activeLocale: SupportedLanguage = "fa";

export function setActiveCalendarLocale(locale: SupportedLanguage): void {
  activeLocale = locale;
}

export function getActiveCalendarLocale(): SupportedLanguage {
  return activeLocale;
}

// ----------------------------------------------------------------------------
// Central Date Formatting System (Requirement 11)
// ----------------------------------------------------------------------------

function parseDateInput(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: Date | string | number | null | undefined, locale?: Locale): string {
  const loc = locale ?? activeLocale;
  const date = parseDateInput(value);
  if (!date) return "—";
  return getDateAdapter(loc).formatDate(date);
}

export function formatDateTime(value: Date | string | number | null | undefined, locale?: Locale): string {
  const loc = locale ?? activeLocale;
  const date = parseDateInput(value);
  if (!date) return "—";
  return getDateAdapter(loc).formatDateTime(date);
}

export function formatMonth(value: Date | string | number | null | undefined, locale?: Locale): string {
  const loc = locale ?? activeLocale;
  const date = parseDateInput(value);
  if (!date) return "—";
  return getDateAdapter(loc).formatMonth(date);
}

export function formatYear(value: Date | string | number | null | undefined, locale?: Locale): string {
  const loc = locale ?? activeLocale;
  const date = parseDateInput(value);
  if (!date) return "—";
  return getDateAdapter(loc).formatYear(date);
}

export function formatDateInput(value: Date | string | number | null | undefined, locale?: Locale): string {
  const loc = locale ?? activeLocale;
  const date = parseDateInput(value);
  if (!date) return "";
  return getDateAdapter(loc).formatInput(date);
}

export function formatDateRange(
  start: Date | string | number | null | undefined,
  end: Date | string | number | null | undefined,
  locale?: Locale,
): string {
  const loc = locale ?? activeLocale;
  const d1 = parseDateInput(start);
  const d2 = parseDateInput(end);
  if (!d1 && !d2) return "—";
  if (d1 && !d2) return formatDate(d1, loc);
  if (!d1 && d2) return formatDate(d2, loc);
  const adapter = getDateAdapter(loc);
  return `${adapter.formatDate(d1!)} – ${adapter.formatDate(d2!)}`;
}

export function formatRelativeDate(value: Date | string | number | null | undefined, locale?: Locale): string {
  const loc = locale ?? activeLocale;
  const date = parseDateInput(value);
  if (!date) return "—";
  const now = Date.now();
  const diffSec = Math.round((date.getTime() - now) / 1000);
  const diffDays = Math.round(diffSec / 86400);

  if (Math.abs(diffSec) < 60) {
    if (loc === "fa") return "همین الان";
    if (loc === "ar") return "الآن";
    return "just now";
  }

  const intlLocale = loc === "fa" ? "fa-IR" : loc === "ar" ? "ar-SA" : "en-US";
  try {
    const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
    if (Math.abs(diffDays) >= 1) {
      return rtf.format(diffDays, "day");
    }
    const diffHours = Math.round(diffSec / 3600);
    if (Math.abs(diffHours) >= 1) {
      return rtf.format(diffHours, "hour");
    }
    const diffMinutes = Math.round(diffSec / 60);
    return rtf.format(diffMinutes, "minute");
  } catch {
    return formatDate(date, loc);
  }
}

export function formatNumber(value: number | string, locale?: Locale): string {
  const loc = locale ?? activeLocale;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  const intlLocale = loc === "fa" ? "fa-IR" : loc === "ar" ? "ar-EG" : "en-US";
  return num.toLocaleString(intlLocale);
}

export function formatCurrency(amountMinor: number, currency = "IRR", locale?: Locale): string {
  const loc = locale ?? activeLocale;
  const amount = amountMinor / 100;
  if (loc === "fa") {
    const localized = localizeDigits(amount.toLocaleString("fa-IR"), "fa");
    if (currency === "IRR") return `${localized} ریال`;
    if (currency === "IRT") return `${localized} تومان`;
    return `${localized} ${currency}`;
  }
  if (loc === "ar") {
    const localized = localizeDigits(amount.toLocaleString("ar-EG"), "ar");
    if (currency === "IRR" || currency === "SAR") return `${localized} ر.س`;
    return `${localized} ${currency}`;
  }
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// ----------------------------------------------------------------------------
// Conversion between ISO (Storage) and Calendar (Requirement 9 & 10)
// ----------------------------------------------------------------------------

export function toStandardIsoDate(parts: CalendarDateParts, calendar: CalendarType): string {
  let date: Date;
  if (calendar === "jalali") {
    const { gy, gm, gd } = jalaliToGregorian(parts.year, parts.month, parts.day);
    date = new Date(Date.UTC(gy, gm - 1, gd));
  } else if (calendar === "hijri") {
    date = hijriToGregorian(parts.year, parts.month, parts.day);
  } else {
    date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseStandardIsoDate(isoStr: string, calendar: CalendarType): CalendarDateParts | null {
  const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const y = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  const d = parseInt(match[3]!, 10);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (calendar === "jalali") {
    return gregorianToJalali(y, m, d);
  }
  if (calendar === "hijri") {
    return gregorianToHijri(date);
  }
  return { year: y, month: m, day: d };
}
