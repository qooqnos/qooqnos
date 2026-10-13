import { beforeEach, describe, expect, it } from "vitest";
import { globalLocaleService } from "./locale-service.js";
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  formatDateRange,
  formatDateTime,
  formatMonth,
  formatNumber,
  formatRelativeDate,
  formatYear,
  getCalendarType,
  getDateAdapter,
  gregorianToHijri,
  gregorianToJalali,
  hijriToGregorian,
  jalaliToGregorian,
  localizeDigits,
  parseStandardIsoDate,
  setActiveCalendarLocale,
  toStandardIsoDate,
} from "./calendar-service.js";
import { defaultI18n, getDirection, translateUiText } from "./i18n-runtime.js";

// Setup browser globals mock for vitest Node environment
const storageMap = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

const mockElement = {
  lang: "fa",
  dir: "rtl",
  dataset: {} as Record<string, string>,
};

(globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = { localStorage: mockStorage };
(globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
(globalThis as unknown as { document: { documentElement: typeof mockElement } }).document = { documentElement: mockElement };

describe("Phoenix Multilingual & Global Locale System", () => {
  beforeEach(() => {
    storageMap.clear();
    mockElement.lang = "fa";
    mockElement.dir = "rtl";
    mockElement.dataset = {};
    // Default to Persian
    globalLocaleService.setLocale("fa");
  });

  describe("1. Default Language & Initialization (Requirement 1 & 4)", () => {
    it("defaults strictly to Persian (fa) when no prior preference exists", () => {
      mockStorage.removeItem("qooqnos.locale");
      const initial = globalLocaleService.initLocale();
      expect(initial).toBe("fa");
      expect(globalLocaleService.getLocale()).toBe("fa");
      expect(mockElement.lang).toBe("fa");
      expect(mockElement.dir).toBe("rtl");
      expect(mockElement.dataset.calendar).toBe("jalali");
    });

    it("respects previously stored explicit user preference", () => {
      mockStorage.setItem("qooqnos.locale", "en");
      const initial = globalLocaleService.initLocale();
      expect(initial).toBe("en");
      expect(mockElement.lang).toBe("en");
      expect(mockElement.dir).toBe("ltr");
      expect(mockElement.dataset.calendar).toBe("gregorian");
    });

    it("falls back strictly to fa if stored value is invalid", () => {
      mockStorage.setItem("qooqnos.locale", "invalid-lang");
      const initial = globalLocaleService.initLocale();
      expect(initial).toBe("fa");
      expect(globalLocaleService.getLocale()).toBe("fa");
    });
  });

  describe("2. Single Source of Truth for Locale (Requirement 3)", () => {
    it("updates global state, document attributes, dictionary, and listeners", () => {
      let notifiedLocale = "";
      const unsub = globalLocaleService.subscribe((locale) => {
        notifiedLocale = locale;
      });

      globalLocaleService.setLocale("ar");
      expect(globalLocaleService.getLocale()).toBe("ar");
      expect(mockStorage.getItem("qooqnos.locale")).toBe("ar");
      expect(mockElement.lang).toBe("ar");
      expect(mockElement.dir).toBe("rtl");
      expect(mockElement.dataset.calendar).toBe("hijri");
      expect(defaultI18n.getLanguage()).toBe("ar");
      expect(notifiedLocale).toBe("ar");

      globalLocaleService.setLocale("en");
      expect(globalLocaleService.getLocale()).toBe("en");
      expect(mockStorage.getItem("qooqnos.locale")).toBe("en");
      expect(mockElement.lang).toBe("en");
      expect(mockElement.dir).toBe("ltr");
      expect(mockElement.dataset.calendar).toBe("gregorian");
      expect(defaultI18n.getLanguage()).toBe("en");
      expect(notifiedLocale).toBe("en");

      unsub();
    });
  });

  describe("3. Calendar by Language (Requirement 5 & 6)", () => {
    const referenceDate = new Date("2026-10-05T12:00:00Z");

    it("maps locale to correct calendar type", () => {
      expect(getCalendarType("fa")).toBe("jalali");
      expect(getCalendarType("en")).toBe("gregorian");
      expect(getCalendarType("ar")).toBe("hijri");
    });

    it("displays Persian / Jalali calendar for Persian locale (fa)", () => {
      setActiveCalendarLocale("fa");
      const formatted = formatDate(referenceDate, "fa");
      expect(formatted).toContain("مهر");
      expect(formatted).toContain("۱۴۰۵");
      expect(formatted).toContain("۱۳");
      expect(formatDateInput(referenceDate, "fa")).toBe("۱۴۰۵/۰۷/۱۳");
      expect(formatYear(referenceDate, "fa")).toBe("۱۴۰۵");
    });

    it("displays Gregorian calendar for English locale (en)", () => {
      setActiveCalendarLocale("en");
      const formatted = formatDate(referenceDate, "en");
      expect(formatted).toBe("October 5, 2026");
      expect(formatDateInput(referenceDate, "en")).toBe("2026-10-05");
      expect(formatYear(referenceDate, "en")).toBe("2026");
    });

    it("displays Hijri Islamic lunar calendar for Arabic locale (ar)", () => {
      setActiveCalendarLocale("ar");
      const formatted = formatDate(referenceDate, "ar");
      expect(formatted).toContain("ربيع");
      expect(formatted).toContain("١٤٤٨");
      expect(formatYear(referenceDate, "ar")).toContain("١٤٤٨");
    });
  });

  describe("4. Central Date Picker Adapters & Storage Conversion (Requirement 7, 8, 9, 10)", () => {
    it("provides Jalali adapter with correct month info and Persian weekdays", () => {
      const adapter = getDateAdapter("fa");
      const monthInfo = adapter.getMonthInfo(1405, 7);
      expect(monthInfo.monthName).toBe("مهر");
      expect(monthInfo.daysInMonth).toBe(30);
      expect(adapter.getWeekdays()).toHaveLength(7);
      expect(adapter.getWeekdays()[0]?.full).toBe("شنبه");
      expect(adapter.getWeekdays()[6]?.full).toBe("جمعه");
    });

    it("provides Hijri adapter with correct Islamic lunar month info and Arabic weekdays", () => {
      const adapter = getDateAdapter("ar");
      const monthInfo = adapter.getMonthInfo(1448, 4);
      expect(monthInfo.monthName).toBe("ربيع الآخر");
      expect(monthInfo.daysInMonth).toBeGreaterThanOrEqual(29);
      expect(adapter.getWeekdays()).toHaveLength(7);
      expect(adapter.getWeekdays()[0]?.full).toBe("السبت");
    });

    it("provides Gregorian adapter with English months and Sunday-first weekdays", () => {
      const adapter = getDateAdapter("en");
      const monthInfo = adapter.getMonthInfo(2026, 10);
      expect(monthInfo.monthName).toBe("October");
      expect(monthInfo.daysInMonth).toBe(31);
      expect(adapter.getWeekdays()[0]?.full).toBe("Sunday");
    });

    it("converts Jalali date selection to standard ISO internal date for backend storage", () => {
      const iso = toStandardIsoDate({ year: 1405, month: 7, day: 13 }, "jalali");
      expect(iso).toBe("2026-10-05");

      const parsed = parseStandardIsoDate("2026-10-05", "jalali");
      expect(parsed).toEqual({ year: 1405, month: 7, day: 13 });
    });

    it("converts Gregorian date selection to standard ISO internal date", () => {
      const iso = toStandardIsoDate({ year: 2026, month: 10, day: 5 }, "gregorian");
      expect(iso).toBe("2026-10-05");

      const parsed = parseStandardIsoDate("2026-10-05", "gregorian");
      expect(parsed).toEqual({ year: 2026, month: 10, day: 5 });
    });
  });

  describe("5. Central Date & Number Formatting System (Requirement 11)", () => {
    const referenceDate = new Date("2026-10-05T14:30:00Z");

    it("formats date, datetime, month, and year across locales", () => {
      expect(formatDate(referenceDate, "fa")).toContain("مهر ۱۴۰۵");
      expect(formatDateTime(referenceDate, "fa")).toContain("۱۴۰۵");

      expect(formatDate(referenceDate, "en")).toBe("October 5, 2026");
      expect(formatDateTime(referenceDate, "en")).toContain("October 5, 2026");

      expect(formatDate(referenceDate, "ar")).toContain("١٤٤٨");
      expect(formatDateTime(referenceDate, "ar")).toContain("١٤٤٨");
    });

    it("formats date ranges properly", () => {
      const d1 = new Date("2026-10-05T10:00:00Z");
      const d2 = new Date("2026-10-08T10:00:00Z");
      expect(formatDateRange(d1, d2, "fa")).toContain("–");
      expect(formatDateRange(d1, d2, "en")).toBe("October 5, 2026 – October 8, 2026");
    });

    it("formats month, relative dates, and digit localization properly", () => {
      const referenceDate = new Date("2026-10-05T12:00:00Z");
      expect(formatMonth(referenceDate, "fa")).toContain("مهر");
      expect(formatMonth(referenceDate, "en")).toContain("October");
      expect(formatMonth(referenceDate, "ar")).toBeTruthy();

      expect(formatRelativeDate(referenceDate, "fa")).toBeTruthy();
      expect(formatRelativeDate(referenceDate, "en")).toBeTruthy();
      expect(formatRelativeDate(referenceDate, "ar")).toBeTruthy();

      expect(localizeDigits(12345, "fa")).toBe("۱۲۳۴۵");
      expect(localizeDigits(12345, "ar")).toBe("١٢٣٤٥");
      expect(localizeDigits(12345, "en")).toBe("12345");

      expect(getDirection("fa")).toBe("rtl");
      expect(getDirection("ar")).toBe("rtl");
      expect(getDirection("en")).toBe("ltr");
    });

    it("verifies bidirectional calendar coordinate conversions", () => {
      const j = gregorianToJalali(2026, 10, 5);
      expect(j.year).toBe(1405);
      expect(j.month).toBe(7);
      expect(j.day).toBe(13);

      const gFromJ = jalaliToGregorian(j.year, j.month, j.day);
      expect(gFromJ.gy).toBe(2026);
      expect(gFromJ.gm).toBe(10);
      expect(gFromJ.gd).toBe(5);

      const testDate = new Date("2026-10-05T00:00:00Z");
      const h = gregorianToHijri(testDate);
      expect(h.year).toBe(1448);
      const gFromH = hijriToGregorian(h.year, h.month, h.day);
      expect(gFromH.getUTCFullYear()).toBe(2026);
      expect(gFromH.getUTCMonth() + 1).toBe(10);
    });

    it("formats numbers and currency cleanly", () => {
      expect(formatNumber(1250000, "fa")).toContain("۱");
      expect(formatNumber(1250000, "en")).toBe("1,250,000");
      expect(formatCurrency(500000, "IRR", "fa")).toContain("ریال");
      expect(formatCurrency(500000, "USD", "en")).toContain("USD");
    });
  });

  describe("6. Complete UI Translation Parity (Requirement 2 & 3)", () => {
    it("translates all navigation, sidebar, and shell strings cleanly to Arabic and English", () => {
      const items = [
        { fa: "تجربه کاربری و خرید", ar: "تجربة المستخدم والتسوق", en: "User Experience & Shopping" },
        { fa: "کسب‌وکار و عملیات", ar: "الأعمال والعمليات", en: "Business & Operations" },
        { fa: "سیستم و تنظیمات", ar: "النظام والإعدادات", en: "System & Settings" },
        { fa: "فضای کسب‌وکار", ar: "مساحة الأعمال", en: "Business Hub" },
        { fa: "نوبت‌ها و تقویم", ar: "المواعيد والتقويم", en: "Appointments & Calendar" },
        { fa: "فضای شما", ar: "مساحتك", en: "Your Workspace" },
        { fa: "پوسته برنامه ققنوس", ar: "هيكل تطبيق ققنوس", en: "Phoenix Application Shell" },
        { fa: "ناوبری اصلی", ar: "التنقل الرئيسي", en: "Main Navigation" },
        { fa: "امروز", ar: "اليوم", en: "Today" },
        { fa: "انتخاب تاریخ", ar: "اختر التاريخ", en: "Select date" },
      ];

      for (const item of items) {
        expect(translateUiText(item.fa, "ar")).toBe(item.ar);
        expect(translateUiText(item.fa, "en")).toBe(item.en);
      }
    });
  });
});
