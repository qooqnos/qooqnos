import type { EntityId } from "@qooqnos/core";
import { CustomerGroup, Offer, OfferAvailabilityStatus, OfferStatus } from "../types/offer";

export interface OfferGridItem {
  readonly id?: EntityId | string | undefined;
  readonly customerGroup: CustomerGroup;
  readonly labelFa: string;
  readonly labelEn: string;
  readonly isAvailable: boolean;
  readonly availabilityStatus: OfferAvailabilityStatus;
  readonly priceAmountMinor: number;
  readonly currency: string;
  readonly validFrom?: string | undefined;
  readonly validTo?: string | undefined;
  readonly status: OfferStatus | string;
}

export interface OfferGridState {
  readonly sellerId: EntityId | string;
  readonly productId: EntityId | string;
  readonly variantId?: EntityId | string | undefined;
  readonly currency: string;
  readonly items: readonly OfferGridItem[];
  readonly isLoading?: boolean | undefined;
  readonly isSaving?: boolean | undefined;
  readonly error?: string | null | undefined;
}

export interface OfferGridProps {
  readonly state: OfferGridState;
  readonly onToggleAvailability: (customerGroup: CustomerGroup, available: boolean) => void;
  readonly onPriceChange: (customerGroup: CustomerGroup, priceAmountMinor: number) => void;
  readonly onStatusChange?: ((customerGroup: CustomerGroup, status: OfferStatus) => void) | undefined;
  readonly onSaveAll?: (() => void) | undefined;
}

/**
 * Standard customer group definitions with Persian / English labels
 */
export const STANDARD_CUSTOMER_GROUPS: ReadonlyArray<{
  readonly key: CustomerGroup;
  readonly labelFa: string;
  readonly labelEn: string;
  readonly descriptionFa: string;
}> = [
  {
    key: "consumer",
    labelFa: "مصرف‌کننده عادی",
    labelEn: "General Consumer",
    descriptionFa: "قیمت پیش‌فرض عمومی برای تمامی خریداران عادی",
  },
  {
    key: "partner",
    labelFa: "همکار تجاری",
    labelEn: "Business Partner",
    descriptionFa: "تخفیف همکاری برای فروشگاه‌ها و کسب‌وکارهای همکار",
  },
  {
    key: "agent",
    labelFa: "نماینده فروش",
    labelEn: "Sales Agent",
    descriptionFa: "قیمت ویژه نمایندگان رسمی و عاملیت‌های فروش",
  },
  {
    key: "special_partner",
    labelFa: "همکار ویژه",
    labelEn: "Special Partner",
    descriptionFa: "طرح‌های ویژه برای همکاران طلایی و استراتژیک",
  },
  {
    key: "distributor",
    labelFa: "پخش‌کننده / مویرگی",
    labelEn: "Distributor",
    descriptionFa: "قیمت عمده پخش مویرگی و استانی",
  },
  {
    key: "enterprise",
    labelFa: "مشتری سازمانی",
    labelEn: "Enterprise / B2B",
    descriptionFa: "فروش حجمی به شرکت‌ها و سازمان‌های حقوقی",
  },
  {
    key: "wholesale",
    labelFa: "عمده‌خریدار",
    labelEn: "Wholesale",
    descriptionFa: "نرخ خرید عمده با تیراژ بالا",
  },
  {
    key: "special_agent",
    labelFa: "نماینده ویژه",
    labelEn: "Special Agent",
    descriptionFa: "نرخ انحصاری نمایندگی‌های درجه یک",
  },
];

/**
 * Helper to build initial OfferGrid items for a product/variant
 */
export function buildInitialOfferGridItems(
  existingOffers: readonly Offer[],
  defaultCurrency: string = "IRR",
  basePriceMinor: number = 0,
): readonly OfferGridItem[] {
  return STANDARD_CUSTOMER_GROUPS.map((group) => {
    const matched = existingOffers.find(
      (o) => o.customerGroup === group.key || o.audience?.group === group.key,
    );
    if (matched) {
      return {
        id: matched.id,
        customerGroup: group.key,
        labelFa: group.labelFa,
        labelEn: group.labelEn,
        isAvailable: matched.available && matched.availabilityStatus !== "unavailable",
        availabilityStatus: matched.availabilityStatus,
        priceAmountMinor: matched.priceAmountMinor,
        currency: matched.currency ?? defaultCurrency,
        validFrom: matched.validFrom,
        validTo: matched.validTo,
        status: matched.status,
      };
    }
    return {
      customerGroup: group.key,
      labelFa: group.labelFa,
      labelEn: group.labelEn,
      isAvailable: group.key === "consumer", // Default consumer is enabled
      availabilityStatus: group.key === "consumer" ? "available" : "unavailable",
      priceAmountMinor: basePriceMinor,
      currency: defaultCurrency,
      status: OfferStatus.ACTIVE,
    };
  });
}

/**
 * Pure Component: Renders Offer Grid HTML markup
 * Suitable for SSR, client DOM injection, or standard React/Vanilla environments.
 */
export function renderOfferGridHtml(props: OfferGridProps): string {
  const { state } = props;
  const itemsHtml = state.items
    .map((item) => {
      const isChecked = item.isAvailable ? "checked" : "";
      const statusBadge =
        String(item.status).toUpperCase() === "ACTIVE"
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">فعال</span>`
          : `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">${item.status}</span>`;

      const priceInTomans = Math.round(item.priceAmountMinor / (item.currency === "IRR" ? 10 : 1));

      return `
        <tr class="border-b border-zinc-800/80 hover:bg-zinc-800/30 transition-colors" data-group="${item.customerGroup}">
          <td class="py-3 px-4 font-medium text-zinc-200">
            <div class="flex items-center gap-2">
              <span>${item.labelFa}</span>
              <span class="text-xs text-zinc-500 hidden sm:inline">(${item.labelEn})</span>
            </div>
          </td>
          <td class="py-3 px-4 text-center">
            <label class="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                class="sr-only peer offer-avail-toggle" 
                data-group="${item.customerGroup}"
                ${isChecked} 
              />
              <div class="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </td>
          <td class="py-3 px-4">
            <div class="relative max-w-xs">
              <input
                type="number"
                dir="ltr"
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none offer-price-input"
                data-group="${item.customerGroup}"
                value="${item.priceAmountMinor}"
                step="1000"
                min="0"
              />
              <span class="absolute left-3 top-2 text-xs text-zinc-500 pointer-events-none">${item.currency}</span>
            </div>
            <div class="text-[11px] text-zinc-400 mt-1">
              معادل ${priceInTomans.toLocaleString("fa-IR")} تومان
            </div>
          </td>
          <td class="py-3 px-4 text-center">
            ${statusBadge}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="offer-grid-container bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl" dir="rtl">
      <!-- Header Toolbar -->
      <div class="p-4 sm:p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-zinc-900">
        <div>
          <h2 class="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ماتریس قیمت‌گذاری و دسترسی گروه‌های مشتریان
          </h2>
          <p class="text-xs sm:text-sm text-zinc-400 mt-1">
            تعیین دسترسی، قیمت ریالی و شرایط عرضه مجزا برای هر گروه از همکاران و خریداران
          </p>
        </div>

        <div class="flex items-center gap-2">
          ${
            props.onSaveAll
              ? `<button type="button" class="offer-grid-save-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors shadow">
                  ذخیره تغییرات آفرها
                 </button>`
              : ""
          }
        </div>
      </div>

      <!-- Table Grid -->
      <div class="overflow-x-auto">
        <table class="w-full text-right text-sm">
          <thead class="bg-zinc-950/60 text-zinc-400 text-xs font-semibold uppercase tracking-wider border-b border-zinc-800">
            <tr>
              <th class="py-3 px-4">گروه مشتری</th>
              <th class="py-3 px-4 text-center">وضعیت دسترسی</th>
              <th class="py-3 px-4">قیمت پیشنهادی (ریال)</th>
              <th class="py-3 px-4 text-center">وضعیت چرخه حیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800/40">
            ${itemsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export interface OfferGridDomContainer {
  innerHTML: string;
  querySelectorAll: (selector: string) => Iterable<{
    getAttribute: (name: string) => string | null;
    checked?: boolean;
    value?: string;
    addEventListener: (event: string, handler: (e: any) => void) => void;
  }>;
  querySelector: (selector: string) => {
    addEventListener: (event: string, handler: (e: any) => void) => void;
  } | null;
}

/**
 * Interactive DOM binder for Vanilla JS / Browser Environments
 */
export function mountOfferGridComponent(
  container: OfferGridDomContainer,
  initialProps: OfferGridProps,
): {
  updateState: (newState: Partial<OfferGridState>) => void;
  destroy: () => void;
} {
  let currentProps = { ...initialProps };

  function render() {
    container.innerHTML = renderOfferGridHtml(currentProps);
    bindEvents();
  }

  function bindEvents() {
    const toggleInputs = container.querySelectorAll(".offer-avail-toggle");
    for (const input of toggleInputs) {
      input.addEventListener("change", (e: any) => {
        const group = (e.target?.getAttribute?.("data-group") ?? input.getAttribute("data-group")) as CustomerGroup;
        const checked = Boolean(e.target?.checked ?? input.checked);
        currentProps.onToggleAvailability(group, checked);
      });
    }

    const priceInputs = container.querySelectorAll(".offer-price-input");
    for (const input of priceInputs) {
      input.addEventListener("change", (e: any) => {
        const group = (e.target?.getAttribute?.("data-group") ?? input.getAttribute("data-group")) as CustomerGroup;
        const rawVal = e.target?.value ?? input.value;
        const val = Number.parseInt(String(rawVal), 10);
        if (!Number.isNaN(val) && val >= 0) {
          currentProps.onPriceChange(group, val);
        }
      });
    }

    const saveBtn = container.querySelector(".offer-grid-save-btn");
    if (saveBtn && currentProps.onSaveAll) {
      saveBtn.addEventListener("click", () => {
        currentProps.onSaveAll?.();
      });
    }
  }

  render();

  return {
    updateState(newState: Partial<OfferGridState>) {
      currentProps = {
        ...currentProps,
        state: { ...currentProps.state, ...newState },
      };
      render();
    },
    destroy() {
      container.innerHTML = "";
    },
  };
}
