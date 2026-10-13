// ============================================================================
// PHOENIX STEPWISE PROGRESSIVE CHECKOUT ENGINE (Phases 6, 7, 8)
// Flow: Cart → Shipping Address & Receiver → Shipping Method → National ID → Payment → Order Created
// ============================================================================

import {
  isValidNationalCode,
  isValidPostalCode,
  isValidMobileNumber,
  toEnglishDigits,
} from "./auth-validation.js";
import { formatNumber } from "./calendar-service.js";
import { type SupportedLanguage } from "./i18n-runtime.js";
import { globalLocaleService } from "./locale-service.js";
import { isUserAuthenticated, openAuthModal } from "./auth-modal.js";

export interface CheckoutCartItem {
  id: string;
  title: string;
  businessName: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string | undefined;
  category?: string | undefined;
}

export interface CheckoutAddress {
  id: string;
  title?: string | undefined;
  receiverName: string;
  receiverPhone: string;
  province: string;
  city: string;
  streetLine: string;
  plaque?: string | undefined;
  unit?: string | undefined;
  postalCode: string;
  isDefault?: boolean | undefined;
}

export type CheckoutStep = "cart" | "address" | "shipping" | "identity" | "payment" | "success";

const DEFAULT_SAMPLE_CART: CheckoutCartItem[] = [
  {
    id: "prod-art-01",
    title: "گلدان میناکاری دست‌ساز اصفهان (طرح اسلیمی)",
    businessName: "صنایع دستی ترنج اصفهان",
    unitPrice: 1850000,
    quantity: 1,
    category: "صنایع دستی",
  },
  {
    id: "prod-art-02",
    title: "جعبه خاتم‌کاری نفیس خاتم اعلا",
    businessName: "صنایع دستی ترنج اصفهان",
    unitPrice: 950000,
    quantity: 1,
    category: "صنایع دستی",
  },
];

const SAVED_ADDRESSES_STORAGE_KEY = "phoenix-saved-addresses-v2";
const inMemoryAddresses = new Map<string, string>();

function getStorage(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return inMemoryAddresses.get(key) ?? null;
}

function setStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // fallback
  }
  inMemoryAddresses.set(key, value);
}

export function getSavedAddresses(): CheckoutAddress[] {
  try {
    const raw = getStorage(SAVED_ADDRESSES_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CheckoutAddress[];
  } catch {
    // ignore
  }
  return [
    {
      id: "addr-home",
      title: "خانه",
      receiverName: "سارا حسینی",
      receiverPhone: "09121112233",
      province: "تهران",
      city: "تهران",
      streetLine: "خیابان ولیعصر، بالاتر از پارک ساعی، کوچه ساعی یکم",
      plaque: "۲۴",
      unit: "۳",
      postalCode: "1511933456",
      isDefault: true,
    },
    {
      id: "addr-work",
      title: "محل کار",
      receiverName: "سارا حسینی",
      receiverPhone: "09121112233",
      province: "تهران",
      city: "تهران",
      streetLine: "میدان ونک، خیابان ملاصدرا، پلاک ۵۰، شرکت دانش‌بنیان",
      plaque: "۵۰",
      unit: "۸",
      postalCode: "1991734567",
      isDefault: false,
    },
  ];
}

export function saveAddress(addr: CheckoutAddress): void {
  const current = getSavedAddresses();
  if (addr.isDefault) {
    current.forEach((a) => (a.isDefault = false));
  }
  const existingIdx = current.findIndex((a) => a.id === addr.id);
  if (existingIdx >= 0) {
    current[existingIdx] = addr;
  } else {
    current.push(addr);
  }
  setStorage(SAVED_ADDRESSES_STORAGE_KEY, JSON.stringify(current));
}

export function deleteAddress(id: string): void {
  const current = getSavedAddresses().filter((a) => a.id !== id);
  setStorage(SAVED_ADDRESSES_STORAGE_KEY, JSON.stringify(current));
}

let activeCart: CheckoutCartItem[] = [...DEFAULT_SAMPLE_CART];
let activeStep: CheckoutStep = "cart";
let selectedAddressId: string = "addr-home";
let selectedShippingMethod: "express" | "postal" | "courier" = "express";
let nationalCodeValue = "0010332804";
let selectedPaymentMethod: "online_shetab" | "wallet" | "cod" = "online_shetab";
let lastCreatedOrderId = "";

export function renderCheckoutPage(): string {
  const locale = globalLocaleService.getLocale();
  const dir = globalLocaleService.getDirection();

  const totalAmount = activeCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingFee = selectedShippingMethod === "express" ? 65000 : (selectedShippingMethod === "courier" ? 95000 : 45000);
  const grandTotal = totalAmount + shippingFee;

  const stepsList: { key: CheckoutStep; label: string; number: number }[] = [
    { key: "cart", label: "سبد خرید", number: 1 },
    { key: "address", label: "آدرس و گیرنده", number: 2 },
    { key: "shipping", label: "روش ارسال", number: 3 },
    { key: "identity", label: "اطلاعات هویتی", number: 4 },
    { key: "payment", label: "پرداخت و ثبت", number: 5 },
  ];

  return `
    <div class="phoenix-checkout-container container-wide" dir="${dir}">
      <!-- Stepper Header -->
      <nav class="checkout-stepper-nav" aria-label="مراحل خرید">
        ${stepsList.map((step, idx) => {
          const isDone = stepsList.findIndex((s) => s.key === activeStep) > idx;
          const isCurrent = step.key === activeStep;
          const statusClass = isDone ? "step-done" : (isCurrent ? "step-active" : "step-pending");
          return `
            <div class="checkout-step-item ${statusClass}">
              <span class="step-badge">${isDone ? "✓" : formatNumber(step.number, locale)}</span>
              <span class="step-label">${step.label}</span>
              ${idx < stepsList.length - 1 ? '<span class="step-divider"></span>' : ""}
            </div>
          `;
        }).join("")}
      </nav>

      <div class="checkout-layout-grid">
        <!-- Main Step Form Content -->
        <main class="checkout-step-content glass-card">
          ${renderStepContent(locale)}
        </main>

        <!-- Order Summary Aside -->
        <aside class="checkout-summary-card glass-card">
          <h3 class="summary-title">خلاصه سفارش</h3>
          <div class="summary-items-list">
            ${activeCart.map((it) => `
              <div class="summary-item-row">
                <div>
                  <strong>${it.title}</strong>
                  <small>${it.businessName} · تعداد: ${formatNumber(it.quantity, locale)}</small>
                </div>
                <span>${formatNumber(it.unitPrice * it.quantity, locale)} ریال</span>
              </div>
            `).join("")}
          </div>

          <div class="summary-divider"></div>

          <div class="summary-calc-row">
            <span>مجموع اقلام</span>
            <span>${formatNumber(totalAmount, locale)} ریال</span>
          </div>
          <div class="summary-calc-row">
            <span>هزینه ارسال (${selectedShippingMethod === "express" ? "اکسپرس" : (selectedShippingMethod === "courier" ? "پیک" : "پست پیشتاز")})</span>
            <span>${formatNumber(shippingFee, locale)} ریال</span>
          </div>

          <div class="summary-divider"></div>

          <div class="summary-total-row">
            <strong>مبلغ نهایی قابل پرداخت:</strong>
            <strong class="total-amount">${formatNumber(grandTotal, locale)} ریال</strong>
          </div>

          <div class="checkout-guarantee-badge">
            <span>🛡 ضمانت بازگشت وجه ققنوس و اصالت کالا</span>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function renderStepContent(locale: SupportedLanguage): string {
  switch (activeStep) {
    case "cart":
      return renderCartStep(locale);
    case "address":
      return renderAddressStep(locale);
    case "shipping":
      return renderShippingStep(locale);
    case "identity":
      return renderIdentityStep();
    case "payment":
      return renderPaymentStep(locale);
    case "success":
      return renderSuccessStep(locale);
  }
}

// ----------------------------------------------------------------------------
// Step 1: Cart Items & Quantity Adjustment
// ----------------------------------------------------------------------------
function renderCartStep(locale: SupportedLanguage): string {
  return `
    <div class="checkout-step-body">
      <div class="step-heading">
        <span class="section-kicker">مرحله ۱ از ۵</span>
        <h2>بررسی سبد خرید</h2>
        <p>اقلام انتخابی و تعداد سفارش خود را بررسی کنید.</p>
      </div>

      <div class="checkout-cart-items-table">
        ${activeCart.map((item) => `
          <div class="cart-item-card">
            <div class="cart-item-info">
              <span class="cart-item-icon">📦</span>
              <div>
                <strong class="cart-item-title">${item.title}</strong>
                <span class="cart-item-business">فروشنده: ${item.businessName}</span>
                <span class="cart-item-price">${formatNumber(item.unitPrice, locale)} ریال</span>
              </div>
            </div>

            <div class="cart-item-actions">
              <div class="quantity-controller">
                <button type="button" class="qty-btn" data-change-qty="${item.id}" data-delta="1">+</button>
                <span class="qty-display">${formatNumber(item.quantity, locale)}</span>
                <button type="button" class="qty-btn" data-change-qty="${item.id}" data-delta="-1">-</button>
              </div>
              <button type="button" class="cart-remove-btn" data-remove-item="${item.id}">حذف</button>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="step-footer-actions">
        <button type="button" class="button button-primary button-lg" data-step-next="address">
          <span>انتخاب آدرس و اطلاعات گیرنده ←</span>
        </button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Step 2: Receiver & Shipping Address (Progressive Data Collection)
// ----------------------------------------------------------------------------
function renderAddressStep(locale: SupportedLanguage): string {
  const addresses = getSavedAddresses();
  const selectedAddr = addresses.find((a) => a.id === selectedAddressId) ?? addresses[0];

  return `
    <div class="checkout-step-body">
      <div class="step-heading">
        <span class="section-kicker">مرحله ۲ از ۵</span>
        <h2>آدرس و مشخصات گیرنده</h2>
        <p>اطلاعات ارسال صرفاً در زمان خرید دریافت می‌شود و حساب اولیه بدون نیاز به این موارد ساخته شد.</p>
      </div>

      <div class="saved-addresses-section">
        <div class="section-subheading">
          <strong>آدرس‌های ذخیره‌شده شما</strong>
          <button type="button" class="button button-ghost button-sm" data-toggle-new-address>+ افزودن آدرس جدید</button>
        </div>

        <div class="saved-addresses-grid">
          ${addresses.map((addr) => {
            const isSelected = addr.id === (selectedAddr?.id ?? "");
            return `
              <div class="address-card ${isSelected ? "address-card-selected" : ""}" data-select-address="${addr.id}">
                <div class="address-header">
                  <span class="address-tag">${addr.title || "نشانی"}</span>
                  ${addr.isDefault ? '<span class="ds-badge ds-badge-success">پیش‌فرض</span>' : ""}
                </div>
                <strong class="address-receiver">${addr.receiverName} (${addr.receiverPhone})</strong>
                <p class="address-text">${addr.province}، ${addr.city}، ${addr.streetLine}، پلاک ${addr.plaque || "-"}، واحد ${addr.unit || "-"}</p>
                <span class="address-postal">کد پستی: ${formatNumber(addr.postalCode, locale)}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Add New Address Form (Collapsible) -->
      <div id="new-address-form-box" class="new-address-box glass-card" hidden>
        <h4>افزودن آدرس پستی جدید</h4>
        <form id="checkout-add-address-form" onsubmit="return false;">
          <div class="form-row-grid">
            <div class="form-group">
              <label class="field-label" for="addr-title">عنوان آدرس (مثلاً خانه، دفتر)</label>
              <input id="addr-title" class="ds-field ds-input" type="text" placeholder="خانه" />
            </div>
            <div class="form-group">
              <label class="field-label" for="addr-receiver-name">نام و نام خانوادگی گیرنده *</label>
              <input id="addr-receiver-name" class="ds-field ds-input" type="text" required placeholder="مثال: سارا حسینی" />
            </div>
            <div class="form-group">
              <label class="field-label" for="addr-receiver-phone">شماره تماس گیرنده *</label>
              <input id="addr-receiver-phone" class="ds-field ds-input" type="tel" required placeholder="09123456789" />
            </div>
          </div>

          <div class="form-row-grid">
            <div class="form-group">
              <label class="field-label" for="addr-province">استان *</label>
              <input id="addr-province" class="ds-field ds-input" type="text" required value="تهران" />
            </div>
            <div class="form-group">
              <label class="field-label" for="addr-city">شهر *</label>
              <input id="addr-city" class="ds-field ds-input" type="text" required value="تهران" />
            </div>
            <div class="form-group">
              <label class="field-label" for="addr-postal-code">کد پستی (۱۰ رقم) *</label>
              <input id="addr-postal-code" class="ds-field ds-input" type="text" required maxlength="10" placeholder="1991734567" />
            </div>
          </div>

          <div class="form-group">
            <label class="field-label" for="addr-street">نشانی پستی دقیق (خیابان، کوچه) *</label>
            <textarea id="addr-street" class="ds-field ds-input" rows="2" required placeholder="خیابان ولیعصر، بالاتر از پارک ساعی…"></textarea>
          </div>

          <div class="form-row-grid">
            <div class="form-group">
              <label class="field-label" for="addr-plaque">پلاک</label>
              <input id="addr-plaque" class="ds-field ds-input" type="text" placeholder="مثال: ۲۴" />
            </div>
            <div class="form-group">
              <label class="field-label" for="addr-unit">واحد</label>
              <input id="addr-unit" class="ds-field ds-input" type="text" placeholder="مثال: ۳" />
            </div>
            <div class="form-group flex-center">
              <label class="checkbox-label">
                <input id="addr-default-check" type="checkbox" checked />
                <span>ذخیره به عنوان آدرس پیش‌فرض</span>
              </label>
            </div>
          </div>

          <div id="new-address-error" class="form-error-msg" hidden></div>

          <div class="form-actions-row">
            <button type="button" class="button button-ghost" data-cancel-new-address>انصراف</button>
            <button type="submit" class="button button-primary">ذخیره آدرس</button>
          </div>
        </form>
      </div>

      <div class="step-footer-actions">
        <button type="button" class="button button-ghost" data-step-prev="cart">بازگشت</button>
        <button type="button" class="button button-primary button-lg" data-step-next="shipping">
          <span>انتخاب روش ارسال ←</span>
        </button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Step 3: Shipping Method
// ----------------------------------------------------------------------------
function renderShippingStep(locale: SupportedLanguage): string {
  return `
    <div class="checkout-step-body">
      <div class="step-heading">
        <span class="section-kicker">مرحله ۳ از ۵</span>
        <h2>روش ارسال مرسوله</h2>
        <p>نحوه و زمان‌بندی تحویل سفارش خود را تعیین کنید.</p>
      </div>

      <div class="shipping-options-list">
        <label class="shipping-option-card ${selectedShippingMethod === "express" ? "selected" : ""}">
          <input type="radio" name="shipping-method" value="express" ${selectedShippingMethod === "express" ? "checked" : ""} />
          <div class="shipping-copy">
            <div class="shipping-name">
              <strong>🚀 ارسال اکسپرس ققنوس</strong>
              <span class="ds-badge ds-badge-info">تحویل سریع ۲۴ ساعته</span>
            </div>
            <p>بسته‌بندی ایمن کادوئی و حمل اختصاصی تا درب منزل</p>
          </div>
          <span class="shipping-cost">${formatNumber(65000, locale)} ریال</span>
        </label>

        <label class="shipping-option-card ${selectedShippingMethod === "courier" ? "selected" : ""}">
          <input type="radio" name="shipping-method" value="courier" ${selectedShippingMethod === "courier" ? "checked" : ""} />
          <div class="shipping-copy">
            <div class="shipping-name">
              <strong>🛵 پیک فوری درون‌شهری</strong>
              <span class="ds-badge ds-badge-warning">همان روز (تهران)</span>
            </div>
            <p>تحویل مستقیم در بازه زمانی انتخابی شما</p>
          </div>
          <span class="shipping-cost">${formatNumber(95000, locale)} ریال</span>
        </label>

        <label class="shipping-option-card ${selectedShippingMethod === "postal" ? "selected" : ""}">
          <input type="radio" name="shipping-method" value="postal" ${selectedShippingMethod === "postal" ? "checked" : ""} />
          <div class="shipping-copy">
            <div class="shipping-name">
              <strong>📦 پست پیشتاز جمهوری اسلامی ایران</strong>
              <span class="ds-badge ds-badge-neutral">۲ الی ۳ روز کاری</span>
            </div>
            <p>ارسال به سراسر کشور با کد رهگیری پستی مرسوله</p>
          </div>
          <span class="shipping-cost">${formatNumber(45000, locale)} ریال</span>
        </label>
      </div>

      <div class="step-footer-actions">
        <button type="button" class="button button-ghost" data-step-prev="address">بازگشت</button>
        <button type="button" class="button button-primary button-lg" data-step-next="identity">
          <span>اطلاعات هویتی و صورتحساب ←</span>
        </button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Step 4: Required Identity (کد ملی فقط در این مرحله)
// ----------------------------------------------------------------------------
function renderIdentityStep(): string {
  return `
    <div class="checkout-step-body">
      <div class="step-heading">
        <span class="section-kicker">مرحله ۴ از ۵</span>
        <h2>اطلاعات هویتی و صدور صورتحساب</h2>
        <p>مطابق قوانین تجارت الکترونیک، کد ملی صرفاً در مرحله نهایی خرید برای صدور فاکتور رسمی و بیمه مرسوله دریافت می‌شود.</p>
      </div>

      <div class="identity-notice-card glass-card">
        <span class="notice-icon">ℹ</span>
        <div>
          <strong>اصل Progressive Data Collection</strong>
          <p>این اطلاعات در زمان ثبت‌نام اولیه درخواست نشد تا ثبت‌نام شما سریع و بدون اصطکاک انجام شود. کد ملی تنها برای این سفارش ثبت می‌شود.</p>
        </div>
      </div>

      <form id="checkout-identity-form" class="auth-form" onsubmit="return false;">
        <div class="form-group">
          <label class="field-label" for="checkout-national-code">کد ملی خریدار (۱۰ رقم معتبر)</label>
          <input
            id="checkout-national-code"
            class="ds-field ds-input ds-input-lg"
            type="text"
            maxlength="10"
            inputmode="numeric"
            value="${nationalCodeValue}"
            placeholder="مثال: 0010332804"
            required
          />
          <small class="field-hint">کد ملی به همراه اعتبارسنجی الگوریتم Modulus 11 بررسی می‌شود.</small>
          <span id="checkout-national-error" class="form-error-msg" hidden></span>
        </div>

        <div class="step-footer-actions">
          <button type="button" class="button button-ghost" data-step-prev="shipping">بازگشت</button>
          <button type="submit" class="button button-primary button-lg">
            <span>تأیید و رفتن به درگاه پرداخت ←</span>
          </button>
        </div>
      </form>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Step 5: Payment & Order Confirmation
// ----------------------------------------------------------------------------
function renderPaymentStep(locale: SupportedLanguage): string {
  return `
    <div class="checkout-step-body">
      <div class="step-heading">
        <span class="section-kicker">مرحله ۵ از ۵</span>
        <h2>روش پرداخت و ثبت سفارش</h2>
        <p>درگاه پرداخت موردنظر خود را انتخاب و سفارش را نهایی کنید.</p>
      </div>

      <div class="payment-methods-grid">
        <label class="payment-method-card ${selectedPaymentMethod === "online_shetab" ? "selected" : ""}">
          <input type="radio" name="payment-method" value="online_shetab" ${selectedPaymentMethod === "online_shetab" ? "checked" : ""} />
          <div class="payment-copy">
            <span class="payment-icon">💳</span>
            <div>
              <strong>درگاه پرداخت آنلاین شتاب</strong>
              <small>تمامی کارت‌های بانکی عضو شبکه شتاب</small>
            </div>
          </div>
          <span class="ds-badge ds-badge-success">توصیه شده</span>
        </label>

        <label class="payment-method-card ${selectedPaymentMethod === "wallet" ? "selected" : ""}">
          <input type="radio" name="payment-method" value="wallet" ${selectedPaymentMethod === "wallet" ? "checked" : ""} />
          <div class="payment-copy">
            <span class="payment-icon">🪙</span>
            <div>
              <strong>کیف پول اعتباری ققنوس</strong>
              <small>پرداخت آنی ۱ کلیکی با موجودی کیف پول</small>
            </div>
          </div>
          <span class="ds-badge ds-badge-info">سریع</span>
        </label>

        <label class="payment-method-card ${selectedPaymentMethod === "cod" ? "selected" : ""}">
          <input type="radio" name="payment-method" value="cod" ${selectedPaymentMethod === "cod" ? "checked" : ""} />
          <div class="payment-copy">
            <span class="payment-icon">🤝</span>
            <div>
              <strong>پرداخت در محل هنگام تحویل</strong>
              <small>با کارتخوان سیار هنگام دریافت کالا</small>
            </div>
          </div>
          <span class="ds-badge ds-badge-neutral">شهرهای منتخب</span>
        </label>
      </div>

      <div class="step-footer-actions">
        <button type="button" class="button button-ghost" data-step-prev="identity">بازگشت</button>
        <button type="button" class="button button-primary button-lg" data-place-order>
          <span>تکمیل خرید و پرداخت نهایی (${formatNumber(activeCart.reduce((s, i) => s + i.unitPrice * i.quantity, 0) + (selectedShippingMethod === "express" ? 65000 : 45000), locale)} ریال)</span>
        </button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Step 6: Success & Order Created
// ----------------------------------------------------------------------------
function renderSuccessStep(_locale: SupportedLanguage): string {
  return `
    <div class="checkout-success-view text-center">
      <div class="success-orb">✓</div>
      <span class="section-kicker">سفارش ثبت شد</span>
      <h2>سفارش شما با موفقیت در ققنوس ثبت گردید</h2>
      <p class="order-id-highlight">شناسه سفارش: <strong>#${lastCreatedOrderId || "ORD-2026-9812"}</strong></p>
      <p class="success-desc">پیامک و اعلان تأیید به شماره موبایل شما ارسال شد. وضعیت آماده‌سازی و ارسال سفارش را در داشبورد خود پیگیری کنید.</p>

      <div class="success-actions-row">
        <a href="/orders" class="button button-primary button-lg" data-nav>پیگیری سفارش و خط زمانی تحویل →</a>
        <a href="/discover" class="button button-ghost" data-nav>ادامه گشت‌وگذار در ققنوس</a>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Event Binding for Checkout Flow
// ----------------------------------------------------------------------------
export function bindCheckoutEvents(container: HTMLElement, onOrderCreated?: (orderId: string) => void): void {
  // Step Navigation
  container.querySelectorAll("[data-step-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-step-next") as CheckoutStep;
      if (next) {
        activeStep = next;
        reRender(container, onOrderCreated);
      }
    });
  });

  container.querySelectorAll("[data-step-prev]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prev = btn.getAttribute("data-step-prev") as CheckoutStep;
      if (prev) {
        activeStep = prev;
        reRender(container, onOrderCreated);
      }
    });
  });

  // Quantity Change
  container.querySelectorAll("[data-change-qty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-change-qty");
      const delta = Number(btn.getAttribute("data-delta") ?? "0");
      const item = activeCart.find((it) => it.id === id);
      if (item) {
        item.quantity = Math.max(1, item.quantity + delta);
        reRender(container, onOrderCreated);
      }
    });
  });

  // Remove Item
  container.querySelectorAll("[data-remove-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-item");
      activeCart = activeCart.filter((it) => it.id !== id);
      if (activeCart.length === 0) {
        activeCart = [...DEFAULT_SAMPLE_CART];
      }
      reRender(container, onOrderCreated);
    });
  });

  // Select Address Card
  container.querySelectorAll("[data-select-address]").forEach((card) => {
    card.addEventListener("click", () => {
      selectedAddressId = card.getAttribute("data-select-address") ?? "";
      reRender(container, onOrderCreated);
    });
  });

  // Toggle New Address Box
  const toggleBtn = container.querySelector<HTMLButtonElement>("[data-toggle-new-address]");
  const newAddrBox = container.querySelector<HTMLElement>("#new-address-form-box");
  const cancelBtn = container.querySelector<HTMLButtonElement>("[data-cancel-new-address]");

  if (toggleBtn && newAddrBox) {
    toggleBtn.addEventListener("click", () => {
      newAddrBox.hidden = false;
      toggleBtn.hidden = true;
    });
  }

  if (cancelBtn && newAddrBox && toggleBtn) {
    cancelBtn.addEventListener("click", () => {
      newAddrBox.hidden = true;
      toggleBtn.hidden = false;
    });
  }

  // Add Address Form Submit
  const addAddrForm = container.querySelector<HTMLFormElement>("#checkout-add-address-form");
  if (addAddrForm) {
    addAddrForm.addEventListener("submit", () => {
      const title = container.querySelector<HTMLInputElement>("#addr-title")?.value.trim() || "نشانی";
      const receiverName = container.querySelector<HTMLInputElement>("#addr-receiver-name")?.value.trim() ?? "";
      const receiverPhone = container.querySelector<HTMLInputElement>("#addr-receiver-phone")?.value.trim() ?? "";
      const province = container.querySelector<HTMLInputElement>("#addr-province")?.value.trim() ?? "";
      const city = container.querySelector<HTMLInputElement>("#addr-city")?.value.trim() ?? "";
      const postalCode = toEnglishDigits(container.querySelector<HTMLInputElement>("#addr-postal-code")?.value.trim() ?? "");
      const streetLine = container.querySelector<HTMLTextAreaElement>("#addr-street")?.value.trim() ?? "";
      const plaque = container.querySelector<HTMLInputElement>("#addr-plaque")?.value.trim();
      const unit = container.querySelector<HTMLInputElement>("#addr-unit")?.value.trim();
      const isDefault = Boolean(container.querySelector<HTMLInputElement>("#addr-default-check")?.checked);

      const errorBox = container.querySelector<HTMLElement>("#new-address-error");

      if (!isValidMobileNumber(receiverPhone)) {
        if (errorBox) {
          errorBox.textContent = "شماره تماس گیرنده نامعتبر است.";
          errorBox.hidden = false;
        }
        return;
      }

      if (!isValidPostalCode(postalCode)) {
        if (errorBox) {
          errorBox.textContent = "کد پستی باید ۱۰ رقم معتبر باشد.";
          errorBox.hidden = false;
        }
        return;
      }

      const newAddrId = `addr_${Date.now()}`;
      saveAddress({
        id: newAddrId,
        title,
        receiverName,
        receiverPhone,
        province,
        city,
        streetLine,
        plaque,
        unit,
        postalCode,
        isDefault,
      });

      selectedAddressId = newAddrId;
      reRender(container, onOrderCreated);
    });
  }

  // Shipping Method Radios
  container.querySelectorAll<HTMLInputElement>('input[name="shipping-method"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const val = radio.value;
      if (val === "express" || val === "postal" || val === "courier") {
        selectedShippingMethod = val;
      }
      reRender(container, onOrderCreated);
    });
  });

  // Identity Form Submit (National ID Validation)
  const identityForm = container.querySelector<HTMLFormElement>("#checkout-identity-form");
  if (identityForm) {
    identityForm.addEventListener("submit", () => {
      const input = container.querySelector<HTMLInputElement>("#checkout-national-code");
      const errorBox = container.querySelector<HTMLElement>("#checkout-national-error");
      if (!input) return;

      const code = toEnglishDigits(input.value.trim());
      if (!isValidNationalCode(code)) {
        if (errorBox) {
          errorBox.textContent = "کد ملی واردشده نامعتبر است. لطفاً کد ملی ۱۰ رقمی معتبر را وارد کنید.";
          errorBox.hidden = false;
        }
        input.focus();
        return;
      }

      nationalCodeValue = code;
      activeStep = "payment";
      reRender(container, onOrderCreated);
    });
  }

  // Payment Method Radios
  container.querySelectorAll<HTMLInputElement>('input[name="payment-method"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const val = radio.value;
      if (val === "online_shetab" || val === "wallet" || val === "cod") {
        selectedPaymentMethod = val;
      }
      reRender(container, onOrderCreated);
    });
  });

  // Place Order Final Click
  const placeOrderBtn = container.querySelector<HTMLButtonElement>("[data-place-order]");
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", () => {
      // Check auth: if guest, prompt registration modal
      if (!isUserAuthenticated()) {
        openAuthModal({
          initialMode: "buyer_mobile",
          onSuccess: () => {
            finalizeOrderCreation(container, onOrderCreated);
          },
        });
        return;
      }

      finalizeOrderCreation(container, onOrderCreated);
    });
  }
}

function finalizeOrderCreation(container: HTMLElement, onOrderCreated?: (orderId: string) => void): void {
  lastCreatedOrderId = `ORD-${Date.now().toString().slice(-6)}`;
  activeStep = "success";
  if (onOrderCreated) {
    onOrderCreated(lastCreatedOrderId);
  }
  reRender(container, onOrderCreated);
}

function reRender(container: HTMLElement, onOrderCreated?: (orderId: string) => void): void {
  container.innerHTML = renderCheckoutPage();
  bindCheckoutEvents(container, onOrderCreated);
}
