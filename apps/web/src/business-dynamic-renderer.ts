/**
 * Phoenix Dynamic Business Renderer
 *
 * Implements schema-driven Profile and Dashboard renderers
 * fully adapted to Industry, Occupation, Subcategory and BusinessType.
 *
 * Follows the Universal Frontend Design Constitution:
 * - Anti-slop discipline (no static pill sandwiches, clean unboxed metadata with separators)
 * - Domain-native visual language
 * - Strict RTL/LTR bidirectional support
 * - Accessible keyboard & ARIA semantics
 */

import { BUSINESS_TAXONOMY, type BusinessType } from "./business-taxonomy.js";
import { getBusinessTypeSchema, type BusinessTypeSchema } from "./business-schema.js";
import { defaultI18n, translateUiText } from "./i18n-runtime.js";

function escapeHtml(value: unknown): string {
  const str = String(value ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}

function t(key: string, fallback?: string): string {
  const res = defaultI18n.t(key);
  if (res === key && fallback) return fallback;
  return res;
}

function localized(keyOrText: string): string {
  if (keyOrText.startsWith("taxonomy.") || keyOrText.startsWith("sellerDashboard.") || keyOrText.startsWith("sellerProfile.")) {
    return escapeHtml(t(keyOrText));
  }
  return escapeHtml(translateUiText(keyOrText, defaultI18n.getLanguage()));
}

export interface DynamicRendererOptions {
  readonly businessId?: string | undefined;
  readonly businessName?: string | undefined;
  readonly businessType?: BusinessType | undefined;
  readonly industryKey?: string | undefined;
  readonly occupationKey?: string | undefined;
  readonly subcategoryKey?: string | undefined;
  readonly specialization?: string | undefined;
  readonly address?: string | undefined;
  readonly phone?: string | undefined;
  readonly workingHours?: string | undefined;
  readonly onBusinessTypeChange?: string | undefined; // name of JS callback or event trigger
}

/**
 * Render dynamic dashboard based on business taxonomy and schema.
 */
export function renderDynamicBusinessDashboard(options: DynamicRendererOptions): string {
  const businessType: BusinessType = options.businessType ?? "retail_clothing";
  const schema: BusinessTypeSchema = getBusinessTypeSchema(businessType);
  const name = options.businessName || t("sellerDashboard.defaultBusinessName", "کسب‌وکار ققنوس");
  const specialization = options.specialization || t("sellerDashboard.defaultSpecialization", "تخصصی");

  const kpisHtml = schema.dashboardKpis.map((kpi, idx) => {
    const changeHtml = kpi.change
      ? `<span class="kpi-trend ${kpi.isPositive ? "kpi-trend-up" : "kpi-trend-warn"}">${escapeHtml(kpi.change)}</span>`
      : "";
    return `
      <article class="glass-card dynamic-kpi-card" data-kpi-id="${escapeAttr(kpi.id)}">
        <div class="dynamic-kpi-header">
          <span class="dynamic-kpi-icon" aria-hidden="true">${kpi.icon}</span>
          <span class="dynamic-kpi-label">${localized(kpi.labelKey)}</span>
        </div>
        <div class="dynamic-kpi-body">
          <strong class="dynamic-kpi-value" id="kpi-val-${idx}">${escapeHtml(kpi.value)}</strong>
          ${changeHtml}
        </div>
      </article>
    `;
  }).join("");

  const quickActionsHtml = schema.quickActions.map((qa) => {
    const btnClass = qa.isPrimary ? "button button-primary" : "button button-secondary";
    return `
      <a class="${btnClass} dynamic-qa-btn" href="${escapeAttr(qa.path)}" data-nav>
        <span aria-hidden="true">${qa.icon}</span>
        <span>${localized(qa.labelKey)}</span>
      </a>
    `;
  }).join("");

  const aiRecommendationsHtml = schema.aiRecommendations.map((rec) => {
    const urgencyClass = rec.urgency === "critical"
      ? "ai-rec-critical"
      : rec.urgency === "warning"
        ? "ai-rec-warning"
        : "ai-rec-opportunity";
    return `
      <article class="glass-card dynamic-ai-card ${urgencyClass}">
        <div class="dynamic-ai-header">
          <div class="dynamic-ai-tag">
            <span class="dynamic-ai-sparkle">✦</span>
            <span>${t("sellerDashboard.aiCopilotBadge", "پیشنهاد هوش مصنوعی ققنوس")}</span>
          </div>
          <span class="dynamic-ai-urgency">${t("sellerDashboard.ai." + rec.urgency, "تحلیل بلادرنگ")}</span>
        </div>
        <h3 class="dynamic-ai-title">${localized(rec.titleKey)}</h3>
        <p class="dynamic-ai-text">${localized(rec.textKey)}</p>
        <div class="dynamic-ai-footer">
          <a class="button button-primary dynamic-ai-action" href="${escapeAttr(rec.actionPath)}" data-nav>
            <span>${localized(rec.actionLabelKey)}</span>
            <span aria-hidden="true">←</span>
          </a>
        </div>
      </article>
    `;
  }).join("");

  const workflowStepsHtml = schema.workflowSteps.map((step, idx) => {
    return `
      <div class="dynamic-workflow-step ${idx === 0 ? "active" : ""}">
        <div class="dynamic-step-circle">${step.stepNumber}</div>
        <div class="dynamic-step-info">
          <strong>${localized(step.labelKey)}</strong>
          <small>${localized(step.descriptionKey)}</small>
        </div>
      </div>
    `;
  }).join("");

  // Domain-specific worklist records
  const sampleWorklistHtml = renderSampleWorklist(businessType);

  // Business type options for the live preview switcher
  const typeOptionsHtml = Object.keys(BUSINESS_TAXONOMY).flatMap(() => {
    return [
      { key: "retail_clothing", label: "پوشاک و مد (فروشگاه لباس)" },
      { key: "medical_clinic", label: "پزشکی و سلامت (مطب پزشک)" },
      { key: "food_restaurant", label: "غذا و پذیرایی (رستوران)" },
      { key: "beauty_salon", label: "زیبایی و سلامت (سالن زیبایی)" },
      { key: "retail_digital", label: "کالای دیجیتال (فروشگاه موبایل و رایانه)" },
      { key: "service_repair", label: "فنی و تعمیرات (تعمیرگاه تخصصی)" },
      { key: "education_academy", label: "آموزش و آکادمی (آموزشگاه)" },
      { key: "hospitality_hotel", label: "گردشگری و اقامت (هتل و بوم‌گردی)" },
      { key: "professional_consulting", label: "مشاوره و خدمات حرفه‌ای (دفتر مشاوره)" },
    ].map((opt) => `<option value="${opt.key}" ${opt.key === businessType ? "selected" : ""}>${escapeHtml(opt.label)}</option>`);
  }).join("");

  return `
    <div class="phoenix-dynamic-dashboard" data-business-type="${escapeAttr(businessType)}">
      <!-- Dashboard Hero -->
      <section class="dynamic-dash-hero glass-card">
        <div class="dynamic-dash-hero-info">
          <div class="dynamic-dash-badge-row">
            <span class="dynamic-dash-trade-badge">
              <span aria-hidden="true">${schema.icon}</span>
              <span>${localized(schema.titleKey)}</span>
            </span>
            <span class="meta-sep" aria-hidden="true">·</span>
            <span class="dynamic-dash-spec-text">${escapeHtml(specialization)}</span>
            <span class="meta-sep" aria-hidden="true">·</span>
            <span class="dynamic-dash-status-verified">✓ ${t("sellerDashboard.verified", "کسب‌وکار احراز شده")}</span>
          </div>
          <h1 class="dynamic-dash-name">${escapeHtml(name)}</h1>
          <p class="dynamic-dash-subtitle">${t("sellerDashboard.adaptiveWorkspaceSubtitle", "داشبورد اختصاصی صنف متناسب با فرآیندهای کاری و قابلیت‌های فعال شما.")}</p>
        </div>

        <div class="dynamic-dash-hero-controls">
          <label class="dynamic-trade-switcher-label" for="dashboard-trade-switcher">
            <span>${t("sellerDashboard.tradeViewLabel", "مشاهده داشبورد صنف:")}</span>
            <select id="dashboard-trade-switcher" class="ds-field ds-select dynamic-trade-select" data-trade-switcher>
              ${typeOptionsHtml}
            </select>
          </label>
          <a class="button button-primary dynamic-primary-cta" href="${escapeAttr(schema.primaryCta.path)}" data-nav>
            <span aria-hidden="true">${schema.primaryCta.icon}</span>
            <span>${localized(schema.primaryCta.labelKey)}</span>
          </a>
        </div>
      </section>

      <!-- AI Copilot Alerts -->
      <section class="dynamic-dash-ai-grid" aria-label="${t("sellerDashboard.aiSuggestionsAria", "پیشنهادهای هوش مصنوعی")}">
        ${aiRecommendationsHtml}
      </section>

      <!-- KPI Metrics Grid -->
      <section class="dynamic-dash-kpi-grid" aria-label="${t("sellerDashboard.kpiGridAria", "شاخص‌های کلیدی عملکرد")}">
        ${kpisHtml}
      </section>

      <!-- Quick Actions Bar -->
      <section class="glass-card dynamic-dash-actions-card">
        <div class="card-section-heading">
          <div>
            <span class="section-kicker">${t("sellerDashboard.quickActionsKicker", "دسترسی‌های سریع")}</span>
            <h2>${t("sellerDashboard.quickActionsTitle", "عملیات‌های پرکاربرد صنف شما")}</h2>
          </div>
        </div>
        <div class="dynamic-dash-actions-grid">
          ${quickActionsHtml}
        </div>
      </section>

      <!-- Business Workflow Progress -->
      <section class="glass-card dynamic-dash-workflow-card">
        <div class="card-section-heading">
          <div>
            <span class="section-kicker">${t("sellerDashboard.workflowKicker", "گردش کار")}</span>
            <h2>${t("sellerDashboard.workflowTitle", "مراحل استاندارد ارائه خدمت و پردازش")}</h2>
          </div>
        </div>
        <div class="dynamic-dash-workflow-rail">
          ${workflowStepsHtml}
        </div>
      </section>

      <!-- Domain Operational Worklist Table -->
      <section class="glass-card dynamic-dash-worklist-card">
        ${sampleWorklistHtml}
      </section>

      <!-- Active Capabilities Footnote -->
      <section class="dynamic-dash-capabilities-bar">
        <span class="dynamic-cap-label">${t("sellerDashboard.activeCapabilitiesLabel", "قابلیت‌های فعال صنف:")}</span>
        <div class="dynamic-cap-list">
          ${schema.capabilities.map((cap) => `<span class="dynamic-cap-item">${escapeHtml(cap)}</span>`).join('<span class="meta-sep" aria-hidden="true">·</span>')}
        </div>
      </section>
    </div>
  `;
}

function renderSampleWorklist(businessType: BusinessType): string {
  switch (businessType) {
    case "medical_clinic":
    case "medical_specialty_clinic":
      return `
        <div class="card-section-heading">
          <div>
            <span class="section-kicker">${t("sellerDashboard.worklist.clinicKicker", "نوبت‌های امروز")}</span>
            <h2>${t("sellerDashboard.worklist.clinicTitle", "لیست مراجعان و وضعیت ویزیت")}</h2>
          </div>
          <a class="button button-ghost" href="/booking" data-nav>${t("common.viewAll", "مشاهده تقویم کامل")}</a>
        </div>
        <div class="ds-table-wrap">
          <table class="ds-table">
            <thead>
              <tr>
                <th scope="col">ساعت</th>
                <th scope="col">بیمار</th>
                <th scope="col">نوع خدمت</th>
                <th scope="col">پزشک معالج</th>
                <th scope="col">بیمه</th>
                <th scope="col">وضعیت</th>
                <th scope="col">اقدام</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>۱۶:۰۰</strong></td>
                <td>مریم رضایی</td>
                <td>ویزیت و مشاوره پوست</td>
                <td>دکتر سمیعی</td>
                <td>تأمین اجتماعی</td>
                <td><span class="text-status-active">حاضر در مطب</span></td>
                <td><a class="button button-ghost button-sm" href="/booking" data-nav>شروع ویزیت</a></td>
              </tr>
              <tr>
                <td><strong>۱۶:۳۰</strong></td>
                <td>علی صابری</td>
                <td>پاکسازی و لیزر درمانی</td>
                <td>دکتر سمیعی</td>
                <td>آزاد</td>
                <td><span class="text-status-pending">در انتظار نوبت</span></td>
                <td><a class="button button-ghost button-sm" href="/booking" data-nav>پذیرش</a></td>
              </tr>
              <tr>
                <td><strong>۱۷:۱۵</strong></td>
                <td>سارا کاظمی</td>
                <td>معاینه دوره‌ای</td>
                <td>دکتر سمیعی</td>
                <td>بیمه سلامت</td>
                <td><span class="text-status-confirmed">تایید شده پیامکی</span></td>
                <td><a class="button button-ghost button-sm" href="/booking" data-nav>جزئیات</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

    case "food_restaurant":
    case "food_cafe":
      return `
        <div class="card-section-heading">
          <div>
            <span class="section-kicker">${t("sellerDashboard.worklist.restaurantKicker", "سفارش‌های زنده")}</span>
            <h2>${t("sellerDashboard.worklist.restaurantTitle", "صف آشپزخانه و میزهای سالن")}</h2>
          </div>
          <a class="button button-ghost" href="/orders" data-nav>${t("common.viewAll", "مشاهده فیش‌ها")}</a>
        </div>
        <div class="ds-table-wrap">
          <table class="ds-table">
            <thead>
              <tr>
                <th scope="col">شماره فیش</th>
                <th scope="col">میز / نوع</th>
                <th scope="col">اقلام سفارش</th>
                <th scope="col">مبلغ</th>
                <th scope="col">زمان ثبت</th>
                <th scope="col">وضعیت آشپزخانه</th>
                <th scope="col">اقدام</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>#۱۰۴۲</strong></td>
                <td>میز شماره ۴ (سالن)</td>
                <td>۲ کباب برگ، ۲ برنج ایرانی، زیتون پرورده</td>
                <td>۷۲۰,۰۰۰ تومان</td>
                <td>۱۲ دقیقه پیش</td>
                <td><span class="text-status-pending">در حال پخت</span></td>
                <td><a class="button button-ghost button-sm" href="/orders" data-nav>آماده تحویل</a></td>
              </tr>
              <tr>
                <td><strong>#۱۰۴۱</strong></td>
                <td>بیرون‌بر (پیک ققنوس)</td>
                <td>۱ جوجه کباب، ۱ ماست موسیر، ۲ نوشابه</td>
                <td>۳۱۰,۰۰۰ تومان</td>
                <td>۲۵ دقیقه پیش</td>
                <td><span class="text-status-active">بسته‌بندی شد</span></td>
                <td><a class="button button-ghost button-sm" href="/operations" data-nav>تحویل به سفیر</a></td>
              </tr>
              <tr>
                <td><strong>#۱۰۴۰</strong></td>
                <td>میز شماره ۷ (رزرو ۱۸:۰۰)</td>
                <td>پیش‌سفارش پذیرایی VIP</td>
                <td>۱,۴۵۰,۰۰۰ تومان</td>
                <td>امروز ۱۲:۳۰</td>
                <td><span class="text-status-confirmed">رزرو تایید شده</span></td>
                <td><a class="button button-ghost button-sm" href="/booking" data-nav>مشاهده میز</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

    case "beauty_salon":
      return `
        <div class="card-section-heading">
          <div>
            <span class="section-kicker">${t("sellerDashboard.worklist.salonKicker", "وقت‌های سالن")}</span>
            <h2>${t("sellerDashboard.worklist.salonTitle", "برنامه کاری امروز و نوبت متخصصان")}</h2>
          </div>
          <a class="button button-ghost" href="/booking" data-nav>${t("common.viewAll", "تقویم سالن")}</a>
        </div>
        <div class="ds-table-wrap">
          <table class="ds-table">
            <thead>
              <tr>
                <th scope="col">ساعت</th>
                <th scope="col">مشتری</th>
                <th scope="col">خدمت درخواستی</th>
                <th scope="col">متخصص آرایش</th>
                <th scope="col">وضعیت</th>
                <th scope="col">اقدام</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>۱۵:۰۰</strong></td>
                <td>نیلوفر تهرانی</td>
                <td>رنگ و لایت تخصصی</td>
                <td>خانم جلالی</td>
                <td><span class="text-status-active">در حال انجام</span></td>
                <td><a class="button button-ghost button-sm" href="/booking" data-nav>ثبت پایان</a></td>
              </tr>
              <tr>
                <td><strong>۱۶:۳۰</strong></td>
                <td>پگاه شمس</td>
                <td>طراحی و کاشت ناخن</td>
                <td>خانم نادری</td>
                <td><span class="text-status-confirmed">نوبت تایید شده</span></td>
                <td><a class="button button-ghost button-sm" href="/booking" data-nav>پذیرش مشتری</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

    case "service_repair":
      return `
        <div class="card-section-heading">
          <div>
            <span class="section-kicker">${t("sellerDashboard.worklist.repairKicker", "کارت‌های تعمیر")}</span>
            <h2>${t("sellerDashboard.worklist.repairTitle", "دستگاه‌های پذیرش‌شده و صف عیب‌یابی")}</h2>
          </div>
          <a class="button button-ghost" href="/operations" data-nav>${t("common.viewAll", "مشاهده کارگاه")}</a>
        </div>
        <div class="ds-table-wrap">
          <table class="ds-table">
            <thead>
              <tr>
                <th scope="col">کد پذیرش</th>
                <th scope="col">دستگاه / خودرو</th>
                <th scope="col">شرح نقص فنی</th>
                <th scope="col">تکنسین</th>
                <th scope="col">وضعیت</th>
                <th scope="col">اقدام</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>#WO-۲۹۱</strong></td>
                <td>پژو ۲۰۶ تیپ ۵</td>
                <td>تعویض دیسک و صفحه کلاچ</td>
                <td>استاد رحیمی</td>
                <td><span class="text-status-pending">در حال تعمیر</span></td>
                <td><a class="button button-ghost button-sm" href="/operations" data-nav>ثبت قطعه مصرفی</a></td>
              </tr>
              <tr>
                <td><strong>#WO-۲۹۰</strong></td>
                <td>لپ‌تاپ ایسوس زن‌بوک</td>
                <td>تعویض باتری و فن خنک‌کننده</td>
                <td>مهندس مرادی</td>
                <td><span class="text-status-active">آماده تحویل</span></td>
                <td><a class="button button-ghost button-sm" href="/operations" data-nav>اطلاع‌رسانی به مشتری</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

    case "retail_clothing":
    case "retail_digital":
    default:
      return `
        <div class="card-section-heading">
          <div>
            <span class="section-kicker">${t("sellerDashboard.worklist.retailKicker", "سفارش‌های جدید")}</span>
            <h2>${t("sellerDashboard.worklist.retailTitle", "سفارش‌های در انتظار بسته‌بندی و ارسال")}</h2>
          </div>
          <a class="button button-ghost" href="/orders" data-nav>${t("common.viewAll", "مشاهده همه سفارش‌ها")}</a>
        </div>
        <div class="ds-table-wrap">
          <table class="ds-table">
            <thead>
              <tr>
                <th scope="col">شماره سفارش</th>
                <th scope="col">خریدار</th>
                <th scope="col">اقلام</th>
                <th scope="col">مبلغ فاکتور</th>
                <th scope="col">شهر مقصد</th>
                <th scope="col">وضعیت</th>
                <th scope="col">اقدام</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>#ORD-۸۸۴۳</strong></td>
                <td>مهسا رادپور</td>
                <td>مانتو کتی لینن (سایز M، کرم)</td>
                <td>۱,۴۵۰,۰۰۰ تومان</td>
                <td>اصفهان</td>
                <td><span class="text-status-pending">در انتظار بسته‌بندی</span></td>
                <td><a class="button button-ghost button-sm" href="/orders" data-nav>تولید برچسب پستی</a></td>
              </tr>
              <tr>
                <td><strong>#ORD-۸۸۴۲</strong></td>
                <td>امیرحسین کیانی</td>
                <td>پیراهن آستین‌بلند کلاسیک (سایز L، سورمه‌ای)</td>
                <td>۸۹۰,۰۰۰ تومان</td>
                <td>تهران</td>
                <td><span class="text-status-active">آماده تحویل به پیک</span></td>
                <td><a class="button button-ghost button-sm" href="/orders" data-nav>ارسال مرسوله</a></td>
              </tr>
              <tr>
                <td><strong>#ORD-۸۸۴۰</strong></td>
                <td>فاطمه ابراهیمی</td>
                <td>شال وال اسلپ (تک‌رنگ مشکی)</td>
                <td>۲۸۰,۰۰۰ تومان</td>
                <td>مشهد</td>
                <td><span class="text-status-confirmed">تحویل پست شد</span></td>
                <td><a class="button button-ghost button-sm" href="/orders" data-nav>پیگیری مرسوله</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
  }
}

/**
 * Render dynamic public profile based on business taxonomy and schema.
 */
export function renderDynamicBusinessProfile(options: DynamicRendererOptions): string {
  const businessType: BusinessType = options.businessType ?? "retail_clothing";
  const schema: BusinessTypeSchema = getBusinessTypeSchema(businessType);
  const name = options.businessName || t("sellerProfile.defaultName", "فروشگاه تخصصی ققنوس");
  const specialization = options.specialization || t("sellerProfile.defaultSpec", "برگزیده در پلتفرم ققنوس");
  const address = options.address || "تهران، خیابان ولیعصر، نرسیده به میدان ونک، پلاک ۲۴";
  const phone = options.phone || "۰۲۱-۸۸۲۲۳۳۴۴";
  const workingHours = options.workingHours || "شنبه تا پنج‌شنبه: ۹:۰۰ الی ۲۱:۰۰";

  const profileHeroHtml = `
    <section class="dynamic-profile-hero glass-card">
      <div class="dynamic-profile-cover">
        <div class="dynamic-profile-avatar-box">
          <span class="dynamic-profile-avatar-icon" aria-hidden="true">${schema.icon}</span>
        </div>
      </div>
      <div class="dynamic-profile-hero-body">
        <div class="dynamic-profile-header-meta">
          <span class="dynamic-profile-trade-badge">${localized(schema.titleKey)}</span>
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="dynamic-profile-spec-kicker">${escapeHtml(specialization)}</span>
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="dynamic-profile-trust-badge">★ ۴.۹ (۱۵۶ نظر)</span>
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="dynamic-profile-verified-badge">✓ احراز هویت ققنوس</span>
        </div>
        <h1 class="dynamic-profile-title">${escapeHtml(name)}</h1>
        <p class="dynamic-profile-lead">${t("sellerProfile.leadIntro", "ارائه‌دهنده معتبر خدمات و محصولات منطبق بر استانداردهای اعتماد و کیفیت در ققنوس.")}</p>
        
        <div class="dynamic-profile-cta-row">
          <button class="button button-primary button-lg" type="button" data-profile-primary-action>
            <span>${getProfilePrimaryCtaLabel(businessType)}</span>
            <span aria-hidden="true">←</span>
          </button>
          <a class="button button-ghost" href="#profile-location" data-scroll-to="profile-location">
            <span>⌖ ساعت کاری و آدرس</span>
          </a>
          <button class="button button-ghost" type="button" data-contact-seller>
            <span>✉ ارسال پیام</span>
          </button>
        </div>
      </div>
    </section>
  `;

  const sectionsHtml = renderDomainProfileSections(businessType, schema);

  const locationHoursHtml = `
    <section id="profile-location" class="glass-card dynamic-profile-location-card">
      <div class="card-section-heading">
        <div>
          <span class="section-kicker">${t("sellerProfile.section.contactKicker", "اطلاعات تماس و نشانی")}</span>
          <h2>${t("sellerProfile.section.contactTitle", "آدرس حضوری و ساعات پاسخگویی")}</h2>
        </div>
      </div>
      <div class="dynamic-profile-contact-grid">
        <div class="dynamic-contact-item">
          <span class="dynamic-contact-icon">⌖</span>
          <div>
            <strong>${t("sellerProfile.addressLabel", "نشانی دقیق:")}</strong>
            <p>${escapeHtml(address)}</p>
          </div>
        </div>
        <div class="dynamic-contact-item">
          <span class="dynamic-contact-icon">◷</span>
          <div>
            <strong>${t("sellerProfile.hoursLabel", "ساعات فعالیت:")}</strong>
            <p>${escapeHtml(workingHours)}</p>
          </div>
        </div>
        <div class="dynamic-contact-item">
          <span class="dynamic-contact-icon">☎</span>
          <div>
            <strong>${t("sellerProfile.phoneLabel", "تلفن تماس مستقیم:")}</strong>
            <p dir="ltr">${escapeHtml(phone)}</p>
          </div>
        </div>
      </div>
    </section>
  `;

  return `
    <div class="phoenix-dynamic-profile" data-profile-type="${escapeAttr(businessType)}">
      ${profileHeroHtml}
      ${sectionsHtml}
      ${locationHoursHtml}
    </div>
  `;
}

function getProfilePrimaryCtaLabel(businessType: BusinessType): string {
  switch (businessType) {
    case "medical_clinic":
    case "medical_specialty_clinic":
      return "رزرو آنلاین نوبت ویزیت";
    case "food_restaurant":
    case "food_cafe":
      return "سفارش آنلاین / رزرو میز";
    case "beauty_salon":
      return "رزرو وقت آرایشگاه";
    case "service_repair":
      return "ثبت درخواست تعمیر در محل";
    case "education_academy":
      return "ثبت‌نام آنلاین دوره";
    case "hospitality_hotel":
      return "رزرو آنلاین اقامتگاه";
    case "professional_consulting":
      return "رزرو وقت مشاوره";
    case "retail_clothing":
    case "retail_digital":
    default:
      return "مشاهده و خرید فوری کالاها";
  }
}

function renderDomainProfileSections(businessType: BusinessType, _schema: BusinessTypeSchema): string {
  switch (businessType) {
    case "medical_clinic":
    case "medical_specialty_clinic":
      return `
        <!-- Doctor Credentials & Bio -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">سوابق و صلاحیت حرفه‌ای</span>
              <h2>معرفی پزشک و مدارک نظام‌پزشکی</h2>
            </div>
          </div>
          <div class="dynamic-bio-content">
            <p>فارغ‌التحصیل از دانشگاه علوم پزشکی تهران، دارای بورد تخصصی و سابقه بیش از ۱۲ سال طبابت در حوزه بیماری‌ها و جراحی‌های پوست، مو و زیبایی. عضو انجمن متخصصین پوست ایران (نظام پزشکی: ۱۱۲۴۵۶).</p>
            <div class="dynamic-badges-inline">
              <span>عضو انجمن پوست و مو</span>
              <span class="meta-sep">·</span>
              <span>دارای گواهینامه لیزر پیشرفته</span>
              <span class="meta-sep">·</span>
              <span>طرف قرارداد با تمامی بیمه‌های معتبر</span>
            </div>
          </div>
        </section>

        <!-- Services & Fees -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">تعرفه و خدمات</span>
              <h2>خدمات تشخیصی و درمانی مطب</h2>
            </div>
          </div>
          <div class="dynamic-services-grid">
            <article class="dynamic-service-card">
              <div>
                <strong>ویزیت و معاینه تخصصی پوست</strong>
                <p>بررسی ضایعات پوستی، نسخه درمانی و مشاوره مراقبت فردی</p>
                <small>مدت زمان: ۳۰ دقیقه</small>
              </div>
              <div class="dynamic-service-action">
                <span class="dynamic-service-price">۲۵۰,۰۰۰ تومان</span>
                <button class="button button-primary button-sm" type="button" data-book-service="ویزیت تخصصی">رزرو نوبت</button>
              </div>
            </article>

            <article class="dynamic-service-card">
              <div>
                <strong>پاکسازی عمقی و هیدرودرمی</strong>
                <p>تخلیه منافذ، آبرسانی تخصصی و لایه‌برداری ملایم با دستگاه</p>
                <small>مدت زمان: ۴۵ دقیقه</small>
              </div>
              <div class="dynamic-service-action">
                <span class="dynamic-service-price">۶۵۰,۰۰۰ تومان</span>
                <button class="button button-primary button-sm" type="button" data-book-service="پاکسازی عمقی">رزرو نوبت</button>
              </div>
            </article>

            <article class="dynamic-service-card">
              <div>
                <strong>مزوتراپی مو و پوست</strong>
                <p>تزریق کوکتل‌های تقویتی برای جوانسازی و جلوگیری از ریزش مو</p>
                <small>مدت زمان: ۴۰ دقیقه</small>
              </div>
              <div class="dynamic-service-action">
                <span class="dynamic-service-price">۹۵۰,۰۰۰ تومان</span>
                <button class="button button-primary button-sm" type="button" data-book-service="مزوتراپی">رزرو نوبت</button>
              </div>
            </article>
          </div>
        </section>

        <!-- Accepted Insurances -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">پوشش بیمه‌ای</span>
              <h2>بیمه‌های طرف قرارداد با مطب</h2>
            </div>
          </div>
          <div class="dynamic-insurance-list">
            <span class="dynamic-insurance-item">🛡 تأمین اجتماعی</span>
            <span class="dynamic-insurance-item">🛡 بیمه سلامت / خدمات درمانی</span>
            <span class="dynamic-insurance-item">🛡 بیمه نیروهای مسلح</span>
            <span class="dynamic-insurance-item">🛡 بیمه ایران (تکمیلی)</span>
            <span class="dynamic-insurance-item">🛡 بیمه دانا (تکمیلی)</span>
            <span class="dynamic-insurance-item">🛡 بیمه پاسارگاد (تکمیلی)</span>
          </div>
        </section>
      `;

    case "food_restaurant":
    case "food_cafe":
      return `
        <!-- Restaurant Menu Categories -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">منوی غذا و نوشیدنی</span>
              <h2>غذاهای اصیل و پرطرفدار سرآشپز</h2>
            </div>
          </div>
          <div class="dynamic-menu-grid">
            <article class="dynamic-menu-card">
              <div class="dynamic-menu-details">
                <strong>چلو کباب برگ گوسفندی مخصوص</strong>
                <p>راسته گوسفندی تازه مرینیت شده با زعفران قائنات، برنج اعلای ایرانی و دورچین سنتی</p>
                <span class="dynamic-menu-price">۳۸۰,۰۰۰ تومان</span>
              </div>
              <button class="button button-primary button-sm" type="button" data-order-item="کباب برگ">افزودن به سفارش</button>
            </article>

            <article class="dynamic-menu-card">
              <div class="dynamic-menu-details">
                <strong>چلو کباب کوبیده زعفرانی (۲ سیخ)</strong>
                <p>گوشت مخلوط گوسفند و گوساله با گوجه کبابی، فلفل تند و کره محلی</p>
                <span class="dynamic-menu-price">۲۴۰,۰۰۰ تومان</span>
              </div>
              <button class="button button-primary button-sm" type="button" data-order-item="کوبیده">افزودن به سفارش</button>
            </article>

            <article class="dynamic-menu-card">
              <div class="dynamic-menu-details">
                <strong>زرشک‌پلو با مرغ مجلسی</strong>
                <p>ران مرغ در سس غلیظ زعفرانی و زرشک کوهی به همراه ته‌دیگ زعفرانی</p>
                <span class="dynamic-menu-price">۱۹۵,۰۰۰ تومان</span>
              </div>
              <button class="button button-primary button-sm" type="button" data-order-item="زرشک پلو">افزودن به سفارش</button>
            </article>
          </div>
        </section>

        <!-- Restaurant Amenities & Reservation -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">میزبانی و رزرو</span>
              <h2>امکانات سالن و رزرو میز اختصاصی</h2>
            </div>
          </div>
          <div class="dynamic-amenities-row">
            <span>🌿 سالن سرپوشیده و فضای باز</span>
            <span class="meta-sep">·</span>
            <span>🎵 موسیقی زنده سنتی</span>
            <span class="meta-sep">·</span>
            <span>🅿 پارکینگ اختصاصی رایگان</span>
            <span class="meta-sep">·</span>
            <span>🛵 ارسال سریع در محدوده</span>
          </div>
          <div style="margin-top: 14px;">
            <button class="button button-secondary" type="button" data-reserve-table-btn>رزرو میز آنلاین برای امشب</button>
          </div>
        </section>
      `;

    case "beauty_salon":
      return `
        <!-- Salon Services -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">منوی تخصصی</span>
              <h2>خدمات زیبایی، مراقبت و سلامت</h2>
            </div>
          </div>
          <div class="dynamic-services-grid">
            <article class="dynamic-service-card">
              <div>
                <strong>کوپ ژورنالی و استایل مو</strong>
                <p>مدل‌سازی تخصصی متناسب با فرم چهره با براشینگ حرفه‌ای</p>
              </div>
              <div class="dynamic-service-action">
                <span class="dynamic-service-price">۳۵۰,۰۰۰ تومان</span>
                <button class="button button-primary button-sm" type="button">رزرو وقت</button>
              </div>
            </article>

            <article class="dynamic-service-card">
              <div>
                <strong>کاشت و ژلیش ناخن</strong>
                <p>کاشت پودر و ژل روسی با مواد ضدحساسیت و ماندگاری بالا</p>
              </div>
              <div class="dynamic-service-action">
                <span class="dynamic-service-price">۴۲۰,۰۰۰ تومان</span>
                <button class="button button-primary button-sm" type="button">رزرو وقت</button>
              </div>
            </article>
          </div>
        </section>

        <!-- Stylists / Specialists -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">کادر متخصص</span>
              <h2>آرایشگران و متخصصان حاضر در سالن</h2>
            </div>
          </div>
          <div class="dynamic-specialists-grid">
            <div class="dynamic-specialist-item">
              <span class="dynamic-spec-avatar">👩</span>
              <strong>سارا جلالی</strong>
              <small>متخصص هیرکات و رنگ مو</small>
            </div>
            <div class="dynamic-specialist-item">
              <span class="dynamic-spec-avatar">👩</span>
              <strong>مریم نادری</strong>
              <small>آرتیست ناخن و اسپا</small>
            </div>
            <div class="dynamic-specialist-item">
              <span class="dynamic-spec-avatar">👩</span>
              <strong>الهام کیانی</strong>
              <small>میکاپ آرتیست و گریم عروس</small>
            </div>
          </div>
        </section>
      `;

    case "retail_clothing":
    default:
      return `
        <!-- Products & Categories -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">مجموعه جدید</span>
              <h2>پرفروش‌ترین محصولات و لباس‌ها</h2>
            </div>
          </div>
          <div class="dynamic-products-grid">
            <article class="dynamic-product-card">
              <div class="dynamic-product-badge">جدید</div>
              <div class="dynamic-product-info">
                <strong>کت لینن بهاره مدل ناتالی</strong>
                <p class="dynamic-product-desc">پارچه لینن ترک درجه یک، تنخور آزاد، مناسب استایل کژوال و نیمه‌رسمی</p>
                <div class="dynamic-product-attributes">
                  <div class="attr-row">
                    <span>سایزها:</span>
                    <strong>S · M · L · XL</strong>
                  </div>
                  <div class="attr-row">
                    <span>رنگ‌ها:</span>
                    <strong>کرم · شتری · مشکی · خاکی</strong>
                  </div>
                  <div class="attr-row">
                    <span>موجودی:</span>
                    <strong class="text-status-active">موجود در انبار</strong>
                  </div>
                </div>
                <div class="dynamic-product-footer">
                  <div class="dynamic-product-price">
                    <span class="price-val">۱,۴۵۰,۰۰۰ تومان</span>
                    <span class="price-prev">۱,۷۸۰,۰۰۰</span>
                  </div>
                  <div class="dynamic-product-actions">
                    <button class="button button-primary button-sm" type="button" data-buy-now>خرید فوری</button>
                    <button class="button button-ghost button-sm" type="button" data-compare>مقایسه</button>
                  </div>
                </div>
              </div>
            </article>

            <article class="dynamic-product-card">
              <div class="dynamic-product-info">
                <strong>شلوار مام‌استایل پنبه‌ای اعلا</strong>
                <p class="dynamic-product-desc">پارچه جین سبک ۱۰۰٪ پنبه، فاق بلند، بدون آبرفت با ضمانت بازگشت وجه</p>
                <div class="dynamic-product-attributes">
                  <div class="attr-row">
                    <span>سایزها:</span>
                    <strong>۳۶ · ۳۸ · ۴۰ · ۴۲</strong>
                  </div>
                  <div class="attr-row">
                    <span>رنگ‌ها:</span>
                    <strong>آبی روشن · ذغالی · یخی</strong>
                  </div>
                  <div class="attr-row">
                    <span>موجودی:</span>
                    <strong class="text-status-active">موجود در انبار</strong>
                  </div>
                </div>
                <div class="dynamic-product-footer">
                  <div class="dynamic-product-price">
                    <span class="price-val">۸۹۰,۰۰۰ تومان</span>
                  </div>
                  <div class="dynamic-product-actions">
                    <button class="button button-primary button-sm" type="button" data-buy-now>خرید فوری</button>
                    <button class="button button-ghost button-sm" type="button" data-compare>مقایسه</button>
                  </div>
                </div>
              </div>
            </article>

            <article class="dynamic-product-card">
              <div class="dynamic-product-info">
                <strong>پیراهن یقه دیپلمات لینن خنک</strong>
                <p class="dynamic-product-desc">طراحی مینیمال، پارچه فوق‌العاده خنک و تنفس‌پذیر تابستانه</p>
                <div class="dynamic-product-attributes">
                  <div class="attr-row">
                    <span>سایزها:</span>
                    <strong>M · L · XL</strong>
                  </div>
                  <div class="attr-row">
                    <span>رنگ‌ها:</span>
                    <strong>سفید · طوسی روشن · سبز کله‌غازی</strong>
                  </div>
                  <div class="attr-row">
                    <span>موجودی:</span>
                    <strong class="text-status-active">موجود در انبار</strong>
                  </div>
                </div>
                <div class="dynamic-product-footer">
                  <div class="dynamic-product-price">
                    <span class="price-val">۶۸۰,۰۰۰ تومان</span>
                  </div>
                  <div class="dynamic-product-actions">
                    <button class="button button-primary button-sm" type="button" data-buy-now>خرید فوری</button>
                    <button class="button button-ghost button-sm" type="button" data-compare>مقایسه</button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <!-- Brand Authenticity & Trust -->
        <section class="glass-card dynamic-profile-section">
          <div class="card-section-heading">
            <div>
              <span class="section-kicker">تضمین کیفیت و اصالت</span>
              <h2>مزایای خرید از این فروشگاه</h2>
            </div>
          </div>
          <div class="dynamic-features-row">
            <span>✓ ۷ روز ضمانت بازگشت کالا</span>
            <span class="meta-sep">·</span>
            <span>✓ ضمانت اصالت پارچه و دوخت</span>
            <span class="meta-sep">·</span>
            <span>✓ ارسال فوری با بسته‌بندی محرمانه</span>
            <span class="meta-sep">·</span>
            <span>✓ پشتیبانی آنلاین ۲۴ ساعته</span>
          </div>
        </section>
      `;
  }
}

/**
 * Render structured registration taxonomy selector.
 */
export function renderTaxonomyRegistrationSelector(selectedIndustry?: string, selectedOccupation?: string, selectedSubcategory?: string): string {
  const fallbackIndustry = BUSINESS_TAXONOMY[0] ?? {
    key: "apparel" as const,
    labelKey: "taxonomy.industry.apparel",
    icon: "👗",
    occupations: [],
  };
  const currentIndustry = (selectedIndustry ? BUSINESS_TAXONOMY.find((i) => i.key === selectedIndustry) : null) ?? fallbackIndustry;
  const currentIndKey = currentIndustry.key;
  const fallbackOccupation = currentIndustry.occupations[0] ?? {
    key: "clothing_store" as const,
    labelKey: "taxonomy.occupation.clothing_store",
    icon: "👕",
    businessType: "retail_clothing" as const,
    subcategories: [],
    specializationSuggestions: [],
  };
  const currentOccupation = (selectedOccupation ? currentIndustry.occupations.find((o) => o.key === selectedOccupation) : null) ?? fallbackOccupation;
  const currentOccKey = currentOccupation.key;
  const currentSubKey = selectedSubcategory || currentOccupation.subcategories[0]?.key || "";

  const industriesOptions = BUSINESS_TAXONOMY.map((ind) => {
    return `<option value="${escapeAttr(ind.key)}" ${ind.key === currentIndKey ? "selected" : ""}>${escapeHtml(ind.icon)} ${localized(ind.labelKey)}</option>`;
  }).join("");

  const occupationsOptions = currentIndustry.occupations.map((occ) => {
    return `<option value="${escapeAttr(occ.key)}" ${occ.key === currentOccKey ? "selected" : ""}>${escapeHtml(occ.icon)} ${localized(occ.labelKey)}</option>`;
  }).join("");

  const subcategoriesOptions = currentOccupation.subcategories.map((sub) => {
    return `<option value="${escapeAttr(sub.key)}" ${sub.key === currentSubKey ? "selected" : ""}>${localized(sub.labelKey)}</option>`;
  }).join("");

  const firstSpecSuggestion = currentOccupation.specializationSuggestions[0];
  const specializationPlaceholder = firstSpecSuggestion
    ? localized(firstSpecSuggestion)
    : "مثلاً: پوست و مو، رستوران ایرانی، پوشاک بانوان";

  return `
    <div class="phoenix-taxonomy-selector" data-taxonomy-selector>
      <div class="dynamic-field-row">
        <div class="dynamic-field-col">
          <label class="field-label" for="reg-taxonomy-industry">
            <span>${t("taxonomy.field.industry", "صنف اصلی کسب‌وکار")}</span>
          </label>
          <select id="reg-taxonomy-industry" class="ds-field ds-select" data-tax-industry>
            ${industriesOptions}
          </select>
        </div>

        <div class="dynamic-field-col">
          <label class="field-label" for="reg-taxonomy-occupation">
            <span>${t("taxonomy.field.occupation", "رسته شغلی")}</span>
          </label>
          <select id="reg-taxonomy-occupation" class="ds-field ds-select" data-tax-occupation>
            ${occupationsOptions}
          </select>
        </div>
      </div>

      <div class="dynamic-field-row" style="margin-top: 12px;">
        <div class="dynamic-field-col">
          <label class="field-label" for="reg-taxonomy-subcategory">
            <span>${t("taxonomy.field.subcategory", "زیررسته تخصصی")}</span>
          </label>
          <select id="reg-taxonomy-subcategory" class="ds-field ds-select" data-tax-subcategory>
            ${subcategoriesOptions}
          </select>
        </div>

        <div class="dynamic-field-col">
          <label class="field-label" for="reg-taxonomy-specialization">
            <span>${t("taxonomy.field.specialization", "تخصص / ویژگی تکمیلی (اختیاری)")}</span>
          </label>
          <input id="reg-taxonomy-specialization" class="ds-field" type="text" placeholder="${escapeAttr(specializationPlaceholder)}" data-tax-specialization />
        </div>
      </div>

      <!-- Live Deduced Architecture Card -->
      <div class="dynamic-inferred-card" style="margin-top: 14px;">
        <div class="dynamic-inferred-header">
          <span class="dynamic-inferred-sparkle">✦</span>
          <strong>${t("taxonomy.inferredTitle", "پیکربندی هوشمند استخراج‌شده توسط ققنوس:")}</strong>
        </div>
        <div class="dynamic-inferred-body">
          <div class="inferred-row">
            <span>نوع مدل کسب‌وکار:</span>
            <strong id="inferred-business-type">${escapeHtml(currentOccupation.businessType)}</strong>
          </div>
          <div class="inferred-row">
            <span>پروفایل و داشبورد خودکار:</span>
            <strong id="inferred-template">${localized(currentOccupation.labelKey)}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}
