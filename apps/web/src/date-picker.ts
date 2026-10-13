// ============================================================================
// PHOENIX CENTRAL DATE PICKER COMPONENT
// ============================================================================

import {
  getDateAdapter,
  toStandardIsoDate,
  parseStandardIsoDate,
  formatDate,
  type CalendarDateParts,
} from "./calendar-service.js";
import { globalLocaleService } from "./locale-service.js";
import { defaultI18n } from "./i18n-runtime.js";

export interface DatePickerOptions {
  initialDate?: Date | string | null;
  minDate?: Date | string | null;
  maxDate?: Date | string | null;
  onSelect?: (isoDate: string, date: Date) => void;
  placeholder?: string;
  ariaLabel?: string;
}

let activePopup: HTMLElement | null = null;
let activeTargetInput: HTMLInputElement | null = null;

function closeDatePickerPopup(): void {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
    activeTargetInput = null;
  }
}

/**
 * Opens a floating or modal DatePicker connected to a target input element.
 */
export function openDatePicker(
  target: HTMLInputElement,
  options: DatePickerOptions = {},
): void {
  closeDatePickerPopup();

  const locale = globalLocaleService.getLocale();
  const adapter = getDateAdapter(locale);
  const calendarType = adapter.calendarType;

  // Determine current active date parts
  let currentDate = target.dataset.isoDate
    ? parseStandardIsoDate(target.dataset.isoDate, calendarType)
    : target.value && !Number.isNaN(new Date(target.value).getTime())
    ? adapter.toCalendarDate(new Date(target.value))
    : adapter.getToday();

  if (!currentDate) {
    currentDate = adapter.getToday();
  }

  let viewingYear = currentDate.year;
  let viewingMonth = currentDate.month;
  let selectedYear = currentDate.year;
  let selectedMonth = currentDate.month;
  let selectedDay = currentDate.day;

  const today = adapter.getToday();

  // Create popup container
  const popup = document.createElement("div");
  popup.className = "phoenix-date-picker-popup glass-card";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");
  popup.setAttribute("aria-label", defaultI18n.t("calendar.selectDate"));
  popup.dir = globalLocaleService.getDirection();

  const renderCalendar = (): void => {
    const monthInfo = adapter.getMonthInfo(viewingYear, viewingMonth);
    const weekdays = adapter.getWeekdays();

    const title = `${monthInfo.monthName} ${adapter.localizeDigits(viewingYear)}`;
    const prevLabel = defaultI18n.t("calendar.previousMonth");
    const nextLabel = defaultI18n.t("calendar.nextMonth");
    const todayLabel = defaultI18n.t("calendar.today");
    const clearLabel = defaultI18n.t("calendar.clear");

    // Build weekday headers
    const weekdayCols = weekdays
      .map((w) => `<span class="date-picker-weekday" title="${w.full}">${w.short}</span>`)
      .join("");

    // Build day grid cells
    const cells: string[] = [];

    // Blank cells before first day of month
    for (let i = 0; i < monthInfo.firstDayOfWeekIndex; i++) {
      cells.push('<span class="date-picker-cell date-picker-empty" aria-hidden="true"></span>');
    }

    // Days 1 to daysInMonth
    for (let day = 1; day <= monthInfo.daysInMonth; day++) {
      const isSelected =
        selectedYear === viewingYear &&
        selectedMonth === viewingMonth &&
        selectedDay === day;
      const isToday =
        today.year === viewingYear &&
        today.month === viewingMonth &&
        today.day === day;

      const classes = [
        "date-picker-cell",
        "date-picker-day",
        isSelected ? "selected" : "",
        isToday ? "today" : "",
      ]
        .filter(Boolean)
        .join(" ");

      cells.push(
        `<button type="button" class="${classes}" data-day="${day}" aria-label="${day} ${monthInfo.monthName} ${viewingYear}">` +
          `<span>${adapter.localizeDigits(day)}</span>` +
          `</button>`,
      );
    }

    popup.innerHTML = `
      <div class="date-picker-header">
        <button type="button" class="icon-button date-picker-nav date-picker-prev" aria-label="${prevLabel}" data-nav-prev>‹</button>
        <strong class="date-picker-title">${title}</strong>
        <button type="button" class="icon-button date-picker-nav date-picker-next" aria-label="${nextLabel}" data-nav-next>›</button>
      </div>
      <div class="date-picker-weekdays">${weekdayCols}</div>
      <div class="date-picker-grid">${cells.join("")}</div>
      <div class="date-picker-footer">
        <button type="button" class="button button-ghost button-small date-picker-action-today" data-action-today>${todayLabel}</button>
        <button type="button" class="button button-ghost button-small date-picker-action-clear" data-action-clear>${clearLabel}</button>
      </div>
    `;

    // Bind event handlers
    popup.querySelector("[data-nav-prev]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (viewingMonth === 1) {
        viewingMonth = 12;
        viewingYear--;
      } else {
        viewingMonth--;
      }
      renderCalendar();
    });

    popup.querySelector("[data-nav-next]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (viewingMonth === 12) {
        viewingMonth = 1;
        viewingYear++;
      } else {
        viewingMonth++;
      }
      renderCalendar();
    });

    popup.querySelector("[data-action-today]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      selectDateParts({ year: today.year, month: today.month, day: today.day });
    });

    popup.querySelector("[data-action-clear]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      target.value = "";
      target.dataset.isoDate = "";
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      closeDatePickerPopup();
    });

    popup.querySelectorAll<HTMLButtonElement>("[data-day]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const d = Number(btn.dataset.day);
        if (!Number.isNaN(d) && d >= 1) {
          selectDateParts({ year: viewingYear, month: viewingMonth, day: d });
        }
      });
    });
  };

  const selectDateParts = (parts: CalendarDateParts): void => {
    selectedYear = parts.year;
    selectedMonth = parts.month;
    selectedDay = parts.day;

    const isoDate = toStandardIsoDate(parts, calendarType);
    const standardDate = adapter.fromCalendarDate(parts);
    const presentation = adapter.formatDate(standardDate);

    target.dataset.isoDate = isoDate;
    target.value = presentation;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));

    if (options.onSelect) {
      options.onSelect(isoDate, standardDate);
    }

    closeDatePickerPopup();
  };

  renderCalendar();

  // Position popup relative to target input
  document.body.appendChild(popup);
  activePopup = popup;
  activeTargetInput = target;

  const rect = target.getBoundingClientRect();
  const popupWidth = 320;
  const isRtl = globalLocaleService.getDirection() === "rtl";

  const top = rect.bottom + window.scrollY + 6;
  let left = isRtl
    ? rect.right + window.scrollX - popupWidth
    : rect.left + window.scrollX;

  // Boundary check
  if (left < 10) left = 10;
  if (left + popupWidth > window.innerWidth - 10) {
    left = window.innerWidth - popupWidth - 10;
  }

  popup.style.position = "absolute";
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  popup.style.zIndex = "9999";
}

// Global outside click / escape listener
if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    if (!activePopup) return;
    const target = event.target as Node;
    if (!activePopup.contains(target) && target !== activeTargetInput) {
      closeDatePickerPopup();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activePopup) {
      closeDatePickerPopup();
    }
  });
}

/**
 * Initializes all elements with [data-date-picker] in a given root container.
 */
export function initDatePickers(root: ParentNode = document): void {
  const inputs = root.querySelectorAll<HTMLInputElement>("input[data-date-picker]");
  inputs.forEach((input) => {
    if (input.dataset.datePickerBound === "true") return;
    input.dataset.datePickerBound = "true";

    // Format initial value if data-iso-date exists
    if (input.dataset.isoDate && !input.value) {
      const locale = globalLocaleService.getLocale();
      input.value = formatDate(input.dataset.isoDate, locale);
    }

    input.addEventListener("focus", () => {
      openDatePicker(input);
    });

    input.addEventListener("click", (e) => {
      e.stopPropagation();
      openDatePicker(input);
    });
  });
}

/**
 * Generates an accessible, locale-aware date picker input field markup.
 */
export function renderDatePickerField(options: {
  id: string;
  name?: string;
  label?: string;
  valueIso?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}): string {
  const locale = globalLocaleService.getLocale();
  const placeholder = options.placeholder ?? defaultI18n.t("calendar.datePlaceholder");
  const displayValue = options.valueIso ? formatDate(options.valueIso, locale) : "";
  const isoAttr = options.valueIso ? ` data-iso-date="${options.valueIso}"` : "";

  return `
    <div class="phoenix-date-field-wrapper">
      ${options.label ? `<label class="field-label" for="${options.id}">${options.label}</label>` : ""}
      <div class="phoenix-date-input-group">
        <input
          id="${options.id}"
          name="${options.name ?? options.id}"
          type="text"
          class="${options.className ?? "studio-input-line date-picker-input"}"
          data-date-picker="true"
          placeholder="${placeholder}"
          value="${displayValue}"
          ${isoAttr}
          readonly
          autocomplete="off"
          ${options.required ? "required" : ""}
        />
        <button type="button" class="date-picker-trigger-icon" aria-label="${defaultI18n.t("calendar.selectDate")}" tabindex="-1">📅</button>
      </div>
    </div>
  `;
}
