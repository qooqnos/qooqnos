import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  formatDateRange,
  formatDateTime,
  formatMonth,
  formatNumber,
  formatYear,
  getDateAdapter,
  gregorianToHijri,
  gregorianToJalali,
  hijriToGregorian,
  jalaliToGregorian,
  localizeDigits,
  parseStandardIsoDate,
  toStandardIsoDate,
} from "./calendar";

describe("Calendar & Date Engine", () => {
  const referenceDate = new Date("2026-10-05T12:00:00Z");

  it("converts Gregorian to Jalali deterministically", () => {
    const jalali = gregorianToJalali(2026, 10, 5);
    expect(jalali).toEqual({ year: 1405, month: 7, day: 13 });

    const roundTrip = jalaliToGregorian(1405, 7, 13);
    expect(roundTrip).toEqual({ gy: 2026, gm: 10, gd: 5 });
  });

  it("converts Gregorian to Hijri accurately", () => {
    const hijri = gregorianToHijri(referenceDate);
    expect(hijri.year).toBe(1448);
    expect(hijri.month).toBe(4);
    expect(hijri.day).toBeGreaterThanOrEqual(23);
    expect(hijri.day).toBeLessThanOrEqual(25);

    const roundTrip = hijriToGregorian(hijri.year, hijri.month, hijri.day);
    expect(roundTrip.getUTCFullYear()).toBe(2026);
    expect(roundTrip.getUTCMonth() + 1).toBe(10);
  });

  it("formats dates according to active calendar and locale (Requirement 6 & 11)", () => {
    const faFormatted = formatDate(referenceDate, "fa");
    expect(faFormatted).toContain("مهر");
    expect(faFormatted).toContain("۱۴۰۵");
    expect(faFormatted).toContain("۱۳");

    const enFormatted = formatDate(referenceDate, "en");
    expect(enFormatted).toBe("October 5, 2026");

    const arFormatted = formatDate(referenceDate, "ar");
    expect(arFormatted).toContain("ربيع");
    expect(arFormatted).toContain("١٤٤٨");
  });

  it("formats date-times properly", () => {
    const fa = formatDateTime(referenceDate, "fa");
    expect(fa).toContain("مهر");
    const en = formatDateTime(referenceDate, "en");
    expect(en).toContain("October 5, 2026");
    const ar = formatDateTime(referenceDate, "ar");
    expect(ar).toContain("ربيع");
  });

  it("formats month and year headers correctly", () => {
    expect(formatMonth(referenceDate, "fa")).toContain("مهر");
    expect(formatYear(referenceDate, "fa")).toBe("۱۴۰۵");

    expect(formatMonth(referenceDate, "en")).toBe("October 2026");
    expect(formatYear(referenceDate, "en")).toBe("2026");

    expect(formatMonth(referenceDate, "ar")).toContain("ربيع");
    expect(formatYear(referenceDate, "ar")).toContain("١٤٤٨");
  });

  it("formats input values in calendar conventions", () => {
    expect(formatDateInput(referenceDate, "fa")).toBe("۱۴۰۵/۰۷/۱۳");
    expect(formatDateInput(referenceDate, "en")).toBe("2026-10-05");
    expect(formatDateInput(referenceDate, "ar")).toContain("١٤٤٨/");
  });

  it("localizes digits correctly", () => {
    expect(localizeDigits(12345, "fa")).toBe("۱۲۳۴۵");
    expect(localizeDigits(12345, "ar")).toBe("١٢٣٤٥");
    expect(localizeDigits(12345, "en")).toBe("12345");
  });

  it("formats numbers and currency correctly", () => {
    expect(formatNumber(1500000, "fa")).toContain("۱");
    expect(formatCurrency(250000, "IRR", "fa")).toContain("ریال");
    expect(formatCurrency(250000, "USD", "en")).toContain("USD");
  });

  it("provides DatePicker adapters with full MonthInfo", () => {
    const faAdapter = getDateAdapter("fa");
    const faMonth = faAdapter.getMonthInfo(1405, 7);
    expect(faMonth.monthName).toBe("مهر");
    expect(faMonth.daysInMonth).toBe(30);
    expect(faMonth.firstDayOfWeekIndex).toBeGreaterThanOrEqual(0);
    expect(faMonth.firstDayOfWeekIndex).toBeLessThan(7);
    expect(faAdapter.getWeekdays()).toHaveLength(7);
    expect(faAdapter.getWeekdays()[0]?.full).toBe("شنبه");

    const enAdapter = getDateAdapter("en");
    const enMonth = enAdapter.getMonthInfo(2026, 10);
    expect(enMonth.monthName).toBe("October");
    expect(enMonth.daysInMonth).toBe(31);
    expect(enAdapter.getWeekdays()[0]?.full).toBe("Sunday");

    const arAdapter = getDateAdapter("ar");
    const arMonth = arAdapter.getMonthInfo(1448, 4);
    expect(arMonth.monthName).toBe("ربيع الآخر");
    expect(arMonth.daysInMonth).toBeGreaterThanOrEqual(29);
    expect(arAdapter.getWeekdays()[0]?.full).toBe("السبت");
  });

  it("converts picker selection to standard ISO date (Requirement 10)", () => {
    const isoFromJalali = toStandardIsoDate({ year: 1405, month: 7, day: 13 }, "jalali");
    expect(isoFromJalali).toBe("2026-10-05");

    const parsedJalali = parseStandardIsoDate("2026-10-05", "jalali");
    expect(parsedJalali).toEqual({ year: 1405, month: 7, day: 13 });

    const isoFromGregorian = toStandardIsoDate({ year: 2026, month: 10, day: 5 }, "gregorian");
    expect(isoFromGregorian).toBe("2026-10-05");
  });

  it("formats date ranges smoothly", () => {
    const d1 = new Date("2026-10-05T10:00:00Z");
    const d2 = new Date("2026-10-07T10:00:00Z");
    expect(formatDateRange(d1, d2, "fa")).toContain("–");
    expect(formatDateRange(d1, d2, "en")).toBe("October 5, 2026 – October 7, 2026");
  });
});
