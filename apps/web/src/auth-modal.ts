// ============================================================================
// PHOENIX AUTHENTICATION & REGISTRATION MODAL
// Dual-track: Fast Buyer Registration & Specialized Seller Onboarding
// ============================================================================

import {
  isValidMobileNumber,
  normalizeMobileNumber,
  toEnglishDigits,
} from "./auth-validation.js";
import { defaultI18n } from "./i18n-runtime.js";
import { globalLocaleService } from "./locale-service.js";
import { BUSINESS_TAXONOMY } from "./business-taxonomy.js";

export type AuthModalMode = "choice" | "buyer_mobile" | "buyer_otp" | "buyer_name" | "seller_mobile" | "seller_otp" | "seller_business";

export interface AuthSessionUser {
  id: string;
  mobile: string;
  role: "buyer" | "seller";
  firstName?: string | undefined;
  lastName?: string | undefined;
  displayName: string;
  businessName?: string | undefined;
  businessType?: string | undefined;
  workspaceId?: string | undefined;
  entityType?: "natural" | "legal" | undefined;
  nationalCode?: string | undefined;
  economicCode?: string | undefined;
  registrationNumber?: string | undefined;
  companyName?: string | undefined;
  verificationStatus?: "draft" | "submitted" | "verified" | undefined;
  profileCompleted?: boolean | undefined;
}

export interface AuthSuccessCallback {
  (user: AuthSessionUser, token: string): void;
}

let activeAuthCallback: AuthSuccessCallback | null = null;
let currentMode: AuthModalMode = "choice";
let currentMobile = "";
let currentDevCode = "";
let currentVerificationToken = "";
let currentSellerEntityType: "natural" | "legal" = "natural";
let otpCountdownTimer: number | null = null;
let otpRemainingSeconds = 120;

const AUTH_STORAGE_KEYS = {
  token: "phoenix-access-token",
  user: "phoenix-auth-user",
  workspace: "phoenix-workspace-id",
  business: "phoenix-business-id",
  businessType: "phoenix-business-type",
  businessIndustry: "phoenix-business-industry",
  businessOccupation: "phoenix-business-occupation",
  businessSubcategory: "phoenix-business-subcategory",
  sellerEntityType: "phoenix-seller-entity-type",
};

const inMemoryAuth = new Map<string, string>();

function getSessionItem(key: string): string | null {
  try {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return inMemoryAuth.get(key) ?? null;
}

function setSessionItem(key: string, val: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, val);
    }
  } catch {
    // fallback
  }
  inMemoryAuth.set(key, val);
}

function removeSessionItem(key: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(key);
    }
  } catch {
    // fallback
  }
  inMemoryAuth.delete(key);
}

function getLocalItem(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return inMemoryAuth.get(key) ?? null;
}

function setLocalItem(key: string, val: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, val);
    }
  } catch {
    // fallback
  }
  inMemoryAuth.set(key, val);
}

function removeLocalItem(key: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {
    // fallback
  }
  inMemoryAuth.delete(key);
}

export function getStoredAuth(): { token: string | null; user: AuthSessionUser | null } {
  try {
    const token = getSessionItem(AUTH_STORAGE_KEYS.token);
    const rawUser = getLocalItem(AUTH_STORAGE_KEYS.user);
    const user = rawUser ? (JSON.parse(rawUser) as AuthSessionUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function saveAuthSession(token: string, user: AuthSessionUser): void {
  setSessionItem(AUTH_STORAGE_KEYS.token, token);
  setLocalItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
  if (user.workspaceId) {
    setLocalItem(AUTH_STORAGE_KEYS.workspace, user.workspaceId);
  }
  if (user.businessName) {
    setLocalItem(AUTH_STORAGE_KEYS.business, user.id);
  }
  if (user.businessType) {
    setLocalItem(AUTH_STORAGE_KEYS.businessType, user.businessType);
  }
}

export function clearAuthSession(): void {
  removeSessionItem(AUTH_STORAGE_KEYS.token);
  removeLocalItem(AUTH_STORAGE_KEYS.user);
  removeLocalItem(AUTH_STORAGE_KEYS.workspace);
  removeLocalItem(AUTH_STORAGE_KEYS.business);
  removeLocalItem(AUTH_STORAGE_KEYS.businessType);
  removeLocalItem(AUTH_STORAGE_KEYS.businessIndustry);
  removeLocalItem(AUTH_STORAGE_KEYS.businessOccupation);
  removeLocalItem(AUTH_STORAGE_KEYS.businessSubcategory);
}

export function isUserAuthenticated(): boolean {
  return Boolean(getSessionItem(AUTH_STORAGE_KEYS.token));
}

if (typeof window !== "undefined") {
  (window as unknown as { openPhoenixAuthModal: typeof openAuthModal; isUserAuthenticated: typeof isUserAuthenticated }).openPhoenixAuthModal = openAuthModal;
  (window as unknown as { isUserAuthenticated: typeof isUserAuthenticated }).isUserAuthenticated = isUserAuthenticated;
}

export function openAuthModal(options: {
  initialMode?: AuthModalMode;
  onSuccess?: AuthSuccessCallback;
} = {}): void {
  currentMode = options.initialMode ?? "choice";
  if (options.onSuccess) {
    activeAuthCallback = options.onSuccess;
  }

  let modalOverlay = document.querySelector<HTMLElement>("#phoenix-auth-modal-overlay");
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "phoenix-auth-modal-overlay";
    modalOverlay.className = "ds-drawer-backdrop open phoenix-auth-overlay";
    modalOverlay.setAttribute("role", "dialog");
    modalOverlay.setAttribute("aria-modal", "true");
    document.body.appendChild(modalOverlay);
  }

  renderModalContent(modalOverlay);
  modalOverlay.classList.add("open");
  modalOverlay.setAttribute("aria-hidden", "false");
}

export function closeAuthModal(): void {
  const modalOverlay = document.querySelector<HTMLElement>("#phoenix-auth-modal-overlay");
  if (modalOverlay) {
    modalOverlay.classList.remove("open");
    modalOverlay.setAttribute("aria-hidden", "true");
  }
  if (otpCountdownTimer !== null) {
    clearInterval(otpCountdownTimer);
    otpCountdownTimer = null;
  }
}

function t(key: string, fallback: string): string {
  const text = defaultI18n.t(key);
  return text === key ? fallback : text;
}

function renderModalContent(container: HTMLElement): void {
  const dir = globalLocaleService.getDirection();

  container.innerHTML = `
    <div class="phoenix-auth-dialog glass-card" dir="${dir}">
      <header class="phoenix-auth-header">
        <div class="phoenix-auth-brand">
          <span class="phoenix-brand-mark"><img src="/phoenix-mark.svg?v=2" alt="" /></span>
          <strong>${t("common.appName", "ققنوس")}</strong>
        </div>
        <button type="button" class="button ds-button-icon phoenix-auth-close" data-auth-close aria-label="${t("common.close", "بستن")}">✕</button>
      </header>
      <div id="phoenix-auth-body" class="phoenix-auth-body">
        ${renderCurrentStepHtml()}
      </div>
    </div>
  `;

  bindModalEvents(container);
}

function renderCurrentStepHtml(): string {
  switch (currentMode) {
    case "choice":
      return renderChoiceScreen();
    case "buyer_mobile":
    case "seller_mobile":
      return renderMobileScreen(currentMode === "seller_mobile");
    case "buyer_otp":
    case "seller_otp":
      return renderOtpScreen(currentMode === "seller_otp");
    case "buyer_name":
      return renderBuyerNameScreen();
    case "seller_business":
      return renderSellerBusinessScreen();
    default:
      return renderChoiceScreen();
  }
}

// ----------------------------------------------------------------------------
// Screen 1: Choice Screen (ثبت‌نام در ققنوس - انتخاب خریدار یا فروشنده)
// ----------------------------------------------------------------------------
export function renderChoiceScreen(): string {
  return `
    <div class="phoenix-auth-choice-view">
      <div class="auth-headings">
        <span class="section-kicker">Phoenix Identity</span>
        <h2 class="auth-title">${t("auth.registerTitle", "عضویت در ققنوس")}</h2>
        <p class="auth-subtitle">${t("auth.registerSubtitle", "مسیر مورد نظر خود را برای شروع انتخاب کنید:")}</p>
      </div>

      <div class="auth-cards-grid">
        <!-- 1. Standard Platform Registration Track -->
        <button type="button" class="auth-track-card auth-track-buyer" data-select-track="buyer">
          <div class="track-icon">✦</div>
          <div class="track-copy">
            <strong class="track-title">${t("auth.buyerTrackTitle", "ثبت‌نام و استفاده از پلتفرم")}</strong>
            <span class="track-desc">${t("auth.buyerTrackDesc", "استفاده کامل از خدمات، جستجو، کشف و خرید هوشمند")}</span>
            <small class="track-hint">${t("auth.buyerTrackHint", "دسترسی مستقیم و آسان به تمامی امکانات پلتفرم")}</small>
          </div>
          <span class="track-arrow">←</span>
        </button>

        <!-- 2. Seller Registration Track -->
        <button type="button" class="auth-track-card auth-track-seller" data-select-track="seller">
          <div class="track-icon">🏪</div>
          <div class="track-copy">
            <strong class="track-title">${t("auth.sellerTrackTitle", "ثبت‌نام فروشنده")}</strong>
            <span class="track-desc">${t("auth.sellerTrackDesc", "ارائه خدمات، فروش محصولات و مدیریت کسب‌وکار")}</span>
            <small class="track-hint">${t("auth.sellerTrackHint", "برای فعالان، ارائه‌دهندگان کالا یا خدمات و صاحبان کسب‌وکار")}</small>
          </div>
          <span class="track-arrow">←</span>
        </button>
      </div>

      <div class="auth-footer-prompt">
        <span>${t("auth.alreadyHaveAccount", "قبلاً ثبت‌نام کرده‌اید؟")}</span>
        <button type="button" class="auth-link-button" data-select-track="buyer">${t("auth.signIn", "ورود به حساب")}</button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Screen 2: Mobile Number Input
// ----------------------------------------------------------------------------
export function renderMobileScreen(isSeller: boolean): string {
  const title = isSeller
    ? t("auth.sellerRegister", "ثبت‌نام فروشنده")
    : t("auth.buyerTrackTitle", "ثبت‌نام در پلتفرم");
  const desc = isSeller
    ? "شماره موبایل مدیر یا صاحب کسب‌وکار را برای احراز هویت وارد کنید."
    : "برای شروع عضویت، شماره موبایل خود را وارد کنید.";

  return `
    <div class="phoenix-auth-form-view">
      <div class="auth-headings">
        <button type="button" class="auth-back-button" data-back-to-choice>← ${t("common.back", "بازگشت")}</button>
        <h2 class="auth-title">${title}</h2>
        <p class="auth-subtitle">${desc}</p>
      </div>

      <form id="auth-mobile-form" class="auth-form" onsubmit="return false;">
        <div class="form-group">
          <label class="field-label" for="auth-mobile-input">${t("auth.mobile", "شماره موبایل")}</label>
          <div class="input-with-affix" dir="ltr">
            <span class="input-affix">🇮🇷 +98</span>
            <input
              id="auth-mobile-input"
              class="ds-field ds-input ds-input-lg"
              type="tel"
              inputmode="numeric"
              autocomplete="tel"
              placeholder="09123456789"
              value="${currentMobile}"
              required
              autofocus
            />
          </div>
          <span id="auth-mobile-error" class="form-error-msg" hidden></span>
        </div>

        <button type="submit" id="auth-mobile-submit" class="button button-primary button-lg w-full">
          <span class="btn-spinner" aria-hidden="true" hidden>
            <svg class="spinner-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
            </svg>
          </span>
          <span class="btn-text">${t("auth.getOtp", "دریافت کد تأیید")}</span>
        </button>
      </form>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Screen 3: OTP 6-Digit Verification
// ----------------------------------------------------------------------------
export function renderOtpScreen(_isSeller: boolean): string {
  return `
    <div class="phoenix-auth-form-view">
      <div class="auth-headings">
        <h2 class="auth-title">${t("auth.otpTitle", "کد تأیید")}</h2>
        <p class="auth-subtitle">
          ${t("auth.otpSentTo", "کد ارسال‌شده به {{mobile}}").replace("{{mobile}}", currentMobile)}
          <button type="button" class="auth-edit-link" data-edit-mobile>${t("auth.editMobile", "ویرایش شماره")}</button>
        </p>
      </div>

      ${currentDevCode ? `
        <div class="auth-dev-badge" role="status">
          <span>🧪 ${t("auth.devTestCode", "کد آزمایشی: {{code}}").replace("{{code}}", currentDevCode)}</span>
        </div>
      ` : ""}

      <form id="auth-otp-form" class="auth-form" onsubmit="return false;">
        <div class="form-group">
          <label class="field-label text-center" for="otp-digit-0">${t("auth.otpCode", "کد ۶ رقمی تأیید")}</label>
          <div class="otp-inputs-row" dir="ltr">
            <input class="otp-digit-input" id="otp-digit-0" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" autofocus />
            <input class="otp-digit-input" id="otp-digit-1" type="text" inputmode="numeric" maxlength="1" />
            <input class="otp-digit-input" id="otp-digit-2" type="text" inputmode="numeric" maxlength="1" />
            <input class="otp-digit-input" id="otp-digit-3" type="text" inputmode="numeric" maxlength="1" />
            <input class="otp-digit-input" id="otp-digit-4" type="text" inputmode="numeric" maxlength="1" />
            <input class="otp-digit-input" id="otp-digit-5" type="text" inputmode="numeric" maxlength="1" />
          </div>
          <span id="auth-otp-error" class="form-error-msg" hidden></span>
        </div>

        <div class="otp-timer-row">
          <span id="otp-timer-display" class="otp-timer">${t("auth.resendIn", "ارسال مجدد تا {{seconds}} ثانیه دیگر").replace("{{seconds}}", String(otpRemainingSeconds))}</span>
          <button type="button" id="auth-resend-btn" class="auth-link-button" hidden>${t("auth.resendOtp", "ارسال مجدد کد")}</button>
        </div>

        <button type="submit" id="auth-otp-submit" class="button button-primary button-lg w-full">
          <span>${t("auth.verifyOtp", "تأیید و ادامه")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Screen 4: Fast Buyer Completion (ONLY First Name + Last Name)
// ----------------------------------------------------------------------------
export function renderBuyerNameScreen(): string {
  return `
    <div class="phoenix-auth-form-view">
      <div class="auth-headings">
        <span class="section-kicker">Fast Registration</span>
        <h2 class="auth-title">${t("auth.completeRegistration", "تکمیل ثبت‌نام")}</h2>
        <p class="auth-subtitle">شماره شما تأیید شد. فقط نام و نام خانوادگی برای ایجاد حساب کافی است.</p>
      </div>

      <form id="auth-buyer-name-form" class="auth-form" onsubmit="return false;">
        <div class="form-row-grid">
          <div class="form-group">
            <label class="field-label" for="auth-first-name">${t("auth.firstName", "نام")}</label>
            <input id="auth-first-name" class="ds-field ds-input ds-input-lg" type="text" required placeholder="مثال: علی" autofocus />
          </div>
          <div class="form-group">
            <label class="field-label" for="auth-last-name">${t("auth.lastName", "نام خانوادگی")}</label>
            <input id="auth-last-name" class="ds-field ds-input ds-input-lg" type="text" required placeholder="مثال: محمدی" />
          </div>
        </div>

        <span id="auth-name-error" class="form-error-msg" hidden></span>

        <button type="submit" id="auth-name-submit" class="button button-primary button-lg w-full">
          <span>${t("auth.completeRegistration", "تکمیل ثبت‌نام و ورود")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Screen 5: Specialized Seller Registration (Business info & Dynamic Persona Type)
// ----------------------------------------------------------------------------
export function renderSellerBusinessScreen(): string {
  const industries = BUSINESS_TAXONOMY;
  const initialIndustry = industries[0] ?? { key: "apparel", labelKey: "taxonomy.industry.apparel", occupations: [] };
  const initialOccupation = initialIndustry.occupations[0] ?? { key: "clothing_store", labelKey: "taxonomy.occupation.clothing_store", subcategories: [] };

  const industryOptions = industries.map((ind) => `
    <option value="${ind.key}">${ind.icon} ${t(ind.labelKey, ind.key)}</option>
  `).join("");

  const occupationOptions = initialIndustry.occupations.map((occ) => `
    <option value="${occ.key}">${occ.icon} ${t(occ.labelKey, occ.key)}</option>
  `).join("");

  const subcategoryOptions = (initialOccupation.subcategories ?? []).map((sub) => `
    <option value="${sub.key}">${t(sub.labelKey, sub.key)}</option>
  `).join("");

  const isLegal = currentSellerEntityType === "legal";
  const currentUser = getStoredAuth().user;
  const initialManagerName = currentUser?.displayName || (currentUser?.firstName && currentUser?.lastName ? `${currentUser.firstName} ${currentUser.lastName}` : "") || "";

  return `
    <div class="phoenix-auth-form-view">
      <div class="auth-headings">
        <span class="section-kicker">Seller Onboarding</span>
        <h2 class="auth-title">${t("auth.sellerRegister", "ثبت‌نام فروشنده و مشخصات فعالیت")}</h2>
        <p class="auth-subtitle">نوع فعالیت خود را مشخص کرده و اطلاعات تخصصی را تکمیل فرمایید.</p>
      </div>

      <!-- Seller Persona Type Switcher (شخص حقیقی / شخص حقوقی) -->
      <div class="seller-entity-type-box" role="radiogroup" aria-label="نوع شخصیت فروشنده">
        <span class="field-label" style="display:block; margin-bottom:8px;">نوع فعالیت فروشنده:</span>
        <div class="seller-entity-toggle-pills">
          <button type="button" class="seller-entity-pill ${!isLegal ? "active" : ""}" data-seller-type="natural" aria-pressed="${!isLegal}">
            <span class="pill-icon" aria-hidden="true">👤</span>
            <div class="pill-text">
              <strong>فروشگاه مستقل</strong>
              <small>فعالیت انفرادی، فروشگاه شخصی یا آزادکار</small>
            </div>
          </button>
          <button type="button" class="seller-entity-pill ${isLegal ? "active" : ""}" data-seller-type="legal" aria-pressed="${isLegal}">
            <span class="pill-icon" aria-hidden="true">🏢</span>
            <div class="pill-text">
              <strong>شرکت و فروشگاه سازمانی</strong>
              <small>شرکت، مؤسسه تجاری، سازمان یا برند ثبت‌شده</small>
            </div>
          </button>
        </div>
      </div>

      <form id="auth-seller-business-form" class="auth-form" onsubmit="return false;" style="margin-top: 14px;">
        <!-- Core Manager & Business Names -->
        <div class="form-row-grid">
          <div class="form-group">
            <label class="field-label" for="seller-manager-name">${isLegal ? "نام و نام خانوادگی مدیرعامل / نماینده قانونی" : "نام و نام خانوادگی مدیر / صاحب کسب‌وکار"}</label>
            <input id="seller-manager-name" class="ds-field ds-input" type="text" required placeholder="${isLegal ? "مثال: سارا حسینی" : "مثال: علی محمدی"}" value="${initialManagerName}" autofocus />
          </div>
          <div class="form-group">
            <label class="field-label" for="seller-business-name">${isLegal ? "نام شرکت / نام کسب‌وکار سازمانی" : "نام فروشگاه / نام کسب‌وکار"}</label>
            <input id="seller-business-name" class="ds-field ds-input" type="text" required placeholder="${isLegal ? "مثال: شرکت تجارت هوشمند ایرانیان" : "مثال: استودیو پارس"}" />
          </div>
        </div>

        <!-- Dynamic Fields for Legal Entity (فقط در صورت انتخاب حقوقی نمایش داده می‌شوند) -->
        <div id="seller-legal-fields-container" style="${isLegal ? "display:block;" : "display:none;"}">
          <div class="form-row-grid">
            <div class="form-group">
              <label class="field-label" for="seller-reg-number">شناسه ملی شرکت / شماره ثبت</label>
              <input id="seller-reg-number" class="ds-field ds-input" type="text" inputmode="numeric" placeholder="مثال: ۱۰۱۰۳۹۸۴۲۱۵" />
            </div>
            <div class="form-group">
              <label class="field-label" for="seller-economic-code">کد اقتصادی (اختیاری)</label>
              <input id="seller-economic-code" class="ds-field ds-input" type="text" inputmode="numeric" placeholder="مثال: ۴۱۱۳۹۴۸۵۷۳۲۱" />
            </div>
          </div>
        </div>

        <!-- Dynamic Fields for Natural Entity (فقط در صورت انتخاب حقیقی) -->
        <div id="seller-natural-fields-container" style="${!isLegal ? "display:block;" : "display:none;"}">
          <div class="form-group">
            <label class="field-label" for="seller-national-code">کد ملی (جهت اعتبارسنجی بانکی و تسویه)</label>
            <input id="seller-national-code" class="ds-field ds-input" type="text" inputmode="numeric" maxlength="10" placeholder="مثال: ۰۰۱۲۳۴۵۶۷۸" />
          </div>
        </div>

        <!-- Taxonomy: Industry & Occupation -->
        <div class="form-row-grid">
          <div class="form-group">
            <label class="field-label" for="seller-industry-select">${t("auth.industry", "صنف اصلی")}</label>
            <select id="seller-industry-select" class="ds-field ds-select">
              ${industryOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="field-label" for="seller-occupation-select">${t("auth.occupation", "رسته تخصصی")}</label>
            <select id="seller-occupation-select" class="ds-field ds-select">
              ${occupationOptions}
            </select>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-group">
            <label class="field-label" for="seller-subcategory-select">${t("auth.subcategory", "زیررسته (اختیاری)")}</label>
            <select id="seller-subcategory-select" class="ds-field ds-select">
              <option value="">انتخاب زیررسته…</option>
              ${subcategoryOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="field-label" for="seller-specialization">${t("auth.specialization", "ویژگی یا حوزه تمرکز")}</label>
            <input id="seller-specialization" class="ds-field ds-input" type="text" placeholder="مثال: تأمین مستقیم، تضمین اصالت…" />
          </div>
        </div>

        <span id="auth-seller-error" class="form-error-msg" hidden></span>

        <button type="submit" id="auth-seller-submit" class="button button-primary button-lg w-full">
          <span>${t("auth.registerSellerSubmit", "تکمیل ثبت‌نام و ورود به پنل فروشنده")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Event Binding and Step Transitions
// ----------------------------------------------------------------------------
function bindModalEvents(container: HTMLElement): void {
  // Close buttons
  container.querySelectorAll("[data-auth-close]").forEach((btn) => {
    btn.addEventListener("click", closeAuthModal);
  });

  // Track selection
  container.querySelectorAll("[data-select-track]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const track = btn.getAttribute("data-select-track");
      currentMode = track === "seller" ? "seller_mobile" : "buyer_mobile";
      updateView(container);
    });
  });

  // Back to choice
  container.querySelectorAll("[data-back-to-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMode = "choice";
      updateView(container);
    });
  });

  // Edit mobile
  container.querySelectorAll("[data-edit-mobile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMode = currentMode === "seller_otp" ? "seller_mobile" : "buyer_mobile";
      updateView(container);
    });
  });

  // Seller Entity Type Switcher (Natural / Legal)
  container.querySelectorAll<HTMLButtonElement>("[data-seller-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-seller-type") as "natural" | "legal";
      if (type && type !== currentSellerEntityType) {
        currentSellerEntityType = type;
        const legalBox = container.querySelector<HTMLElement>("#seller-legal-fields-container");
        const naturalBox = container.querySelector<HTMLElement>("#seller-natural-fields-container");
        const managerLabel = container.querySelector<HTMLLabelElement>("label[for='seller-manager-name']");
        const businessLabel = container.querySelector<HTMLLabelElement>("label[for='seller-business-name']");

        container.querySelectorAll("[data-seller-type]").forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");

        if (type === "legal") {
          if (legalBox) legalBox.style.display = "block";
          if (naturalBox) naturalBox.style.display = "none";
          if (managerLabel) managerLabel.textContent = "نام و نام خانوادگی مدیرعامل / نماینده قانونی";
          if (businessLabel) businessLabel.textContent = "نام رسمی شرکت / برند ثبتی";
        } else {
          if (legalBox) legalBox.style.display = "none";
          if (naturalBox) naturalBox.style.display = "block";
          if (managerLabel) managerLabel.textContent = "نام و نام خانوادگی صاحب کسب‌وکار";
          if (businessLabel) businessLabel.textContent = "نام فروشگاه / نشان کاری";
        }
      }
    });
  });

  // 1. Mobile Form Handler
  const mobileForm = container.querySelector<HTMLFormElement>("#auth-mobile-form");
  if (mobileForm) {
    mobileForm.addEventListener("submit", async () => {
      const input = container.querySelector<HTMLInputElement>("#auth-mobile-input");
      const errorMsg = container.querySelector<HTMLElement>("#auth-mobile-error");
      const submitBtn = container.querySelector<HTMLButtonElement>("#auth-mobile-submit");
      if (!input || !submitBtn) return;

      const raw = input.value;
      const normalized = normalizeMobileNumber(raw);
      if (!isValidMobileNumber(normalized)) {
        if (errorMsg) {
          errorMsg.textContent = t("auth.invalidMobile", "شماره موبایل واردشده نامعتبر است.");
          errorMsg.hidden = false;
        }
        input.focus();
        return;
      }

      if (submitBtn.disabled || submitBtn.hasAttribute("disabled")) {
        return;
      }

      if (errorMsg) errorMsg.hidden = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute("disabled", "true");
      submitBtn.classList.add("is-loading");
      submitBtn.setAttribute("aria-busy", "true");
      const btnText = submitBtn.querySelector<HTMLElement>(".btn-text");
      const spinner = submitBtn.querySelector<HTMLElement>(".btn-spinner");
      if (spinner) spinner.hidden = false;
      if (btnText) btnText.textContent = t("auth.sendingOtp", "در حال ارسال کد…");

      currentMobile = normalized;

      try {
        const response = await fetch("/api/v1/auth/otp/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mobile: normalized }),
        });

        const result = (await response.json()) as { data?: { devCode?: string }; error?: { message?: string } };
        if (!response.ok) {
          throw new Error(result.error?.message || "درخواست کد با خطا مواجه شد.");
        }

        currentDevCode = result.data?.devCode ?? "";
        currentMode = currentMode === "seller_mobile" ? "seller_otp" : "buyer_otp";
        startOtpCountdown();
        updateView(container);
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = err instanceof Error ? err.message : "خطایی رخ داد.";
          errorMsg.hidden = false;
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.removeAttribute("disabled");
        submitBtn.classList.remove("is-loading");
        submitBtn.removeAttribute("aria-busy");
        if (spinner) spinner.hidden = true;
        if (btnText) btnText.textContent = t("auth.getOtp", "دریافت کد تأیید");
      }
    });
  }

  // 2. OTP Form & 6-digit Auto-advance & Paste Handler
  const otpForm = container.querySelector<HTMLFormElement>("#auth-otp-form");
  if (otpForm) {
    setupOtpDigitInputs(container);

    otpForm.addEventListener("submit", async () => {
      await submitOtpVerification(container);
    });

    const resendBtn = container.querySelector<HTMLButtonElement>("#auth-resend-btn");
    if (resendBtn) {
      resendBtn.addEventListener("click", async () => {
        try {
          const res = await fetch("/api/v1/auth/otp/request", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mobile: currentMobile }),
          });
          const result = (await res.json()) as { data?: { devCode?: string } };
          if (res.ok) {
            currentDevCode = result.data?.devCode ?? "";
            startOtpCountdown();
            updateView(container);
          }
        } catch {
          // ignore transient resend error
        }
      });
    }
  }

  // 3. Buyer Name Form Handler
  const buyerNameForm = container.querySelector<HTMLFormElement>("#auth-buyer-name-form");
  if (buyerNameForm) {
    buyerNameForm.addEventListener("submit", async () => {
      const firstInput = container.querySelector<HTMLInputElement>("#auth-first-name");
      const lastInput = container.querySelector<HTMLInputElement>("#auth-last-name");
      const errorMsg = container.querySelector<HTMLElement>("#auth-name-error");
      const submitBtn = container.querySelector<HTMLButtonElement>("#auth-name-submit");
      if (!firstInput || !lastInput || !submitBtn) return;

      const firstName = firstInput.value.trim();
      const lastName = lastInput.value.trim();

      if (!firstName || !lastName) {
        if (errorMsg) {
          errorMsg.textContent = t("auth.fillRequiredFields", "لطفاً نام و نام خانوادگی را وارد کنید.");
          errorMsg.hidden = false;
        }
        return;
      }

      submitBtn.disabled = true;
      const spinner = submitBtn.querySelector<HTMLElement>(".btn-spinner");
      if (spinner) spinner.hidden = false;

      try {
        const response = await fetch("/api/v1/auth/register/buyer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mobile: currentMobile,
            verificationToken: currentVerificationToken,
            firstName,
            lastName,
          }),
        });

        const result = (await response.json()) as { data?: { authenticated: boolean; accessToken: string; user: AuthSessionUser }; error?: { message?: string } };
        if (!response.ok || !result.data?.authenticated) {
          throw new Error(result.error?.message || "ثبت‌نام خریدار ناموفق بود.");
        }

        saveAuthSession(result.data.accessToken, result.data.user);
        closeAuthModal();

        if (activeAuthCallback) {
          activeAuthCallback(result.data.user, result.data.accessToken);
        }

        window.dispatchEvent(new CustomEvent("phoenix-auth-changed", { detail: result.data.user }));
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = err instanceof Error ? err.message : "ثبت‌نام انجام نشد.";
          errorMsg.hidden = false;
        }
      } finally {
        submitBtn.disabled = false;
        if (spinner) spinner.hidden = true;
      }
    });
  }

  // 4. Seller Business Form Handler & Taxonomy Cascade
  const sellerForm = container.querySelector<HTMLFormElement>("#auth-seller-business-form");
  if (sellerForm) {
    const indSelect = container.querySelector<HTMLSelectElement>("#seller-industry-select");
    const occSelect = container.querySelector<HTMLSelectElement>("#seller-occupation-select");
    const subSelect = container.querySelector<HTMLSelectElement>("#seller-subcategory-select");

    // Industry cascade
    if (indSelect && occSelect && subSelect) {
      indSelect.addEventListener("change", () => {
        const selected = BUSINESS_TAXONOMY.find((i) => i.key === indSelect.value);
        if (!selected) return;

        occSelect.innerHTML = selected.occupations.map((occ) => `
          <option value="${occ.key}">${occ.icon} ${t(occ.labelKey, occ.key)}</option>
        `).join("");

        const firstOcc = selected.occupations[0];
        subSelect.innerHTML = '<option value="">انتخاب زیررسته…</option>' +
          (firstOcc?.subcategories ?? []).map((sub) => `<option value="${sub.key}">${t(sub.labelKey, sub.key)}</option>`).join("");
      });

      occSelect.addEventListener("change", () => {
        const ind = BUSINESS_TAXONOMY.find((i) => i.key === indSelect.value);
        const occ = ind?.occupations.find((o) => o.key === occSelect.value);
        subSelect.innerHTML = '<option value="">انتخاب زیررسته…</option>' +
          (occ?.subcategories ?? []).map((sub) => `<option value="${sub.key}">${t(sub.labelKey, sub.key)}</option>`).join("");
      });
    }

    sellerForm.addEventListener("submit", async () => {
      const managerInput = container.querySelector<HTMLInputElement>("#seller-manager-name");
      const businessInput = container.querySelector<HTMLInputElement>("#seller-business-name");
      const errorMsg = container.querySelector<HTMLElement>("#auth-seller-error");
      const submitBtn = container.querySelector<HTMLButtonElement>("#auth-seller-submit");
      if (!managerInput || !businessInput || !indSelect || !occSelect || !subSelect || !submitBtn) return;

      const managerName = managerInput.value.trim();
      const businessName = businessInput.value.trim();
      const industry = indSelect.value;
      const occupation = occSelect.value;
      const subcategory = subSelect.value;
      const specialization = container.querySelector<HTMLInputElement>("#seller-specialization")?.value.trim() ?? "";
      const regNumber = container.querySelector<HTMLInputElement>("#seller-reg-number")?.value.trim() ?? "";
      const economicCode = container.querySelector<HTMLInputElement>("#seller-economic-code")?.value.trim() ?? "";
      const nationalCode = container.querySelector<HTMLInputElement>("#seller-national-code")?.value.trim() ?? "";

      if (!managerName || !businessName) {
        if (errorMsg) {
          errorMsg.textContent = t("auth.fillRequiredFields", "لطفاً نام مدیر و نام کسب‌وکار را وارد کنید.");
          errorMsg.hidden = false;
        }
        return;
      }

      submitBtn.disabled = true;
      const spinner = submitBtn.querySelector<HTMLElement>(".btn-spinner");
      if (spinner) spinner.hidden = false;

      const existingToken = getSessionItem(AUTH_STORAGE_KEYS.token);
      const isUpgrade = Boolean(existingToken && !currentVerificationToken);

      try {
        const url = isUpgrade ? "/api/v1/auth/seller/upgrade" : "/api/v1/auth/register/seller";
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (isUpgrade && existingToken) {
          headers.authorization = `Bearer ${existingToken}`;
        }

        const payload: Record<string, unknown> = {
          managerName,
          businessName,
          industry,
          occupation,
          subcategory,
          specialization,
          entityType: currentSellerEntityType,
          nationalCode,
          economicCode,
          registrationNumber: regNumber,
          companyName: currentSellerEntityType === "legal" ? businessName : undefined,
        };

        if (!isUpgrade) {
          payload.mobile = currentMobile;
          payload.verificationToken = currentVerificationToken;
        }

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const result = (await response.json()) as {
          data?: {
            authenticated?: boolean;
            success?: boolean;
            accessToken?: string;
            workspaceId?: string;
            businessId?: string;
            businessType?: string;
            user?: AuthSessionUser;
            profile?: AuthSessionUser;
          };
          error?: { message?: string };
        };

        if (!response.ok || (!result.data?.authenticated && !result.data?.success)) {
          throw new Error(result.error?.message || "ثبت‌نام فروشنده ناموفق بود.");
        }

        const effectiveToken = result.data.accessToken || existingToken || "";
        const currentUser = getStoredAuth().user || ({} as AuthSessionUser);
        const updatedUser: AuthSessionUser = {
          ...currentUser,
          ...(result.data.user || {}),
          role: "seller",
          displayName: managerName || currentUser.displayName || "مدیر کسب‌وکار",
          workspaceId: result.data.workspaceId || currentUser.workspaceId || `ws_${Date.now()}`,
          businessName,
          businessType: result.data.businessType || currentUser.businessType || "retail_clothing",
          entityType: currentSellerEntityType,
          nationalCode,
          economicCode,
          registrationNumber: regNumber,
          companyName: currentSellerEntityType === "legal" ? businessName : undefined,
          profileCompleted: true,
          verificationStatus: "submitted",
        };

        saveAuthSession(effectiveToken, updatedUser);

        localStorage.setItem(AUTH_STORAGE_KEYS.businessIndustry, industry);
        localStorage.setItem(AUTH_STORAGE_KEYS.businessOccupation, occupation);
        localStorage.setItem(AUTH_STORAGE_KEYS.sellerEntityType, currentSellerEntityType);
        if (subcategory) {
          localStorage.setItem(AUTH_STORAGE_KEYS.businessSubcategory, subcategory);
        }

        closeAuthModal();

        if (activeAuthCallback) {
          activeAuthCallback(updatedUser, effectiveToken);
        }

        window.dispatchEvent(new CustomEvent("phoenix-auth-changed", { detail: updatedUser }));

        // Navigate to specialized business dashboard
        if (typeof window !== "undefined") {
          window.location.href = "/business";
        }
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = err instanceof Error ? err.message : "ثبت‌نام انجام نشد.";
          errorMsg.hidden = false;
        }
      } finally {
        submitBtn.disabled = false;
        if (spinner) spinner.hidden = true;
      }
    });
  }
}

function updateView(container: HTMLElement): void {
  const body = container.querySelector<HTMLElement>("#phoenix-auth-body");
  if (body) {
    body.innerHTML = renderCurrentStepHtml();
    bindModalEvents(container);
  }
}

function setupOtpDigitInputs(container: HTMLElement): void {
  const digits = container.querySelectorAll<HTMLInputElement>(".otp-digit-input");
  digits.forEach((input, index) => {
    input.addEventListener("input", (e) => {
      const val = toEnglishDigits((e.target as HTMLInputElement).value);
      if (val.length > 0) {
        input.value = val[val.length - 1]!;
        if (index < digits.length - 1) {
          digits[index + 1]?.focus();
        } else {
          // All 6 digits entered: auto-submit!
          void submitOtpVerification(container);
        }
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) {
        digits[index - 1]?.focus();
      }
    });

    // Paste handler for all 6 digits
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = toEnglishDigits(e.clipboardData?.getData("text") ?? "").replace(/\D/g, "");
      if (pasted.length >= 6) {
        for (let i = 0; i < 6; i++) {
          if (digits[i]) digits[i]!.value = pasted[i]!;
        }
        digits[5]?.focus();
        void submitOtpVerification(container);
      }
    });
  });
}

async function submitOtpVerification(container: HTMLElement): Promise<void> {
  const digits = container.querySelectorAll<HTMLInputElement>(".otp-digit-input");
  let code = "";
  digits.forEach((d) => (code += d.value));

  const errorMsg = container.querySelector<HTMLElement>("#auth-otp-error");
  const submitBtn = container.querySelector<HTMLButtonElement>("#auth-otp-submit");

  if (code.length !== 6) {
    if (errorMsg) {
      errorMsg.textContent = "لطفاً کد ۶ رقمی را کامل وارد کنید.";
      errorMsg.hidden = false;
    }
    return;
  }

  if (errorMsg) errorMsg.hidden = true;
  if (submitBtn) submitBtn.disabled = true;

  try {
    const response = await fetch("/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile: currentMobile, code }),
    });

    const result = (await response.json()) as {
      data?: {
        authenticated: boolean;
        isNewUser: boolean;
        accessToken?: string;
        verificationToken?: string;
        user?: AuthSessionUser;
      };
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(result.error?.message || t("auth.invalidOtp", "کد واردشده صحیح نیست."));
    }

    if (result.data?.isNewUser && result.data.verificationToken) {
      // NEW USER: Transition to Fast Name or Business Info
      currentVerificationToken = result.data.verificationToken;
      currentMode = currentMode === "seller_otp" ? "seller_business" : "buyer_name";
      updateView(container);
    } else if (result.data?.authenticated && result.data.user && result.data.accessToken) {
      // EXISTING USER: Logged in immediately!
      saveAuthSession(result.data.accessToken, result.data.user);
      closeAuthModal();

      if (activeAuthCallback) {
        activeAuthCallback(result.data.user, result.data.accessToken);
      }

      window.dispatchEvent(new CustomEvent("phoenix-auth-changed", { detail: result.data.user }));
    }
  } catch (err) {
    if (errorMsg) {
      errorMsg.textContent = err instanceof Error ? err.message : t("auth.invalidOtp", "کد واردشده صحیح نیست.");
      errorMsg.hidden = false;
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function startOtpCountdown(): void {
  if (otpCountdownTimer !== null) {
    clearInterval(otpCountdownTimer);
  }
  otpRemainingSeconds = 120;
  otpCountdownTimer = window.setInterval(() => {
    otpRemainingSeconds -= 1;
    const timerDisplay = document.querySelector<HTMLElement>("#otp-timer-display");
    const resendBtn = document.querySelector<HTMLButtonElement>("#auth-resend-btn");

    if (timerDisplay) {
      timerDisplay.textContent = t("auth.resendIn", "ارسال مجدد تا {{seconds}} ثانیه دیگر").replace("{{seconds}}", String(Math.max(otpRemainingSeconds, 0)));
    }

    if (otpRemainingSeconds <= 0) {
      if (otpCountdownTimer !== null) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
      }
      if (timerDisplay) timerDisplay.hidden = true;
      if (resendBtn) resendBtn.hidden = false;
    }
  }, 1000);
}
