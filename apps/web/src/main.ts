import { uiButton, uiField, uiSelect, uiTabs, uiTable, uiDropdown, uiDialog, uiEmpty, uiSkeleton } from "./ui";
type Theme = "dark" | "light";

type Route = {
  path: string;
  label: string;
  icon: string;
  render: () => string;
};

type DiscoveryResult = {
  id?: string;
  sourceType?: string;
  sourceId?: string;
  documentVersion?: number;
  title?: string;
  name?: string;
  displayName?: string;
  body?: string | null;
  description?: string | null;
  city?: string | null;
  locality?: string | null;
  rating?: number | null;
  score?: number | null;
  metadata?: Record<string, unknown> | null;
};

const STORAGE = {
  theme: "phoenix-theme",
  workspace: "phoenix-workspace-id",
  accessToken: "phoenix-access-token",
  business: "phoenix-business-id",
  customer: "phoenix-customer-id",
};

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
};

type WorkspaceSummary = {
  id: string;
  organizationId?: string;
  name: string;
  status?: string;
  createdAt?: string;
};

type NotificationView = {
  id: string;
  intent?: string;
  channel?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  variables?: Record<string, unknown> | null;
};

let activeDiscoveryItems: DiscoveryResult[] = [];
let studioPreviewUrl: string | undefined;
let shellWorkspaces: WorkspaceSummary[] = [];
let shellNotifications: NotificationView[] = [];
let shellContext: { actorId?: string; tenantId?: string; workspaceId?: string } = {};
let shellLoadInFlight = false;

type PublicSeoHydration = {
  metadata: {
    title: string;
    description: string;
    canonicalUrl: string;
    robots: string;
    openGraph: { title: string; description: string; url: string; type: string; locale: string; siteName?: string; image?: string };
    twitter: { card: "summary" | "summary_large_image"; title: string; description: string; image?: string };
    alternates: readonly { rel: "alternate"; hreflang: string; href: string }[];
    language: string;
    locale: string;
  };
  structuredData: Record<string, unknown>;
  page: {
    canonicalUrl: string;
    breadcrumbs: readonly { name: string; url: string }[];
    actions: readonly { kind: "primary" | "secondary"; label: string; href: string; reason: string }[];
    relatedLinks: readonly { label: string; url: string; relation: string; priority: number }[];
    sections: readonly { id: string; title: string; kind: string }[];
  };
  answer: {
    entityId: string;
    locale: string;
    question: string;
    answer: string;
    canonicalUrl?: string;
    facts: readonly { fact: string; verifiedAt?: string; provenanceUrl?: string; validUntil?: string }[];
    freshnessAt: string;
    sourceUpdatedAt: string;
    confidence: string;
    citationReady: boolean;
    geography?: {
      scope: string;
      country?: string;
      locationId?: string;
      serviceAreaIds: readonly string[];
      remoteAvailable: boolean;
    };
    limitations: readonly string[];
  };
  entity: {
    id: string;
    type: string;
    preferredName: string;
    summary?: string;
    description?: string;
    locale: string;
    country?: string;
    geoScope?: string;
    locationId?: string;
    serviceArea?: readonly string[];
    imageUrl?: string;
    telephone?: string;
    email?: string;
    priceRange?: string;
    price?: number;
    currency?: string;
    availability?: string;
    brandName?: string;
    categoryName?: string;
    startDate?: string;
    endDate?: string;
    address?: { streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string; addressCountry?: string };
    updatedAt: string;
  };
};

function readInitialSeoHydration(): PublicSeoHydration | null {
  const script = document.getElementById("phoenix-seo-data");
  if (!script?.textContent?.trim()) return null;
  try {
    return JSON.parse(script.textContent) as PublicSeoHydration;
  } catch {
    return null;
  }
}

const initialSeoHydration = readInitialSeoHydration();


const demoBusinesses: DiscoveryResult[] = [
  {
    id: "demo-1",
    displayName: "کافه و نان تازه",
    name: "کافه و نان تازه",
    description: "قهوه تخصصی، نان تازه و صبحانه‌های روزانه.",
    locality: "مرکز شهر",
    rating: 4.9,
    score: 94,
  },
  {
    id: "demo-2",
    displayName: "استودیو سرو",
    name: "استودیو سرو",
    description: "استودیو زیبایی با رزرو آنلاین و خدمات شخصی‌سازی‌شده.",
    locality: "ولیعصر",
    rating: 4.8,
    score: 91,
  },
  {
    id: "demo-3",
    displayName: "باغ بامداد",
    name: "باغ بامداد",
    description: "فضای سبز شهری برای تجربه‌های آرام، رویداد و دورهمی.",
    locality: "شمال شهر",
    rating: 4.7,
    score: 89,
  },
];

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, { once: true });
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Phoenix web root is missing.");
const appRoot = app;

const routes: Route[] = [
  { path: "/", label: "خانه", icon: "⌂", render: renderHome },
  { path: "/discover", label: "کشف", icon: "⌕", render: renderDiscover },
  { path: "/business", label: "کسب‌وکار", icon: "▦", render: renderBusiness },
  { path: "/product-studio", label: "استودیو محصول", icon: "✦", render: renderProductStudio },
  { path: "/account", label: "حساب", icon: "◉", render: renderAccount },
  { path: "/booking", label: "رزرو", icon: "◷", render: renderBooking },
  { path: "/checkout", label: "خرید", icon: "◫", render: renderCheckout },
  { path: "/customer", label: "مشتری", icon: "♙", render: renderCustomer },
  { path: "/communication", label: "ارتباطات", icon: "◌", render: renderCommunication },
  { path: "/billing", label: "مالی", icon: "◈", render: renderBilling },
  { path: "/trust", label: "اعتماد", icon: "✓", render: renderTrust },
  { path: "/operations", label: "عملیات", icon: "⚙", render: renderOperations },
  { path: "/seo", label: "SEO", icon: "◎", render: renderSeo },
  { path: "/control", label: "کنترل", icon: "⌘", render: renderControlCenter },
  { path: "/admin", label: "ادمین", icon: "◉", render: renderAdmin },
  { path: "/design-system", label: "Design System", icon: "◈", render: renderDesignSystem },
  { path: "/catalog", label: "کاتالوگ", icon: "▤", render: renderCatalog },
  { path: "/promotion", label: "پروموشن", icon: "٪", render: renderPromotion },
  { path: "/loyalty", label: "وفاداری", icon: "♢", render: renderLoyalty },
  { path: "/advertising", label: "تبلیغات", icon: "◒", render: renderAdvertising },
];

const theme = getInitialTheme();
document.documentElement.dataset.theme = theme;

async function hydrateSessionContext(): Promise<void> {
  const token = sessionStorage.getItem(STORAGE.accessToken);
  if (!token) return;
  try {
    const response = await apiJson<{ session: { authenticated: boolean; workspaceId?: string | null } }>("/api/v1/session");
    if (!response.session.authenticated) {
      sessionStorage.removeItem(STORAGE.accessToken);
      return;
    }
    if (response.session.workspaceId && !localStorage.getItem(STORAGE.workspace)) {
      localStorage.setItem(STORAGE.workspace, response.session.workspaceId);
    }
  } catch {
    // Keep the shell available in degraded mode; domain calls surface the real API error.
  }
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE.theme);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function toggleTheme(): void {
  const next: Theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(STORAGE.theme, next);
  syncThemeButtons();
}

function syncThemeButtons(): void {
  const isLight = document.documentElement.dataset.theme === "light";
  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((button) => {
    button.textContent = isLight ? "☾" : "☀";
    button.setAttribute("aria-label", isLight ? "فعال کردن پوسته تاریک" : "فعال کردن پوسته روشن");
  });
}

function currentRoute(): Route {
  const normalized = normalizePath(location.pathname);
  const staticRoute = routes.find((route) => route.path === normalized);
  if (staticRoute || !initialSeoHydration) return staticRoute ?? routes[0]!;
  return {
    path: normalized,
    label: "صفحه عمومی",
    icon: "◇",
    render: () => renderSeoEntity(initialSeoHydration!),
  };
}

function normalizePath(path: string): string {
  const value = path.replace(/\/+$/, "");
  return value || "/";
}

function navigate(path: string): void {
  const target = normalizePath(path);
  if (target !== normalizePath(location.pathname) && !routes.some((route) => route.path === target)) {
    window.location.assign(target);
    return;
  }
  if (normalizePath(location.pathname) === target) {
    render();
    return;
  }
  history.pushState({}, "", target);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render(): void {
  const route = currentRoute();
  const page = route.render();
  if (route.label !== "صفحه عمومی") clearHydratedSeoSurface(route);
  appRoot.innerHTML = `
    <div class="app-shell">
      ${renderHeader(route)}
      <div class="app-body">
        ${renderSidebar(route)}
        <main id="main" class="page-content">${page}</main>
      </div>
      ${renderMobileNav(route)}
      ${renderToastHost()}
    </div>
  `;
  bindGlobalEvents();
  syncThemeButtons();
  void loadShellContext();
  if (route.path === "/") void loadHomeState();
  if (route.path === "/account") void loadAccountState();
  if (route.path === "/customer") void loadCustomerState();
  if (route.path === "/communication") void loadCommunicationState();
  if (route.path === "/billing") void loadBillingState();
  if (route.path === "/business") void loadBusinessAccess();
  if (route.path === "/trust") void loadTrustSignals();
  if (route.path === "/operations") void loadCases();
  if (route.path === "/seo") void loadSeoHealth();
  if (route.path === "/admin") {
    void loadAdminState();
  }
}


function renderSeoEntity(payload: PublicSeoHydration): string {
  const entity = payload.entity;
  const answer = payload.answer;
  const facts = answer.facts.map((fact) => `
    <li class="seo-fact-row">
      <span>${escapeHtml(fact.fact)}</span>
      ${fact.verifiedAt ? `<small>تأیید: ${escapeHtml(fact.verifiedAt)}</small>` : ""}
    </li>`).join("");
  const commerce = [
    entity.price !== undefined ? `<span>قیمت: ${escapeHtml(String(entity.price))}</span>` : "",
    entity.currency ? `<span>ارز: ${escapeHtml(entity.currency)}</span>` : "",
    entity.priceRange ? `<span>بازه قیمت: ${escapeHtml(entity.priceRange)}</span>` : "",
    entity.availability ? `<span>دسترسی: ${escapeHtml(entity.availability)}</span>` : "",
    entity.brandName ? `<span>برند: ${escapeHtml(entity.brandName)}</span>` : "",
  ].filter(Boolean).join("");
  const breadcrumbs = payload.page.breadcrumbs.map((item) => `<a href="${escapeAttr(item.url)}" data-nav>${escapeHtml(item.name)}</a>`).join(`<span aria-hidden="true">/</span>`);
  const actions = payload.page.actions.map((action) => `<a class="button ${action.kind === "primary" ? "button-primary" : "button-ghost"}" href="${escapeAttr(action.href)}" data-nav>${escapeHtml(action.label)} →</a>`).join("");
  const related = payload.page.relatedLinks.map((link) => `<a class="seo-related-link" href="${escapeAttr(link.url)}" data-nav><span>${escapeHtml(link.label)}</span><small>${escapeHtml(link.relation)}</small></a>`).join("");
  const geo = answer.geography
    ? [
        answer.geography.country ? `<span>کشور: ${escapeHtml(answer.geography.country)}</span>` : "",
        answer.geography.locationId ? `<span>مکان: ${escapeHtml(answer.geography.locationId)}</span>` : "",
        ...answer.geography.serviceAreaIds.map((value) => `<span>حوزه خدمت: ${escapeHtml(value)}</span>`),
      ].filter(Boolean).join("")
    : "";

  applyHydratedSeoHead(payload);

  return `
    <nav class="seo-breadcrumbs" aria-label="Breadcrumb">${breadcrumbs}</nav>
    <section class="page-heading seo-public-heading">
      <div>
        <span class="eyebrow"><i></i> ${escapeHtml(entity.type)}</span>
        <h1>${escapeHtml(entity.preferredName)}</h1>
        <p>${escapeHtml(entity.summary ?? entity.description ?? answer.answer)}</p>
      </div>
      <div class="heading-actions">
        <a class="button button-primary" href="/discover" data-nav>کشف در ققنوس ←</a>
      </div>
    </section>
    <section class="section-block seo-public-grid">
      <article class="glass-card seo-public-card">
        <span class="section-kicker">Answer</span>
        <h2>${escapeHtml(answer.question)}</h2>
        <p class="seo-public-answer">${escapeHtml(answer.answer)}</p>
        <div class="seo-public-meta">
          <span>وضعیت: ${escapeHtml(answer.confidence)}</span>
          <span>به‌روزرسانی: ${escapeHtml(answer.freshnessAt)}</span>
          <span>${answer.citationReady ? "Citation-ready" : "نیازمند بررسی"}</span>
        </div>
      </article>
      <article class="glass-card seo-public-card">
        <span class="section-kicker">Verified facts</span>
        <h2>اطلاعات قابل استناد</h2>
        ${facts ? `<ul class="seo-fact-list">${facts}</ul>` : `<p class="seo-public-muted">برای این موجودیت هنوز fact مستقلی ثبت نشده است.</p>`}
        ${geo ? `<div class="metadata-cloud">${geo}</div>` : ""}
        ${commerce ? `<div class="metadata-cloud">${commerce}</div>` : ""}
      </article>
    </section>
    ${related ? `
      <section class="section-block seo-public-related">
        <div class="section-topline"><div><span class="section-kicker">Relationships</span><h2>مرتبط با این موجودیت</h2></div></div>
        <div class="seo-related-list">${related}</div>
      </section>` : ""}
    <section class="section-block seo-public-actions">
      <div class="seo-action-row">${actions}</div>
    </section>`;
}

function applyHydratedSeoHead(payload: PublicSeoHydration): void {
  const { metadata } = payload;
  document.title = metadata.title;
  document.documentElement.lang = metadata.locale;
  document.documentElement.dir = ["fa", "ar", "he", "ur"].includes(metadata.language) ? "rtl" : "ltr";

  setMeta("description", metadata.description);
  setMeta("robots", metadata.robots);
  setLink("canonical", metadata.canonicalUrl);
  setMetaProperty("og:title", metadata.openGraph.title);
  setMetaProperty("og:description", metadata.openGraph.description);
  setMetaProperty("og:type", metadata.openGraph.type);
  setMetaProperty("og:url", metadata.openGraph.url);
  setMetaProperty("og:locale", metadata.openGraph.locale);
  if (metadata.openGraph.siteName) setMetaProperty("og:site_name", metadata.openGraph.siteName);
  if (metadata.openGraph.image) setMetaProperty("og:image", metadata.openGraph.image);
  setMeta("twitter:card", metadata.twitter.card);
  setMeta("twitter:title", metadata.twitter.title);
  setMeta("twitter:description", metadata.twitter.description);
  if (metadata.twitter.image) setMeta("twitter:image", metadata.twitter.image);
}

function setMeta(name: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${CSS.escape(name)}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setMetaProperty(property: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[property="${CSS.escape(property)}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function clearHydratedSeoSurface(route: Route): void {
  document.getElementById("phoenix-seo-data")?.remove();
  document.getElementById("phoenix-seo-jsonld")?.remove();

  if (route.path === "/") {
    document.title = "ققنوس | Phoenix Intelligence";
    document.documentElement.lang = "fa";
    document.documentElement.dir = "rtl";
    setMeta("description", "ققنوس؛ لایه هوشمند تصمیم‌گیری و اتصال مشتری و کسب‌وکار.");
    setMeta("robots", "index,follow");
    setLink("canonical", new URL("/", location.origin).toString());
    return;
  }

  const labels: Record<string, { title: string; description: string }> = {
    "/discover": { title: "کشف | ققنوس", description: "کشف عرضه و گزینه‌های مرتبط در ققنوس." },
    "/business": { title: "کسب‌وکار | ققنوس", description: "فضای مدیریت کسب‌وکار و عرضه در ققنوس." },
    "/product-studio": { title: "استودیو محصول | ققنوس", description: "ساخت و غنی‌سازی محصول با Seller AI در ققنوس." },
    "/catalog": { title: "کاتالوگ | ققنوس", description: "مدیریت موجودیت‌های canonical محصول در ققنوس." },
  };
  const seo = labels[route.path];
  if (!seo) return;
  document.title = seo.title;
  setMeta("description", seo.description);
  setMeta("robots", "noindex,nofollow");
  setLink("canonical", new URL(route.path, location.origin).toString());
}

function setLink(rel: string, href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${CSS.escape(rel)}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

function renderHeader(route: Route): string {
  return `
    <header class="app-header">
      <div class="header-inner container-wide">
        <a class="brand" href="/" data-nav>
          <span class="brand-mark" aria-hidden="true">ق</span>
          <span class="brand-copy"><strong>ققنوس</strong><small>Phoenix Intelligence</small></span>
        </a>
        <div class="header-center">
          <div class="command-palette" role="button" tabindex="0" data-focus-search aria-label="جست‌وجوی سراسری">
            <span class="command-icon">⌕</span>
            <span class="command-placeholder">کجا می‌خواهید بروید؟</span>
            <kbd>/</kbd>
          </div>
        </div>
        <div class="header-actions">
          <button class="icon-button notification-button" type="button" data-notification-toggle aria-label="اعلان‌ها" aria-haspopup="dialog">
            <span aria-hidden="true">♢</span><b id="notification-count" class="notification-count" hidden>0</b>
          </button>
          <button class="profile-chip workspace-trigger" type="button" data-workspace-toggle aria-haspopup="dialog">
            <span class="avatar">ق</span>
            <span class="profile-copy"><strong id="shell-workspace-name">فضای شما</strong><small>${route.label}</small></span>
            <span class="chevron">⌄</span>
          </button>
          <button class="icon-button" type="button" data-theme-toggle aria-label="تغییر پوسته">◐</button>
        </div>
      </div>
    </header>
  `;
}

function renderSidebar(route: Route): string {
  return `
    <aside class="sidebar">
      <div class="sidebar-top">
        <button class="workspace-card workspace-trigger" type="button" data-workspace-toggle aria-haspopup="dialog" aria-label="انتخاب فضای کاری">
          <div class="workspace-icon">◆</div>
          <div><strong id="sidebar-workspace-name">ققنوس</strong><span id="sidebar-workspace-status">فضای کاری من</span></div>
          <span class="status-live"></span>
        </button>
      </div>
      <nav class="side-nav" aria-label="ناوبری برنامه">
        <div class="nav-label">محصول</div>
        ${routes
          .map(
            (item) => `
              <a href="${item.path}" data-nav class="nav-item ${item.path === route.path ? "active" : ""}">
                <span class="nav-icon">${item.icon}</span><span>${item.label}</span>
              </a>`,
          )
          .join("")}
        <div class="nav-label nav-spaced">مدیریت</div>
        <a class="nav-item ${route.path === "/booking" ? "active" : ""}" href="/booking" data-nav><span class="nav-icon">◷</span><span>رزروها</span></a>
        <button class="nav-item disabled" type="button" data-coming-soon="ارتباطات"><span class="nav-icon">◌</span><span>ارتباطات</span><em>به‌زودی</em></button>
        <button class="nav-item disabled" type="button" data-coming-soon="گزارش‌ها"><span class="nav-icon">↗</span><span>گزارش‌ها</span><em>به‌زودی</em></button>
      </nav>
      <div class="sidebar-bottom">
        <div class="ai-mini-card">
          <div class="ai-orb">✦</div>
          <div><strong>هوش ققنوس</strong><span>آماده برای کمک</span></div>
        </div>
        <button class="nav-item muted" type="button" data-toast="مرکز راهنما به‌زودی فعال می‌شود."><span class="nav-icon">?</span><span>راهنما</span></button>
      </div>
    </aside>
  `;
}

function renderMobileNav(route: Route): string {
  const mobilePaths = ["/", "/discover", "/business", "/product-studio", "/account"];
  const items = mobilePaths
    .map((path) => routes.find((item) => item.path === path))
    .filter((item): item is Route => Boolean(item));
  return `
    <nav class="mobile-nav" aria-label="ناوبری موبایل">
      ${items.map((item) => `<a href="${item.path}" data-nav class="${item.path === route.path ? "active" : ""}"><span>${item.icon}</span><small>${item.label}</small></a>`).join("")}
    </nav>
  `;
}

function renderToastHost(): string {
  return '<div class="toast-host" aria-live="polite"></div>';
}

function renderHome(): string {
  return `
    <section class="dashboard-hero">
      <div class="hero-copy-block">
        <span class="eyebrow"><i></i> تصمیم‌یار هوشمند شما</span>
        <h1>از نیاز تا <em>اقدام</em><br/>یک قدم فاصله است.</h1>
        <p>ققنوس نیاز مشتری را می‌فهمد، عرضه مناسب را پیدا می‌کند و مسیر بعدی را ساده می‌کند.</p>
        <div class="hero-actions">
          <a class="button button-primary button-lg" href="/discover" data-nav>شروع کشف <span>←</span></a>
          <a class="button button-ghost button-lg" href="/product-studio" data-nav>ساخت محصول با AI <span>✦</span></a>
        </div>
      </div>
      <div class="hero-orbit">
        <div class="orbit orbit-a"></div><div class="orbit orbit-b"></div>
        <div class="core-card glass-card">
          <div class="core-head"><span>وضعیت زنده</span><span id="home-live-status" class="pill">در حال خواندن</span></div>
          <div class="core-question">امروز چه کاری می‌تواند برای شما ارزشمندتر باشد؟</div>
          <div class="decision-item"><span class="decision-icon">⌕</span><div><strong>Demand</strong><small id="home-demand-insight">در انتظار activity</small></div><b id="home-demand-value">—</b></div>
          <div class="decision-item"><span class="decision-icon purple">✦</span><div><strong>Matching</strong><small id="home-matching-insight">پس از Discovery واقعی</small></div><b id="home-matching-value">—</b></div>
          <div class="decision-foot"><span id="home-live-question">بدون عدد ساختگی؛ فقط سیگنال‌های قابل مشاهده</span><span id="home-live-time">—</span></div>
        </div>
      </div>
    </section>

    <section class="section-block">
      <div class="section-topline"><div><span class="section-kicker">تصویر امروز</span><h2>یک نگاه، سه فرصت</h2></div><a href="/discover" data-nav class="text-link">مشاهده همه <span>←</span></a></div>
      <div class="metric-grid">
        <article class="metric-card feature">
          <div class="metric-symbol">⌕</div><span>Demand</span><strong id="home-demand-count">—</strong><small id="home-demand-note">جست‌وجوی اخیر</small><div class="sparkline"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </article>
        <article class="metric-card">
          <div class="metric-top"><span>Supply</span><span id="home-business-badge" class="tiny-status">● بررسی</span></div>
          <strong id="home-business-status" class="metric-value">—</strong><small id="home-business-note">Business context</small>
          <div class="progress-line"><span id="home-business-progress" style="width:0%"></span></div><b id="home-business-detail">داده تکمیل پروفایل هنوز اندازه‌گیری نشده</b>
        </article>
        <article class="metric-card">
          <div class="metric-top"><span>AI</span><span class="ai-badge">RUNTIME</span></div>
          <strong id="home-ai-usage" class="metric-value">—</strong><small id="home-ai-note">آخرین اجرای Seller AI</small>
          <div class="mini-product-row"><span class="mini-product one">ک</span><span class="mini-product two">س</span><span class="mini-product three">ب</span><span class="mini-product four">م</span></div>
        </article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-topline"><div><span class="section-kicker">مسیر اصلی</span><h2>ققنوس چطور ارزش می‌سازد؟</h2></div></div>
      <div class="loop-grid">
        ${["نیاز را می‌فهمد","عرضه را غنی می‌کند","تصمیم می‌گیرد","متصل می‌کند","اقدام را آسان می‌کند"].map((label,index)=>`<div class="loop-step"><span>0${index+1}</span><strong>${label}</strong><small>${["Demand","Supply","Decision","Matching","Action"][index]}</small></div>`).join("")}
      </div>
    </section>
  `;
}


function toDateTimeLocal(value: Date): string {
  const pad = (number: number): string => String(number).padStart(2, "0");
  return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate()) + "T" + pad(value.getHours()) + ":" + pad(value.getMinutes());
}

function renderBooking(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Booking / Availability</span><h1>زمان مناسب را پیدا کنید.</h1><p>Availability از سرویس canonical رزرو خوانده می‌شود.</p></div>
    </section>
    <section class="section-block">
      <article class="glass-card booking-panel">
        <div class="booking-fields">
          <label class="field-label">Schedule ID<input id="booking-schedule" class="studio-input-line" placeholder="Schedule ID" /></label>
          <label class="field-label">From<input id="booking-from" class="studio-input-line" type="datetime-local" value="${toDateTimeLocal(new Date())}" /></label>
          <label class="field-label">To<input id="booking-to" class="studio-input-line" type="datetime-local" value="${toDateTimeLocal(new Date(Date.now() + 86400000))}" /></label>
          <label class="field-label">Duration (minutes)<input id="booking-duration" class="studio-input-line" type="number" min="1" value="60" /></label>
        </div>
        <button class="button button-primary" type="button" data-load-slots>خواندن Availability</button>
        <div id="booking-slots-result" class="slot-empty"><span>◷</span><p>Schedule را وارد کنید.</p></div>
      </article>
    </section>
  `;
}

async function loadBookingSlots(): Promise<void> {
  const scheduleId = document.querySelector<HTMLInputElement>("#booking-schedule")?.value.trim() ?? "";
  const from = document.querySelector<HTMLInputElement>("#booking-from")?.value ?? "";
  const to = document.querySelector<HTMLInputElement>("#booking-to")?.value ?? "";
  const durationSeconds = Number(document.querySelector<HTMLInputElement>("#booking-duration")?.value ?? "60") * 60;
  const host = document.querySelector<HTMLDivElement>("#booking-slots-result");
  if (!host) return;
  if (!scheduleId || !from || !to || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    host.innerHTML = '<div class="slot-empty"><span>!</span><p>Schedule و بازه زمانی معتبر لازم است.</p></div>';
    return;
  }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  try {
    const response = await apiJson<{ data: { startsAt?: string; endsAt?: string; available?: boolean }[] }>(
      "/api/v1/availability/schedules/" + encodeURIComponent(scheduleId) + "/slots?from=" + encodeURIComponent(new Date(from).toISOString()) + "&to=" + encodeURIComponent(new Date(to).toISOString()) + "&durationSeconds=" + String(Math.trunc(durationSeconds)),
    );
    host.innerHTML = response.data.length
      ? response.data.map((slot) => `<div class="metadata-cloud"><span>${escapeHtml(slot.startsAt ?? "—")}</span><span>${escapeHtml(slot.endsAt ?? "—")}</span><span>${slot.available === false ? "پر" : "قابل رزرو"}</span></div>`).join("")
      : '<div class="slot-empty"><span>◌</span><p>در این بازه slot قابل‌نمایشی پیدا نشد.</p></div>';
  } catch (error) {
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن Availability ناموفق بود.")}</p></div>`;
  }
}

function renderPromotion(): string {
  return "<section class='page-heading'><div><span class='eyebrow'><i></i> Promotion Studio</span><h1>مشوق را تعریف کنید؛ <em>قانون را قفل کنید.</em></h1><p>Promotion فقط policy و eligibility را مالک است.</p></div></section>" +
    "<section class='engine-grid'>" +
    "<article class='glass-card engine-card'><div class='card-section-heading'><span class='section-kicker'>Create</span><h2>Promotion</h2></div><div class='engine-form'><input id='promo-name' class='studio-input-line' placeholder='نام promotion' /><input id='promo-type' class='studio-input-line' value='percentage_discount' /><select id='promo-scope' class='studio-input-line'><option value='workspace'>workspace</option><option value='business'>business</option><option value='campaign'>campaign</option></select><input id='promo-business' class='studio-input-line' value='" + escapeAttr(localStorage.getItem(STORAGE.business) ?? "") + "' placeholder='Business ID' /></div><button class='button button-primary' type='button' data-promo-create>ساخت Promotion</button><div id='promo-create-state' class='connection-state'>—</div></article>" +
    "<article class='glass-card engine-card'><div class='card-section-heading'><span class='section-kicker'>Version</span><h2>Policy version</h2></div><div class='engine-form'><input id='promo-id' class='studio-input-line' placeholder='Promotion ID' /><input id='promo-version' class='studio-input-line' type='number' value='1' /><input id='promo-minimum' class='studio-input-line' type='number' value='0' /><input id='promo-benefit' class='studio-input-line' type='number' value='10' /><input id='promo-effective' class='studio-input-line' type='datetime-local' value='" + toDateTimeLocal(new Date()) + "' /><input id='promo-version-id' class='studio-input-line' placeholder='Version ID' /></div><div class='engine-actions'><button class='button button-primary' type='button' data-promo-version>ساخت Version</button><button class='button button-ghost' type='button' data-promo-activate>Activate</button></div><div id='promo-version-state' class='connection-state'>—</div></article>" +
    "<article class='glass-card engine-card'><div class='card-section-heading'><span class='section-kicker'>Decision</span><h2>Eligibility</h2></div><div class='engine-form'><input id='promo-eval-id' class='studio-input-line' placeholder='Promotion ID' /><input id='promo-customer' class='studio-input-line' value='" + escapeAttr(localStorage.getItem(STORAGE.customer) ?? "") + "' placeholder='Customer ID' /><input id='promo-amount' class='studio-input-line' type='number' value='0' /><input id='promo-channel' class='studio-input-line' value='web' /></div><button class='button button-primary' type='button' data-promo-evaluate>Evaluate</button><div id='promo-eval-state' class='connection-state'>—</div></article>" +
    "</section>";
}

async function createPromotion(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#promo-create-state"); if(!state)return;
  if(!sessionStorage.getItem(STORAGE.accessToken)){openConnectionPanel();return;}
  try{
    const response=await apiJson<{data:{id:string}}>("/api/v1/promotions",{method:"POST",body:{
      name:document.querySelector<HTMLInputElement>("#promo-name")?.value.trim(),
      promotionType:document.querySelector<HTMLInputElement>("#promo-type")?.value.trim(),
      scope:document.querySelector<HTMLSelectElement>("#promo-scope")?.value,
      businessId:document.querySelector<HTMLInputElement>("#promo-business")?.value.trim()||undefined
    }});
    document.querySelector<HTMLInputElement>("#promo-id")!.value=response.data.id;
    document.querySelector<HTMLInputElement>("#promo-eval-id")!.value=response.data.id;
    state.textContent="Promotion ساخته شد · "+response.data.id; state.className="connection-state success";
  }catch(error){state.textContent=error instanceof Error?error.message:"ساخت Promotion ناموفق بود.";state.className="connection-state error";}
}
async function createPromotionVersion(): Promise<void>{
  const state=document.querySelector<HTMLElement>("#promo-version-state");if(!state)return;
  const id=document.querySelector<HTMLInputElement>("#promo-id")?.value.trim()??"";
  if(!id){showToast("Promotion ID لازم است.");return;}
  try{
    const response=await apiJson<{data:{id:string;version:number}}>("/api/v1/promotions/"+encodeURIComponent(id)+"/versions",{method:"POST",body:{
      version:Number(document.querySelector<HTMLInputElement>("#promo-version")?.value||"1"),
      benefit:{type:"percentage",value:Number(document.querySelector<HTMLInputElement>("#promo-benefit")?.value||"0")},
      eligibilityRules:{minimumAmountMinor:Number(document.querySelector<HTMLInputElement>("#promo-minimum")?.value||"0")},
      stackPolicy:{stack:"exclusive"},
      effectiveFrom:new Date(document.querySelector<HTMLInputElement>("#promo-effective")?.value||Date.now()).toISOString()
    }});
    document.querySelector<HTMLInputElement>("#promo-version-id")!.value=response.data.id;
    state.textContent="Version "+response.data.version+" ساخته شد · "+response.data.id;state.className="connection-state success";
  }catch(error){state.textContent=error instanceof Error?error.message:"ساخت Version ناموفق بود.";state.className="connection-state error";}
}
async function activatePromotion(): Promise<void>{
  const state=document.querySelector<HTMLElement>("#promo-version-state");if(!state)return;
  const id=document.querySelector<HTMLInputElement>("#promo-id")?.value.trim()??"";
  const versionId=document.querySelector<HTMLInputElement>("#promo-version-id")?.value.trim()??"";
  if(!id||!versionId){showToast("Promotion ID و Version ID لازم هستند.");return;}
  try{
    const response=await apiJson<{data:{status:string}}>( "/api/v1/promotions/"+encodeURIComponent(id)+"/activate",{method:"POST",body:{versionId}});
    state.textContent="Promotion فعال شد · "+response.data.status;state.className="connection-state success";
  }catch(error){state.textContent=error instanceof Error?error.message:"Activation ناموفق بود.";state.className="connection-state error";}
}
async function evaluatePromotion(): Promise<void>{
  const state=document.querySelector<HTMLElement>("#promo-eval-state");if(!state)return;
  try{
    const response=await apiJson<{data:{decision:string;reasons:string[]}}>("/api/v1/promotions/evaluate",{method:"POST",body:{
      promotionId:document.querySelector<HTMLInputElement>("#promo-eval-id")?.value.trim(),
      subjectId:document.querySelector<HTMLInputElement>("#promo-customer")?.value.trim(),
      idempotencyKey:crypto.randomUUID(),
      amountMinor:Number(document.querySelector<HTMLInputElement>("#promo-amount")?.value||"0"),
      channel:document.querySelector<HTMLInputElement>("#promo-channel")?.value.trim()
    }});
    state.textContent=response.data.decision+" · "+response.data.reasons.join(", ");state.className=response.data.decision==="qualified"?"connection-state success":"connection-state";
  }catch(error){state.textContent=error instanceof Error?error.message:"Evaluation ناموفق بود.";state.className="connection-state error";}
}
function renderLoyalty(): string {
  return '<section class="page-heading"><div><span class="eyebrow"><i></i> Loyalty Center</span><h1>ارزش بازگشت مشتری را <em>ثبت کنید.</em></h1><p>امتیازها ledger دارند و تغییرات فقط از طریق Loyalty canonical انجام می‌شوند.</p></div></section>' +
    '<section class="engine-grid">' +
      '<article class="glass-card engine-card"><div class="card-section-heading"><span class="section-kicker">Program</span><h2>Loyalty Program</h2></div><div class="engine-form"><input id="loyalty-name" class="studio-input-line" placeholder="نام برنامه" /><input id="loyalty-business" class="studio-input-line" value="' + escapeAttr(localStorage.getItem(STORAGE.business) ?? "") + '" placeholder="Business ID" /></div><button class="button button-primary" data-loyalty-create>ساخت برنامه</button><div id="loyalty-program-state" class="connection-state">—</div></article>' +
      '<article class="glass-card engine-card"><div class="card-section-heading"><span class="section-kicker">Membership</span><h2>عضویت مشتری</h2></div><div class="engine-form"><input id="loyalty-program-id" class="studio-input-line" placeholder="Program ID" /><input id="loyalty-customer-id" class="studio-input-line" value="' + escapeAttr(localStorage.getItem(STORAGE.customer) ?? "") + '" placeholder="Customer ID" /><input id="loyalty-membership-id" class="studio-input-line" placeholder="Membership ID" /></div><button class="button button-primary" data-loyalty-enroll>Enroll</button><div id="loyalty-membership-state" class="connection-state">—</div></article>' +
      '<article class="glass-card engine-card"><div class="card-section-heading"><span class="section-kicker">Ledger</span><h2>ثبت امتیاز</h2></div><div class="engine-form"><input id="loyalty-ledger-membership" class="studio-input-line" placeholder="Membership ID" /><input id="loyalty-points" class="studio-input-line" type="number" value="100" /><select id="loyalty-entry-type" class="studio-input-line"><option value="earn">earn</option><option value="adjustment">adjustment</option><option value="expire">expire</option><option value="reverse">reverse</option></select></div><button class="button button-primary" data-loyalty-ledger>ثبت امتیاز</button><div id="loyalty-ledger-state" class="connection-state">—</div></article>' +
    '</section>';
}

async function createLoyaltyProgram(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#loyalty-program-state"); if(!state)return;
  try{
    const response=await apiJson<{data:{id:string}}>("/api/v1/loyalty/programs",{method:"POST",body:{name:document.querySelector<HTMLInputElement>("#loyalty-name")?.value.trim(),businessId:document.querySelector<HTMLInputElement>("#loyalty-business")?.value.trim()||undefined}});
    document.querySelector<HTMLInputElement>("#loyalty-program-id")!.value=response.data.id;
    state.textContent="Program ساخته شد · "+response.data.id; state.className="connection-state success";
  }catch(error){state.textContent=error instanceof Error?error.message:"ساخت برنامه ناموفق بود.";state.className="connection-state error";}
}

async function enrollLoyaltyMember(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#loyalty-membership-state");if(!state)return;
  try{
    const response=await apiJson<{data:{id:string}}>("/api/v1/loyalty/memberships",{method:"POST",body:{programId:document.querySelector<HTMLInputElement>("#loyalty-program-id")?.value.trim(),customerId:document.querySelector<HTMLInputElement>("#loyalty-customer-id")?.value.trim()}});
    document.querySelector<HTMLInputElement>("#loyalty-membership-id")!.value=response.data.id;document.querySelector<HTMLInputElement>("#loyalty-ledger-membership")!.value=response.data.id;
    state.textContent="Membership ساخته شد · "+response.data.id; state.className="connection-state success";
  }catch(error){state.textContent=error instanceof Error?error.message:"Enroll ناموفق بود.";state.className="connection-state error";}
}

async function postLoyaltyLedger(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#loyalty-ledger-state");if(!state)return;
  try{
    const response=await apiJson<{data:{id:string}}>("/api/v1/loyalty/ledger",{method:"POST",body:{membershipId:document.querySelector<HTMLInputElement>("#loyalty-ledger-membership")?.value.trim(),entryType:document.querySelector<HTMLSelectElement>("#loyalty-entry-type")?.value,pointsDelta:Number(document.querySelector<HTMLInputElement>("#loyalty-points")?.value||"0"),idempotencyKey:crypto.randomUUID()}});
    state.textContent="Ledger entry ثبت شد · "+response.data.id; state.className="connection-state success";
  }catch(error){state.textContent=error instanceof Error?error.message:"ثبت ledger ناموفق بود.";state.className="connection-state error";}
}
function renderAdvertising(): string {
  return '<section class="page-heading"><div><span class="eyebrow"><i></i> Sponsored Discovery</span><h1>تبلیغ را از کشف ارگانیک <em>جدا نگه دارید.</em></h1><p>Ads با policy، moderation، placement و measurement اختصاصی خودشان اجرا می‌شوند.</p></div></section>' +
    '<section class="engine-grid">' +
    '<article class="glass-card engine-card"><div class="card-section-heading"><span class="section-kicker">Account</span><h2>Advertiser</h2></div><div class="engine-form"><input id="ad-business" class="studio-input-line" value="' + escapeAttr(localStorage.getItem(STORAGE.business) ?? "") + '" placeholder="Business ID" /><input id="ad-currency" class="studio-input-line" value="USD" /></div><button class="button button-primary" data-ad-account>ساخت Account</button><div id="ad-account-state" class="connection-state">—</div></article>' +
    '<article class="glass-card engine-card"><div class="card-section-heading"><span class="section-kicker">Campaign</span><h2>Campaign</h2></div><div class="engine-form"><input id="ad-account-id" class="studio-input-line" placeholder="Account ID" /><input id="ad-campaign-name" class="studio-input-line" placeholder="Campaign name" /><input id="ad-objective" class="studio-input-line" value="discovery" /><input id="ad-campaign-id" class="studio-input-line" placeholder="Campaign ID" /><input id="ad-version-id" class="studio-input-line" placeholder="Version ID" /></div><div class="engine-actions"><button class="button button-primary" data-ad-campaign>Campaign</button><button class="button button-ghost" data-ad-version>Version</button><button class="button button-ghost" data-ad-activate>Activate</button></div><div id="ad-campaign-state" class="connection-state">—</div></article>' +
    '<article class="glass-card engine-card"><div class="card-section-heading"><span class="section-kicker">Delivery</span><h2>Sponsored Ad</h2></div><div class="engine-form"><input id="ad-subject-id" class="studio-input-line" placeholder="Product/Offering ID" /><input id="ad-creative" class="studio-input-line" placeholder="Creative reference" /><input id="ad-placement" class="studio-input-line" placeholder="Placement ID" /><input id="ad-id" class="studio-input-line" placeholder="Ad ID" /><select id="ad-decision" class="studio-input-line"><option value="served">served</option><option value="rejected">rejected</option></select></div><div class="engine-actions"><button class="button button-primary" data-ad-create>Ad</button><button class="button button-ghost" data-ad-delivery>Delivery</button></div><div id="ad-delivery-state" class="connection-state">—</div></article>' +
    '<article class="glass-card engine-card"><div class="card-section-heading"><span class="section-kicker">Measurement</span><h2>Campaign Report</h2></div><div class="engine-form"><input id="ad-report-campaign" class="studio-input-line" placeholder="Campaign ID" /><input id="ad-impression-decision" class="studio-input-line" placeholder="Delivery Decision ID" /><input id="ad-impression-id" class="studio-input-line" placeholder="Impression ID" /></div><div class="engine-actions"><button class="button button-primary" data-ad-report>Report</button><button class="button button-ghost" data-ad-impression>Impression</button><button class="button button-ghost" data-ad-click>Click</button></div><div id="ad-report-state" class="connection-state">—</div></article>' +
    '</section>';
}

async function createAdvertisingAccount(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-account-state");if(!state)return;
  try{const response=await apiJson<{data:{id:string}}>("/api/v1/advertising/accounts",{method:"POST",body:{businessId:document.querySelector<HTMLInputElement>("#ad-business")?.value.trim(),currency:document.querySelector<HTMLInputElement>("#ad-currency")?.value.trim()}});document.querySelector<HTMLInputElement>("#ad-account-id")!.value=response.data.id;state.textContent="Account ساخته شد · "+response.data.id;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"ساخت account ناموفق بود.";state.className="connection-state error";}
}
async function createAdvertisingCampaign(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-campaign-state");if(!state)return;
  try{const response=await apiJson<{data:{id:string}}>("/api/v1/advertising/campaigns",{method:"POST",body:{advertisingAccountId:document.querySelector<HTMLInputElement>("#ad-account-id")?.value.trim(),name:document.querySelector<HTMLInputElement>("#ad-campaign-name")?.value.trim(),objective:document.querySelector<HTMLInputElement>("#ad-objective")?.value.trim()}});document.querySelector<HTMLInputElement>("#ad-campaign-id")!.value=response.data.id;document.querySelector<HTMLInputElement>("#ad-report-campaign")!.value=response.data.id;state.textContent="Campaign ساخته شد · "+response.data.id;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"ساخت campaign ناموفق بود.";state.className="connection-state error";}
}
async function createAdvertisingVersion(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-campaign-state");if(!state)return;
  const campaignId=document.querySelector<HTMLInputElement>("#ad-campaign-id")?.value.trim()||"";
  try{const response=await apiJson<{data:{id:string}}>("/api/v1/advertising/campaigns/"+encodeURIComponent(campaignId)+"/versions",{method:"POST",body:{version:1,targetingRules:{},placementRules:{},pacingPolicy:{},effectiveFrom:new Date().toISOString()}});document.querySelector<HTMLInputElement>("#ad-version-id")!.value=response.data.id;state.textContent="Version ساخته شد · "+response.data.id;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"ساخت version ناموفق بود.";state.className="connection-state error";}
}
async function activateAdvertisingCampaign(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-campaign-state");if(!state)return;
  try{const response=await apiJson<{data:{status:string}}>("/api/v1/advertising/campaigns/"+encodeURIComponent(document.querySelector<HTMLInputElement>("#ad-campaign-id")?.value.trim()||"")+"/activate",{method:"POST",body:{versionId:document.querySelector<HTMLInputElement>("#ad-version-id")?.value.trim()}});state.textContent="Campaign فعال شد · "+response.data.status;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"Activation ناموفق بود.";state.className="connection-state error";}
}
async function createAdvertisingAd(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-delivery-state");if(!state)return;
  try{const response=await apiJson<{data:{id:string}}>("/api/v1/advertising/ads",{method:"POST",body:{campaignVersionId:document.querySelector<HTMLInputElement>("#ad-version-id")?.value.trim(),subjectType:"product",subjectId:document.querySelector<HTMLInputElement>("#ad-subject-id")?.value.trim(),creativeReference:document.querySelector<HTMLInputElement>("#ad-creative")?.value.trim(),moderationStatus:"approved"}});document.querySelector<HTMLInputElement>("#ad-id")!.value=response.data.id;state.textContent="Ad ساخته شد · "+response.data.id;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"ساخت Ad ناموفق بود.";state.className="connection-state error";}
}
async function recordAdvertisingDelivery(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-delivery-state");if(!state)return;
  try{const response=await apiJson<{data:{id:string}}>("/api/v1/advertising/delivery",{method:"POST",body:{adId:document.querySelector<HTMLInputElement>("#ad-id")?.value.trim(),placementId:document.querySelector<HTMLInputElement>("#ad-placement")?.value.trim(),decision:document.querySelector<HTMLSelectElement>("#ad-decision")?.value,policyVersion:"advertising-v1",deduplicationKey:crypto.randomUUID()}});document.querySelector<HTMLInputElement>("#ad-impression-decision")!.value=response.data.id;state.textContent="Delivery ثبت شد · "+response.data.id;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"Delivery ناموفق بود.";state.className="connection-state error";}
}
async function loadAdvertisingReport(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-report-state");if(!state)return;
  try{const response=await apiJson<{data:{impressions:number;clicks:number;delivered:number;rejected:number}}>("/api/v1/advertising/campaigns/"+encodeURIComponent(document.querySelector<HTMLInputElement>("#ad-report-campaign")?.value.trim()||"")+"/report");state.textContent="served "+response.data.delivered+" · rejected "+response.data.rejected+" · impressions "+response.data.impressions+" · clicks "+response.data.clicks;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"Report ناموفق بود.";state.className="connection-state error";}
}
async function recordAdvertisingImpression(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-report-state");if(!state)return;
  try{const response=await apiJson<{data:{id:string}}>("/api/v1/advertising/impressions",{method:"POST",body:{deliveryDecisionId:document.querySelector<HTMLInputElement>("#ad-impression-decision")?.value.trim(),deduplicationKey:crypto.randomUUID()}});document.querySelector<HTMLInputElement>("#ad-impression-id")!.value=response.data.id;state.textContent="Impression ثبت شد · "+response.data.id;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"ثبت impression ناموفق بود.";state.className="connection-state error";}
}
async function recordAdvertisingClick(): Promise<void> {
  const state=document.querySelector<HTMLElement>("#ad-report-state");if(!state)return;
  try{const response=await apiJson<{data:{id:string}}>("/api/v1/advertising/clicks",{method:"POST",body:{impressionId:document.querySelector<HTMLInputElement>("#ad-impression-id")?.value.trim(),deduplicationKey:crypto.randomUUID()}});state.textContent="Click ثبت شد · "+response.data.id;state.className="connection-state success";}catch(error){state.textContent=error instanceof Error?error.message:"ثبت click ناموفق بود.";state.className="connection-state error";}
}function renderCatalog(): string {
  const business = localStorage.getItem(STORAGE.business) ?? "";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Catalog Studio</span><h1>عرضه را بسازید؛ <em>بدون لایه اضافه.</em></h1><p>Product creation مستقیماً به Catalog canonical می‌رود. برای enrich کردن محصول، Seller AI Studio مسیر اصلی است.</p></div>
      <div class="heading-actions"><a class="button button-ghost" href="/product-studio" data-nav>Seller AI Studio ✦</a></div>
    </section>
    <section class="catalog-grid">
      <article class="glass-card catalog-card">
        <div class="card-section-heading"><div><span class="section-kicker">Product Command</span><h2>ایجاد محصول</h2></div><span id="catalog-status" class="pill">آماده</span></div>
        <div class="catalog-form">
          <div class="field-span-2"><label class="field-label" for="catalog-business">Business ID</label><input id="catalog-business" class="studio-input-line" type="text" value="${escapeAttr(business)}" placeholder="Business ID" /></div>
          <div><label class="field-label" for="catalog-name">نام محصول</label><input id="catalog-name" class="studio-input-line" type="text" placeholder="نام محصول" /></div>
          <div><label class="field-label" for="catalog-idem">Idempotency Key <span class="field-optional">خودکار</span></label><input id="catalog-idem" class="studio-input-line" type="text" value="${crypto.randomUUID()}" /></div>
          <div class="field-span-2"><label class="field-label" for="catalog-description">توضیحات</label><textarea id="catalog-description" class="studio-input-line catalog-textarea" rows="6" placeholder="توضیحات canonical محصول…"></textarea></div>
        </div>
        <div class="checkout-actions"><button class="button button-primary button-lg" type="button" data-catalog-create>ساخت محصول <span>→</span></button></div>
        <div id="catalog-result" class="connection-state">هنوز command اجرا نشده است.</div>
      </article>
      <article class="glass-card catalog-card">
        <span class="section-kicker">Product Direction</span>
        <h2>دو مسیر، یک مالکیت</h2>
        <div class="catalog-path"><span>01</span><div><strong>خام → Seller AI</strong><small>عکس/متن، غنی‌سازی، بازبینی</small></div></div>
        <div class="catalog-path"><span>02</span><div><strong>داده آماده → Catalog</strong><small>ایجاد مستقیم موجودیت canonical</small></div></div>
        <div class="connection-state">Catalog منبع حقیقت محصول است؛ Seller AI فقط orchestration و تولید پیش‌نویس را انجام می‌دهد.</div>
      </article>
    </section>
  `;
}

async function createCatalogProduct(): Promise<void> {
  const businessId = document.querySelector<HTMLInputElement>("#catalog-business")?.value.trim() ?? "";
  const name = document.querySelector<HTMLInputElement>("#catalog-name")?.value.trim() ?? "";
  const description = document.querySelector<HTMLTextAreaElement>("#catalog-description")?.value.trim() ?? "";
  const idempotencyKey = document.querySelector<HTMLInputElement>("#catalog-idem")?.value.trim() || crypto.randomUUID();
  const status = document.querySelector<HTMLElement>("#catalog-status");
  const result = document.querySelector<HTMLElement>("#catalog-result");
  if (!status || !result) return;
  if (!businessId || !name) { showToast("Business ID و نام محصول لازم هستند."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  localStorage.setItem(STORAGE.business, businessId);
  status.textContent = "در حال ایجاد";
  status.className = "pill warning";
  result.textContent = "در حال ارسال Catalog command…";
  try {
    const response = await apiJson<{ data: { id: string; name?: string; description?: string | null } }>(
      "/api/v1/catalog/products",
      {
        method: "POST",
        body: { businessId, name, ...(description ? { description } : {}) },
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    status.textContent = "ساخته شد";
    status.className = "pill success";
    result.textContent = `محصول canonical ساخته شد · ${response.data.id}`;
    result.className = "connection-state success";
    showToast("محصول Catalog ساخته شد.");
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    result.textContent = error instanceof Error ? error.message : "ساخت محصول ناموفق بود.";
    result.className = "connection-state error";
  }
}

function renderDesignSystem(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Design System</span><h1>Primitiveهای مشترک <em>ققنوس.</em></h1><p>یک owner مشترک برای visual language و تعامل‌های پایه؛ صفحات محصول از همین primitiveها compose می‌شوند.</p></div>
    </section>
    <section class="ds-playground-grid">
      <article class="glass-card ds-playground-card">
        <span class="section-kicker">Actions / Forms</span>
        <h2>Button · Input · Select</h2>
        <div class="ds-playground-stack">
          ${uiField({ id: "ds-name", label: "نام", placeholder: "کسب‌وکار" })}
          ${uiSelect({ id: "ds-status", label: "وضعیت", items: [{ value: "active", label: "فعال", selected: true }, { value: "draft", label: "پیش‌نویس" }] })}
          <div class="hero-actions">
            ${uiButton("Primary", { variant: "primary" })}
            ${uiButton("Ghost")}
            ${uiButton("Disabled", { disabled: true })}
          </div>
        </div>
      </article>
      <article class="glass-card ds-playground-card">
        <span class="section-kicker">Navigation</span>
        <h2>Tabs · Dropdown</h2>
        <div class="ds-playground-stack">
          ${uiTabs([{ id: "overview", label: "Overview", selected: true }, { id: "metrics", label: "Metrics" }])}
          ${uiDropdown("sample-menu", "Actions", ["Edit", "Duplicate", "Archive"])}
          ${uiSkeleton(3)}
        </div>
      </article>
      <article class="glass-card ds-playground-card">
        <span class="section-kicker">Data</span>
        <h2>Table / DataGrid base</h2>
        ${uiTable(["Entity", "Status", "Score"], [["Business", "Active", "92"], ["Product", "Draft", "—"]])}
      </article>
      <article class="glass-card ds-playground-card">
        <span class="section-kicker">Feedback</span>
        <h2>Dialog · Empty</h2>
        <div class="ds-dialog-demo">${uiDialog("ds-sample-dialog", "نمونه Dialog", uiEmpty("✓", "آماده", "این یک primitive قابل composition است."))}</div>
      </article>
    </section>
  `;
}

function renderAdmin(): string {
  return `
    <section class="page-heading">
      <div>
        <span class="eyebrow"><i></i> Admin / Operations</span>
        <h1>کنترل مرکزی <em>ققنوس.</em></h1>
        <p>یک نمای واحد برای tenant، workspace، اعضا، سلامت سیستم، مصرف AI و مسیرهای عملیاتی.</p>
      </div>
      <div class="heading-actions">
        <button class="button button-ghost" type="button" data-admin-refresh>بروزرسانی</button>
      </div>
    </section>
    <section class="admin-layout">
      <article class="glass-card admin-summary">
        <div class="card-section-heading"><div><span class="section-kicker">Tenant</span><h2>فضای جاری</h2></div><span id="admin-context-status" class="pill">—</span></div>
        <div class="admin-metrics">
          <div><span>Tenant</span><strong id="admin-tenant-id">—</strong></div>
          <div><span>Workspace</span><strong id="admin-workspace-id">—</strong></div>
          <div><span>اعضا</span><strong id="admin-member-count">—</strong></div>
          <div><span>Notifications</span><strong id="admin-notification-count">—</strong></div>
        </div>
      </article>
      <article class="glass-card admin-summary">
        <div class="card-section-heading"><div><span class="section-kicker">System</span><h2>سلامت Runtime</h2></div><span id="admin-health-status" class="pill">—</span></div>
        <div id="admin-health" class="admin-health-grid"><div class="slot-loading">در حال بررسی…</div></div>
      </article>
    </section>
    <section class="admin-grid">
      <article class="glass-card admin-card">
        <div class="card-section-heading"><div><span class="section-kicker">Users / Members</span><h2>اعضای workspace</h2></div></div>
        <div id="admin-members" class="admin-member-list"><div class="slot-loading">در حال بارگذاری…</div></div>
      </article>
      <article class="glass-card admin-card">
        <div class="card-section-heading"><div><span class="section-kicker">AI / Billing</span><h2>مصرف و مسیر مالی</h2></div></div>
        <div id="admin-ai-usage" class="admin-usage-panel">
          <div class="usage-callout"><strong>Seller AI</strong><span>مصرف واقعی Runtime در اجرای هر عملیات ثبت می‌شود.</span></div>
          <div class="usage-actions">
            <a class="button button-primary" href="/product-studio" data-nav>باز کردن Seller AI</a>
            <a class="button button-ghost" href="/billing" data-nav>Billing</a>
          </div>
        </div>
      </article>
      <article class="glass-card admin-card">
        <div class="card-section-heading"><div><span class="section-kicker">Jobs</span><h2>صف اجرای Automation</h2></div><span id="admin-jobs-meta" class="pill">—</span></div>
        <div id="admin-jobs-list" class="admin-jobs-list"><div class="slot-loading">در حال خواندن jobs…</div></div>
      </article>
      <article class="glass-card admin-card">
        <div class="card-section-heading"><div><span class="section-kicker">Operations</span><h2>اجرای سیستم</h2></div></div>
        <div class="admin-link-grid">
          <a class="admin-link" href="/operations" data-nav><strong>Cases / Fulfillment</strong><small>عملیات زنده و وضعیت‌ها</small></a>
          <a class="admin-link" href="/control" data-nav><strong>Automation / Integrations</strong><small>کنترل commandها و اتصال‌ها</small></a>
          <a class="admin-link" href="/seo" data-nav><strong>SEO / GEO Health</strong><small>Publication و crawler</small></a>
          <a class="admin-link" href="/trust" data-nav><strong>Trust / Verification</strong><small>اعتماد و reputation</small></a>
        </div>
      </article>
      <article class="glass-card admin-card">
        <div class="card-section-heading"><div><span class="section-kicker">Audit</span><h2>Audit Surface</h2></div></div>
        <p class="admin-note">Commandها و mutationهای حساس ققنوس در canonical audit boundary ثبت می‌شوند. این سطح فعلاً برای مشاهده مستقیم به API اختصاصی Audit نیاز دارد.</p>
        <div class="admin-actions"><button class="button button-ghost" type="button" data-toast="Audit read API در حال تکمیل است؛ mutationها همچنان از audit canonical عبور می‌کنند.">وضعیت Audit</button></div>
      </article>
    </section>
  `;
}

function renderControlCenter(): string {
  const customer = localStorage.getItem(STORAGE.customer) ?? "";
  const business = localStorage.getItem(STORAGE.business) ?? "";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Control Plane</span><h1>اتوماسیون، اتصال و حریم خصوصی را <em>کنترل کنید.</em></h1><p>فرم‌های این صفحه فقط commandهای canonical را اجرا می‌کنند؛ state و policy در domainهای اصلی باقی می‌ماند.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-control-connect>تنظیم اتصال</button></div>
    </section>
    <section class="control-grid">
      <article class="glass-card control-card">
        <div class="card-section-heading"><div><span class="section-kicker">Automation</span><h2>Workflow جدید</h2></div></div>
        <div class="control-form">
          <input id="auto-name" class="studio-input-line" type="text" placeholder="نام workflow" />
          <select id="auto-scope" class="studio-input-line"><option value="workspace">workspace</option><option value="business">business</option><option value="organization">organization</option><option value="platform">platform</option></select>
          <input id="auto-business" class="studio-input-line" type="text" value="${escapeAttr(business)}" placeholder="Business ID (برای business)" />
          <button class="button button-primary" type="button" data-auto-create>ایجاد workflow</button>
        </div>
        <div id="auto-result" class="connection-state">هنوز اجرا نشده است.</div>
      </article>

      <article class="glass-card control-card">
        <div class="card-section-heading"><div><span class="section-kicker">Integration</span><h2>اتصال حساب خارجی</h2></div></div>
        <div class="control-form">
          <input id="integration-provider" class="studio-input-line" type="text" placeholder="Provider ID" />
          <input id="integration-type" class="studio-input-line" type="text" placeholder="account type" value="merchant" />
          <input id="integration-external" class="studio-input-line" type="text" placeholder="External account reference" />
          <input id="integration-credential" class="studio-input-line" type="text" placeholder="Credential reference (optional)" />
          <button class="button button-primary" type="button" data-integration-connect>اتصال</button>
        </div>
        <div id="integration-result" class="connection-state">Credential واقعی را اینجا وارد نکنید؛ فقط reference canonical ثبت می‌شود.</div>
      </article>

      <article class="glass-card control-card">
        <div class="card-section-heading"><div><span class="section-kicker">Authorization Governance</span><h2>Approval Request</h2></div><span id="approval-status" class="pill">—</span></div>
        <div class="control-form">
          <input id="approval-action" class="studio-input-line" type="text" value="business.publish" placeholder="Action" />
          <input id="approval-resource-type" class="studio-input-line" type="text" value="business" placeholder="Resource type" />
          <input id="approval-resource-id" class="studio-input-line" type="text" placeholder="Resource ID" />
          <input id="approval-reason" class="studio-input-line" type="text" placeholder="Reason" />
          <input id="approval-approver-role" class="studio-input-line" type="text" value="admin" placeholder="Required approver role" />
          <button class="button button-primary" type="button" data-approval-create>درخواست تأیید</button>
          <input id="approval-id" class="studio-input-line" type="text" placeholder="Approval ID" />
          <input id="approval-decision-reason" class="studio-input-line" type="text" value="Reviewed by authorized approver" />
          <button class="button button-primary" type="button" data-approval-approve>تأیید</button>
          <button class="button button-ghost" type="button" data-approval-reject>رد</button>
        </div>
        <div id="approval-result" class="connection-state">هیچ Approval Requestی اجرا نشده است.</div>
      </article>

      <article class="glass-card control-card">
        <div class="card-section-heading"><div><span class="section-kicker">Privacy</span><h2>Consent / Data Request</h2></div></div>
        <div class="control-form">
          <input id="privacy-subject" class="studio-input-line" type="text" value="${escapeAttr(customer)}" placeholder="Subject ID" />
          <select id="privacy-subject-type" class="studio-input-line"><option value="customer">customer</option><option value="user">user</option><option value="member">member</option><option value="actor">actor</option></select>
          <input id="privacy-purpose" class="studio-input-line" type="text" placeholder="Purpose" value="product_updates" />
          <input id="privacy-version" class="studio-input-line" type="text" placeholder="Consent version" value="privacy-v1" />
          <button class="button button-primary" type="button" data-privacy-consent>ثبت Consent</button>
          <select id="privacy-request-type" class="studio-input-line"><option value="access">access</option><option value="export">export</option><option value="delete">delete</option><option value="restrict">restrict</option><option value="correct">correct</option></select>
          <button class="button button-ghost" type="button" data-privacy-request>ایجاد Data Request</button>
        </div>
        <div id="privacy-result" class="connection-state">وضعیت privacy commandها اینجا نمایش داده می‌شود.</div>
      </article>
    </section>
  `;
}

async function createApprovalRequest(): Promise<void> {
  const result = document.querySelector<HTMLElement>("#approval-result");
  const status = document.querySelector<HTMLElement>("#approval-status");
  if (!result || !status) return;
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  const action = document.querySelector<HTMLInputElement>("#approval-action")?.value.trim() ?? "";
  const resourceType = document.querySelector<HTMLInputElement>("#approval-resource-type")?.value.trim() ?? "";
  const resourceId = document.querySelector<HTMLInputElement>("#approval-resource-id")?.value.trim() ?? "";
  const reason = document.querySelector<HTMLInputElement>("#approval-reason")?.value.trim() ?? "";
  if (!action || !resourceType || !resourceId || !reason) { showToast("Action، Resource و Reason الزامی هستند."); return; }
  try {
    const response = await apiJson<{ data: { id: string; status: string } }>("/api/v1/authorization/approval-requests", {
      method: "POST",
      body: {
        action,
        resourceType,
        resourceId,
        reason,
        requiredApproverRole: document.querySelector<HTMLInputElement>("#approval-approver-role")?.value.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      },
    });
    document.querySelector<HTMLInputElement>("#approval-id")!.value = response.data.id;
    status.textContent = response.data.status;
    status.className = "pill warning";
    result.textContent = "Approval Request ساخته شد · " + response.data.id;
    result.className = "connection-state success";
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    result.textContent = error instanceof Error ? error.message : "ساخت Approval ناموفق بود.";
    result.className = "connection-state error";
  }
}

async function decideApproval(decision: "approve" | "reject"): Promise<void> {
  const result = document.querySelector<HTMLElement>("#approval-result");
  const status = document.querySelector<HTMLElement>("#approval-status");
  const id = document.querySelector<HTMLInputElement>("#approval-id")?.value.trim() ?? "";
  const reason = document.querySelector<HTMLInputElement>("#approval-decision-reason")?.value.trim() ?? "";
  if (!result || !status || !id || !reason) { showToast("Approval ID و reason لازم هستند."); return; }
  try {
    const response = await apiJson<{ data: { id: string; status: string } }>(
      "/api/v1/authorization/approval-requests/" + encodeURIComponent(id) + "/" + decision,
      { method: "POST", body: { reason } },
    );
    status.textContent = response.data.status;
    status.className = response.data.status === "approved" ? "pill success" : "pill warning";
    result.textContent = "Approval " + response.data.status + " شد · " + response.data.id;
    result.className = "connection-state success";
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : "تصمیم Approval ناموفق بود.";
    result.className = "connection-state error";
  }
}

async function createAutomationWorkflow(): Promise<void> {
  const name = document.querySelector<HTMLInputElement>("#auto-name")?.value.trim() ?? "";
  const scope = document.querySelector<HTMLSelectElement>("#auto-scope")?.value ?? "";
  const businessId = document.querySelector<HTMLInputElement>("#auto-business")?.value.trim() ?? "";
  const state = document.querySelector<HTMLElement>("#auto-result");
  if (!state) return;
  if (!name) { showToast("نام workflow لازم است."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  try {
    const response = await apiJson<{ data: { id: string; name?: string } }>("/api/v1/automation/workflows", {
      method: "POST",
      body: { name, scope, ...(scope === "business" && businessId ? { businessId } : {}) },
    });
    state.textContent = `Workflow ساخته شد · ${response.data.id}`;
    state.className = "connection-state success";
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "ساخت workflow ناموفق بود.";
    state.className = "connection-state error";
  }
}

async function connectIntegrationAccount(): Promise<void> {
  const providerId = document.querySelector<HTMLInputElement>("#integration-provider")?.value.trim() ?? "";
  const accountType = document.querySelector<HTMLInputElement>("#integration-type")?.value.trim() ?? "";
  const externalAccountReference = document.querySelector<HTMLInputElement>("#integration-external")?.value.trim() ?? "";
  const credentialReference = document.querySelector<HTMLInputElement>("#integration-credential")?.value.trim() ?? "";
  const state = document.querySelector<HTMLElement>("#integration-result");
  if (!state) return;
  if (!providerId || !accountType || !externalAccountReference) { showToast("Provider، account type و external reference لازم هستند."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  try {
    const response = await apiJson<{ data: { id: string } }>("/api/v1/integrations/accounts", {
      method: "POST",
      body: { providerId, accountType, externalAccountReference, ...(credentialReference ? { credentialReference } : {}) },
    });
    state.textContent = `Integration account ساخته شد · ${response.data.id}`;
    state.className = "connection-state success";
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "اتصال integration ناموفق بود.";
    state.className = "connection-state error";
  }
}

async function grantPrivacyConsent(): Promise<void> {
  const subjectId = document.querySelector<HTMLInputElement>("#privacy-subject")?.value.trim() ?? "";
  const subjectType = document.querySelector<HTMLSelectElement>("#privacy-subject-type")?.value ?? "";
  const purpose = document.querySelector<HTMLInputElement>("#privacy-purpose")?.value.trim() ?? "";
  const consentVersion = document.querySelector<HTMLInputElement>("#privacy-version")?.value.trim() ?? "";
  const state = document.querySelector<HTMLElement>("#privacy-result");
  if (!state) return;
  if (!subjectId || !purpose || !consentVersion) { showToast("Subject، Purpose و Consent version لازم هستند."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  try {
    const response = await apiJson<{ data: { id: string } }>("/api/v1/privacy/consents", {
      method: "POST",
      body: { subjectType, subjectId, purpose, consentVersion, source: "web", grantedAt: new Date().toISOString() },
    });
    state.textContent = `Consent ثبت شد · ${response.data.id}`;
    state.className = "connection-state success";
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "ثبت consent ناموفق بود.";
    state.className = "connection-state error";
  }
}

async function createPrivacyRequest(): Promise<void> {
  const subjectId = document.querySelector<HTMLInputElement>("#privacy-subject")?.value.trim() ?? "";
  const subjectType = document.querySelector<HTMLSelectElement>("#privacy-subject-type")?.value ?? "";
  const requestType = document.querySelector<HTMLSelectElement>("#privacy-request-type")?.value ?? "";
  const state = document.querySelector<HTMLElement>("#privacy-result");
  if (!state) return;
  if (!subjectId) { showToast("Subject ID لازم است."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  try {
    const response = await apiJson<{ data: { id: string; status?: string } }>("/api/v1/privacy/requests", {
      method: "POST",
      body: { subjectType, subjectId, requestType, requestedBy: "web" },
    });
    state.textContent = `Data Request ساخته شد · ${response.data.id} · ${response.data.status ?? "requested"}`;
    state.className = "connection-state success";
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "ساخت privacy request ناموفق بود.";
    state.className = "connection-state error";
  }
}

function renderSeo(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> SEO / GEO</span><h1>حضور بیرونی ققنوس را <em>قابل اندازه‌گیری</em> کنید.</h1><p>Audit و publication health مستقیماً از SEO canonical خوانده می‌شوند.</p></div>
      <div class="heading-actions"><a class="button button-ghost" href="/sitemap.xml" target="_blank" rel="noreferrer">Sitemap ↗</a><a class="button button-ghost" href="/robots.txt" target="_blank" rel="noreferrer">Robots ↗</a></div>
    </section>
    <section class="seo-grid">
      <article class="glass-card seo-card">
        <div class="card-section-heading"><div><span class="section-kicker">Audit</span><h2>Entity SEO Audit</h2></div><span id="seo-audit-status" class="pill">آماده</span></div>
        <div class="seo-form">
          <input id="seo-entity" class="studio-input-line" type="text" placeholder="Entity ID" />
          <input id="seo-locale" class="studio-input-line" type="text" value="fa-IR" placeholder="Locale" />
          <button class="button button-primary" type="button" data-seo-audit>اجرای Audit</button><button class="button button-ghost" type="button" data-seo-crawl>Production Crawl</button><button class="button button-ghost" type="button" data-seo-visibility>اندازه‌گیری Visibility / Citation</button><button class="button button-ghost" type="button" data-seo-competitive>Competitive Intelligence</button>
        </div>
        <div id="seo-audit-result" class="seo-result"><div class="slot-empty"><span>◎</span><p>Entity ID را وارد کنید.</p></div></div>
      </article>
      <article class="glass-card seo-card">
        <div class="card-section-heading"><div><span class="section-kicker">Publication</span><h2>سلامت انتشار</h2></div><span id="seo-health-status" class="pill">—</span></div>
        <div id="seo-health-result" class="seo-health-result"><div class="slot-empty"><span>◌</span><p>در حال خواندن…</p></div></div>
        <button class="button button-ghost" type="button" data-seo-health>بروزرسانی health</button>
      </article>
    </section>
  `;
}

async function loadSeoHealth(): Promise<void> {
  const status = document.querySelector<HTMLElement>("#seo-health-status");
  const host = document.querySelector<HTMLDivElement>("#seo-health-result");
  if (!status || !host) return;
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  host.innerHTML = '<div class="slot-loading">در حال خواندن SEO health…</div>';
  try {
    const response = await apiJson<{ status: string; publication?: { pending: number; failed: number }; productionCrawler?: { recentFailures: number; lastObservedAt: string | null }; visibilityMeasurement?: { recentFailures: number; runs: number; lastObservedAt: string | null }; competitiveIntelligence?: { recentFailures: number; runs: number; activeCompetitors: number; lastObservedAt: string | null } }>("/api/v1/seo/health");
    const pending = response.publication?.pending ?? 0;
    const failed = response.publication?.failed ?? 0;
    const crawlFailures = response.productionCrawler?.recentFailures ?? 0;
    const measurementFailures = response.visibilityMeasurement?.recentFailures ?? 0;
    const competitiveFailures = response.competitiveIntelligence?.recentFailures ?? 0;
    status.textContent = failed || crawlFailures || measurementFailures || competitiveFailures ? "نیازمند توجه" : "سالم";
    status.className = failed || crawlFailures || measurementFailures || competitiveFailures ? "pill warning" : "pill success";
    host.innerHTML = `
      <div class="seo-health-metrics">
        <div><span>Pending</span><strong>${pending}</strong></div>
        <div><span>Failed</span><strong>${failed}</strong></div>
        <div><span>Crawler failures</span><strong>${crawlFailures}</strong></div>
        <div><span>Measurement failures</span><strong>${measurementFailures}</strong></div>
        <div><span>CI failures</span><strong>${competitiveFailures}</strong></div>
        <div><span>Health</span><strong>${escapeHtml(response.status)}</strong></div>
      </div>`;
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "SEO health ناموفق بود.")}</p></div>`;
  }
}

async function loadSeoCompetitiveIntelligence(): Promise<void> {
  const entityId = document.querySelector<HTMLInputElement>("#seo-entity")?.value.trim() ?? "";
  const status = document.querySelector<HTMLElement>("#seo-audit-status");
  const host = document.querySelector<HTMLDivElement>("#seo-audit-result");
  if (!entityId || !status || !host) { showToast("Entity ID لازم است."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  status.textContent = "در حال CI";
  status.className = "pill warning";
  host.innerHTML = '<div class="slot-loading">در حال تحلیل واقعی SERP و رقبا…</div>';
  try {
    const response = await apiJson<{
      competitive: {
        competitors: { domain: string; displayName?: string | null; competitorType: string; observations: number; bestObservedRank?: number | null }[];
        changes: { queryText: string; changeType: string; previousRank?: number | null; currentRank?: number | null; currentUrl?: string | null }[];
        opportunities: { queryText: string; competitorBestRank?: number | null; competitorDomains: number }[];
        pageSnapshots: { domain?: string | null; resultUrl: string; title?: string | null; h1Count?: number | null; wordCount?: number | null; internalLinksCount?: number | null; titleLength?: number | null; descriptionLength?: number | null }[];
        keywordGaps: { competitorDomain: string; keyword: string; searchVolume?: number | null; competitorRank?: number | null; gapType: string; }[];
        linkGaps: { competitorDomain: string; referringDomain: string; competitorBacklinks?: number | null; competitorDomainRank?: number | null; }[];
      };
    }>(`/api/v1/seo/competitive/${encodeURIComponent(entityId)}`);
    const value = response.competitive;
    const competitors = value.competitors.slice(0, 8);
    const changes = value.changes.slice(0, 8);
    const opportunities = value.opportunities.slice(0, 8);
    const pageSnapshots = value.pageSnapshots.slice(0, 8);
    const keywordGaps = value.keywordGaps.slice(0, 8);
    const linkGaps = value.linkGaps.slice(0, 8);
    host.innerHTML = `
      <div class="seo-audit-summary">
        <div class="seo-audit-score"><span>Competitors</span><strong>${value.competitors.length}</strong></div>
        <div><span>Changes</span><strong>${value.changes.length}</strong></div>
        <div><span>Gaps</span><strong>${value.opportunities.length}</strong></div>
        <div><span>Mode</span><strong>Observed SERP</strong></div>
      </div>
      <div class="seo-audit-list">${competitors.map((item) => `<div><span>${escapeHtml(item.domain)}</span><strong>#${escapeHtml(String(item.bestObservedRank ?? "—"))} · ${escapeHtml(String(item.observations))} obs</strong></div>`).join("")}</div>
      ${changes.length ? `<div class="seo-audit-issues">${changes.map((item) => `<article><div><strong>${escapeHtml(item.changeType)}</strong><span class="pill warning">${escapeHtml(item.queryText)}</span></div><p>${escapeHtml(String(item.previousRank ?? "—"))} → ${escapeHtml(String(item.currentRank ?? "—"))}</p><small>${escapeHtml(item.currentUrl ?? "")}</small></article>`).join("")}</div>` : ""}
      ${opportunities.length ? `<div class="seo-audit-issues">${opportunities.map((item) => `<article><div><strong>Query gap</strong><span class="pill danger">${escapeHtml(item.queryText)}</span></div><p>${escapeHtml(String(item.competitorDomains))} competitor domains observed; best observed rank #${escapeHtml(String(item.competitorBestRank ?? "—"))}.</p></article>`).join("")}</div>` : ""}
      ${pageSnapshots.length ? `<div class="seo-audit-issues">${pageSnapshots.map((item) => `<article><div><strong>${escapeHtml(item.domain ?? "competitor page")}</strong><span class="pill success">page</span></div><p>${escapeHtml(item.title ?? item.resultUrl)}</p><small>H1: ${escapeHtml(String(item.h1Count ?? "—"))} · words: ${escapeHtml(String(item.wordCount ?? "—"))} · internal links: ${escapeHtml(String(item.internalLinksCount ?? "—"))} · title: ${escapeHtml(String(item.titleLength ?? "—"))}</small></article>`).join("")}</div>` : ""}
      ${keywordGaps.length ? `<div class="seo-audit-issues">${keywordGaps.map((item) => `<article><div><strong>Keyword Gap</strong><span class="pill danger">${escapeHtml(item.competitorDomain)}</span></div><p>${escapeHtml(item.keyword)}</p><small>Search volume: ${escapeHtml(String(item.searchVolume ?? "—"))} · competitor rank: ${escapeHtml(String(item.competitorRank ?? "—"))} · ${escapeHtml(item.gapType)}</small></article>`).join("")}</div>` : ""}
      ${linkGaps.length ? `<div class="seo-audit-issues">${linkGaps.map((item) => `<article><div><strong>Link Gap</strong><span class="pill warning">${escapeHtml(item.competitorDomain)}</span></div><p>${escapeHtml(item.referringDomain)}</p><small>Competitor backlinks: ${escapeHtml(String(item.competitorBacklinks ?? "—"))} · domain rank: ${escapeHtml(String(item.competitorDomainRank ?? "—"))}</small></article>`).join("")}</div>` : ""}
    `;
    status.textContent = "CI آماده";
    status.className = "pill success";
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "Competitive intelligence ناموفق بود.")}</p></div>`;
  }
}

async function runSeoVisibilityMeasurement(): Promise<void> {
  const entityId = document.querySelector<HTMLInputElement>("#seo-entity")?.value.trim() ?? "";
  const locale = document.querySelector<HTMLInputElement>("#seo-locale")?.value.trim() ?? "";
  const status = document.querySelector<HTMLElement>("#seo-audit-status");
  const host = document.querySelector<HTMLDivElement>("#seo-audit-result");
  if (!entityId || !status || !host) { showToast("Entity ID لازم است."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  status.textContent = "در حال Measurement";
  status.className = "pill warning";
  host.innerHTML = '<div class="slot-loading">در حال دریافت داده واقعی Search / AI Citation…</div>';
  try {
    const response = await apiJson<{
      measurement: { queries: number; providerRuns: number; observations: number; failures: number };
    }>(`/api/v1/seo/visibility/measure/${encodeURIComponent(entityId)}?locale=${encodeURIComponent(locale || "fa-IR")}`, { method: "POST" });
    const result = response.measurement;
    const latest = await apiJson<{
      visibility: {
        measurements: { metric: string; valueNumeric?: number | null; valueText?: string | null; provenance: Record<string, unknown> }[];
        citations: { citationUrl: string; citationTitle?: string | null; citationPosition?: number | null; sourceType: string }[];
      };
    }>(`/api/v1/seo/visibility/${encodeURIComponent(entityId)}`);
    status.textContent = result.failures ? "Measurement Partial" : "Measurement Pass";
    status.className = result.failures ? "pill warning" : "pill success";
    const metrics = latest.visibility.measurements.slice(0, 12);
    const citations = latest.visibility.citations.slice(0, 8);
    host.innerHTML = `
      <div class="seo-audit-summary">
        <div class="seo-audit-score"><span>Queries</span><strong>${result.queries}</strong></div>
        <div><span>Provider runs</span><strong>${result.providerRuns}</strong></div>
        <div><span>Observations</span><strong>${result.observations}</strong></div>
        <div><span>Failures</span><strong>${result.failures}</strong></div>
      </div>
      <div class="seo-audit-list">${metrics.map((item) => `<div><span>${escapeHtml(item.metric)}</span><strong>${escapeHtml(String(item.valueNumeric ?? item.valueText ?? "—"))}</strong></div>`).join("")}</div>
      ${citations.length ? `<div class="seo-audit-issues">${citations.map((item) => `<article><div><strong>${escapeHtml(item.sourceType)}</strong><span class="pill success">citation</span></div><p>${escapeHtml(item.citationTitle ?? item.citationUrl)}</p><small>${escapeHtml(item.citationUrl)} · position ${escapeHtml(String(item.citationPosition ?? "—"))}</small></article>`).join("")}</div>` : ""}`;
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "Visibility measurement ناموفق بود.")}</p></div>`;
  }
}

async function runSeoProductionCrawl(): Promise<void> {
  const entityId = document.querySelector<HTMLInputElement>("#seo-entity")?.value.trim() ?? "";
  const locale = document.querySelector<HTMLInputElement>("#seo-locale")?.value.trim() ?? "";
  const status = document.querySelector<HTMLElement>("#seo-audit-status");
  const host = document.querySelector<HTMLDivElement>("#seo-audit-result");
  if (!entityId || !status || !host) { showToast("Entity ID لازم است."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  status.textContent = "در حال Crawl";
  status.className = "pill warning";
  host.innerHTML = '<div class="slot-loading">در حال دریافت HTML واقعی production…</div>';
  try {
    const response = await apiJson<{
      crawl: {
        status: number;
        finalUrl: string;
        renderMode: string;
        errors: string[];
        warnings: string[];
      };
    }>(`/api/v1/seo/crawl/${encodeURIComponent(entityId)}?locale=${encodeURIComponent(locale || "fa-IR")}`, { method: "POST" });
    const crawl = response.crawl;
    const failed = crawl.errors.length > 0;
    host.innerHTML = `
      <div class="seo-audit-summary">
        <div class="seo-audit-score"><span>HTTP</span><strong>${crawl.status}</strong></div>
        <div><span>Render</span><strong>${escapeHtml(crawl.renderMode)}</strong></div>
        <div><span>Errors</span><strong>${crawl.errors.length}</strong></div>
        <div><span>Warnings</span><strong>${crawl.warnings.length}</strong></div>
      </div>
      <div class="seo-audit-list"><div><span>Final URL</span><strong>${escapeHtml(crawl.finalUrl)}</strong></div></div>
      ${crawl.errors.length ? `<div class="seo-audit-issues">${crawl.errors.map((item) => `<article><strong>ERROR</strong><p>${escapeHtml(item)}</p></article>`).join("")}</div>` : ""}
      ${crawl.warnings.length ? `<div class="seo-audit-issues">${crawl.warnings.map((item) => `<article><strong>WARNING</strong><p>${escapeHtml(item)}</p></article>`).join("")}</div>` : ""}
    `;
    status.textContent = failed ? "Crawler Error" : "Crawler Pass";
    status.className = failed ? "pill danger" : "pill success";
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "Production crawl ناموفق بود.")}</p></div>`;
  }
}

async function runSeoAudit(): Promise<void> {
  const entityId = document.querySelector<HTMLInputElement>("#seo-entity")?.value.trim() ?? "";
  const locale = document.querySelector<HTMLInputElement>("#seo-locale")?.value.trim() ?? "";
  const status = document.querySelector<HTMLElement>("#seo-audit-status");
  const host = document.querySelector<HTMLDivElement>("#seo-audit-result");
  if (!entityId || !status || !host) { showToast("Entity ID لازم است."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  status.textContent = "در حال اجرا";
  status.className = "pill warning";
  host.innerHTML = '<div class="slot-loading">در حال اجرای SEO audit…</div>';
  try {
    const response = await apiJson<{
      audit: {
        overallScore: number;
        status: "pass" | "warning" | "blocked";
        blockingIssueCodes: string[];
        scores: Record<string, number>;
        issues: { code: string; severity: string; evidence: string; recommendation: string }[];
        generatedAt: string;
      };
    }>(
      `/api/v1/seo/audit/${encodeURIComponent(entityId)}?locale=${encodeURIComponent(locale || "fa-IR")}`,
      { method: "POST" },
    );
    const audit = response.audit;
    const statusLabel = audit.status === "blocked" ? "Blocked" : audit.status === "warning" ? "Warning" : "Pass";
    const statusClass = audit.status === "blocked" ? "pill danger" : audit.status === "warning" ? "pill warning" : "pill success";
    const scoreEntries = Object.entries(audit.scores).slice(0, 12);
    const issueEntries = audit.issues.slice(0, 8);
    host.innerHTML = `
      <div class="seo-audit-summary">
        <div class="seo-audit-score"><span>Overall</span><strong>${audit.overallScore}</strong><small>/100</small></div>
        <div><span>Status</span><strong>${escapeHtml(statusLabel)}</strong></div>
        <div><span>Blockers</span><strong>${audit.blockingIssueCodes.length}</strong></div>
        <div><span>Generated</span><strong>${escapeHtml(formatDate(audit.generatedAt))}</strong></div>
      </div>
      <div class="seo-audit-list">${scoreEntries.map(([key,value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("")}</div>
      ${issueEntries.length ? `<div class="seo-audit-issues">${issueEntries.map((item) => `<article><div><strong>${escapeHtml(item.code)}</strong><span class="pill ${item.severity === "error" ? "danger" : item.severity === "warning" ? "warning" : ""}">${escapeHtml(item.severity)}</span></div><p>${escapeHtml(item.evidence)}</p><small>${escapeHtml(item.recommendation)}</small></article>`).join("")}</div>` : ""}
    `;
    status.textContent = statusLabel;
    status.className = statusClass;
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "SEO audit ناموفق بود.")}</p></div>`;
  }
}

function renderOperations(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Operations Center</span><h1>عملیات را یکجا <em>کنترل کنید.</em></h1><p>Case Support و Fulfillment از backend canonical خوانده می‌شوند و تغییر وضعیت مستقیم به commandهای دامنه متصل است.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-ops-refresh>بروزرسانی</button></div>
    </section>
    <section class="operations-grid">
      <article class="glass-card ops-card">
        <div class="card-section-heading"><div><span class="section-kicker">Case Support</span><h2>پرونده‌های اخیر</h2></div><span id="cases-meta" class="pill">—</span></div>
        <div class="ops-toolbar"><input id="case-limit" class="studio-input-line" type="number" value="50" min="1" max="100" /><button class="button button-primary" type="button" data-load-cases>خواندن پرونده‌ها</button></div>
        <div id="case-list" class="case-list"><div class="slot-empty"><span>⚙</span><p>در حال آماده‌سازی…</p></div></div>
      </article>
      <article class="glass-card ops-card">
        <div class="card-section-heading"><div><span class="section-kicker">Fulfillment</span><h2>پیگیری تحویل</h2></div><span id="fulfillment-status" class="pill">—</span></div>
        <div class="ops-toolbar"><input id="fulfillment-id" class="studio-input-line" type="text" placeholder="Fulfillment ID" /><button class="button button-primary" type="button" data-load-fulfillment>خواندن</button></div>
        <div id="fulfillment-detail" class="fulfillment-detail"><div class="slot-empty"><span>◫</span><p>Fulfillment ID را وارد کنید.</p></div></div>
      </article>
    </section>
  `;
}

type CaseView = {
  id: string;
  status: string;
  priority: string;
  severity: string;
  subjectType: string;
  subjectId: string;
  requesterType: string;
  requesterId: string;
  version: number;
  updatedAt: string;
};

async function loadCases(): Promise<void> {
  const host = document.querySelector<HTMLDivElement>("#case-list");
  const meta = document.querySelector<HTMLElement>("#cases-meta");
  const limit = Number(document.querySelector<HTMLInputElement>("#case-limit")?.value ?? "50");
  if (!host || !meta) return;
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  host.innerHTML = '<div class="slot-loading">در حال خواندن cases…</div>';
  try {
    const response = await apiJson<{ data: CaseView[] }>(`/api/v1/cases?limit=${Math.min(Math.max(limit || 50,1),100)}`);
    const items = Array.isArray(response.data) ? response.data : [];
    host.innerHTML = items.length ? items.map((item) => `
      <div class="case-item">
        <div class="case-main">
          <div class="case-line"><strong>${escapeHtml(item.id)}</strong><span class="pill ${item.status === "resolved" || item.status === "closed" ? "success" : ""}">${escapeHtml(item.status)}</span></div>
          <p>${escapeHtml(item.subjectType)} · ${escapeHtml(item.subjectId)}</p>
          <small>${escapeHtml(item.priority)} · severity ${escapeHtml(item.severity)} · v${item.version}</small>
        </div>
        <div class="case-actions">
          <button class="button button-ghost" type="button" data-case-response="${escapeAttr(item.id)}">first response</button>
          <select class="studio-input-line case-status-select" data-case-status="${escapeAttr(item.id)}" data-case-version="${item.version}">
            ${["open","triaged","assigned","in_progress","waiting","escalated","resolved","closed","reopened"].map((status) => `<option value="${status}" ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <button class="button button-primary" type="button" data-case-save="${escapeAttr(item.id)}">ذخیره</button>
        </div>
      </div>`).join("") : '<div class="slot-empty"><span>✓</span><p>پرونده‌ای پیدا نشد.</p></div>';
    meta.textContent = `${items.length} case`;
    bindCaseActions();
  } catch (error) {
    meta.textContent = "خطا";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن cases ناموفق بود.")}</p></div>`;
  }
}

function bindCaseActions(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-case-response]").forEach((button) => {
    button.addEventListener("click", async () => {
      const caseId = button.dataset.caseResponse;
      if (!caseId) return;
      try {
        await apiJson(`/api/v1/cases/${encodeURIComponent(caseId)}/first-response`, { method: "POST" });
        showToast("First response ثبت شد.");
        void loadCases();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "ثبت first response ناموفق بود.");
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-case-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const caseId = button.dataset.caseSave;
      const select = document.querySelector<HTMLSelectElement>(`[data-case-status="${CSS.escape(caseId ?? "")}"]`);
      if (!caseId || !select) return;
      const version = Number(select.dataset.caseVersion ?? "0");
      try {
        await apiJson(`/api/v1/cases/${encodeURIComponent(caseId)}/status`, {
          method: "POST",
          body: { status: select.value, expectedVersion: version },
        });
        showToast("وضعیت Case به‌روز شد.");
        void loadCases();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "به‌روزرسانی case ناموفق بود.");
      }
    });
  });
}

async function loadFulfillment(): Promise<void> {
  const id = document.querySelector<HTMLInputElement>("#fulfillment-id")?.value.trim() ?? "";
  const host = document.querySelector<HTMLDivElement>("#fulfillment-detail");
  const status = document.querySelector<HTMLElement>("#fulfillment-status");
  if (!id || !host || !status) { if (!id) showToast("Fulfillment ID لازم است."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  host.innerHTML = '<div class="slot-loading">در حال خواندن fulfillment…</div>';
  try {
    const response = await apiJson<{ data: { fulfillment: Record<string, unknown>; items: Record<string, unknown>[] } }>(
      `/api/v1/fulfillment/${encodeURIComponent(id)}`,
    );
    const order = response.data.fulfillment;
    const items = response.data.items ?? [];
    const fulfillmentStatus = getRecordString(order, ["status"]) ?? "—";
    status.textContent = fulfillmentStatus;
    status.className = fulfillmentStatus === "completed" ? "pill success" : "pill warning";
    host.innerHTML = `
      <div class="fulfillment-summary">
        <div class="account-row"><span>Fulfillment</span><strong>${escapeHtml(getRecordString(order, ["id"]) ?? id)}</strong></div>
        <div class="account-row"><span>Source</span><strong>${escapeHtml(getRecordString(order, ["sourceType"]) ?? "—")}</strong></div>
        <div class="account-row"><span>Business</span><strong>${escapeHtml(getRecordString(order, ["businessId"]) ?? "—")}</strong></div>
        <div class="account-row"><span>Type</span><strong>${escapeHtml(getRecordString(order, ["fulfillmentType"]) ?? "—")}</strong></div>
      </div>
      <div class="fulfillment-items">
        ${items.length ? items.map((item) => `<div class="fulfillment-item"><span>${escapeHtml(getRecordString(item, ["id"]) ?? "item")}</span><strong>${escapeHtml(getRecordString(item, ["status"]) ?? "—")}</strong><small>qty ${getRecordNumber(item, ["quantity"]) ?? "—"}</small></div>`).join("") : '<div class="slot-empty"><span>◫</span><p>Fulfillment item ندارد.</p></div>'}
      </div>`;
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن fulfillment ناموفق بود.")}</p></div>`;
  }
}

function renderTrust(): string {
  const business = localStorage.getItem(STORAGE.business) ?? "";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Trust & Verification</span><h1>اعتماد را <em>قابل مشاهده</em> کنید.</h1><p>Verification، trust signals و reputation از هسته Trust ققنوس خوانده می‌شوند.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-trust-load>بروزرسانی</button></div>
    </section>
    <section class="trust-grid">
      <article class="glass-card trust-card">
        <div class="card-section-heading"><div><span class="section-kicker">Trust Signals</span><h2>سیگنال‌های اعتماد</h2></div><span id="trust-meta" class="pill">—</span></div>
        <div class="trust-filters">
          <input id="trust-subject" class="studio-input-line" type="text" value="${escapeAttr(business)}" placeholder="Subject ID" />
          <select id="trust-subject-type" class="studio-input-line"><option value="business">business</option><option value="product">product</option><option value="offering">offering</option></select>
          <select id="trust-signal-status" class="studio-input-line"><option value="">همه وضعیت‌ها</option><option value="active">active</option><option value="expired">expired</option><option value="superseded">superseded</option><option value="dismissed">dismissed</option></select>
          <button class="button button-primary" type="button" data-trust-load>خواندن سیگنال‌ها</button>
        </div>
        <div id="trust-signals" class="signal-list"><div class="slot-empty"><span>✓</span><p>شناسه subject را وارد کنید.</p></div></div>
      </article>
      <article class="glass-card trust-card">
        <div class="card-section-heading"><div><span class="section-kicker">Reputation</span><h2>بازسازی اعتبار</h2></div></div>
        <div class="reputation-action">
          <p>محاسبه reputation توسط Trust backend انجام می‌شود؛ UI فقط command canonical را ارسال می‌کند.</p>
          <label class="field-label" for="trust-policy">Policy version</label>
          <input id="trust-policy" class="studio-input-line" type="text" value="trust-v1" />
          <button class="button button-primary button-lg" type="button" data-trust-rebuild>بازسازی reputation <span>→</span></button>
          <div id="trust-rebuild-state" class="connection-state">هنوز اجرا نشده است.</div>
        </div>
      </article>
    </section>
    <section class="glass-card review-create-card">
      <div class="card-section-heading"><div><span class="section-kicker">Customer Voice</span><h2>ثبت review</h2></div></div>
      <div class="review-form-grid">
        <input id="trust-review-customer" class="studio-input-line" type="text" value="${escapeAttr(localStorage.getItem(STORAGE.customer) ?? "")}" placeholder="Customer ID" />
        <input id="trust-review-business" class="studio-input-line" type="text" value="${escapeAttr(business)}" placeholder="Business ID" />
        <select id="trust-review-rating" class="studio-input-line"><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select>
        <input id="trust-review-content" class="studio-input-line review-content-input" type="text" placeholder="نظر مشتری…" />
        <button class="button button-primary" type="button" data-trust-create-review>ثبت review</button>
      </div>
      <div id="trust-review-state" class="connection-state">Review با وضعیت moderation backend کنترل می‌شود.</div>
    </section>
  `;
}

async function loadTrustSignals(): Promise<void> {
  const subject = document.querySelector<HTMLInputElement>("#trust-subject")?.value.trim() ?? "";
  const subjectType = document.querySelector<HTMLSelectElement>("#trust-subject-type")?.value ?? "";
  const status = document.querySelector<HTMLSelectElement>("#trust-signal-status")?.value ?? "";
  const host = document.querySelector<HTMLDivElement>("#trust-signals");
  const meta = document.querySelector<HTMLElement>("#trust-meta");
  if (!host || !meta) return;
  if (!subject) {
    showToast("Subject ID لازم است.");
    return;
  }
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }
  const params = new URLSearchParams({ subjectType, subjectId: subject, limit: "100" });
  if (status) params.set("status", status);
  host.innerHTML = '<div class="slot-loading">در حال خواندن trust signals…</div>';
  try {
    const response = await apiJson<{ data: Record<string, unknown>[] }>(`/api/v1/trust/signals?${params.toString()}`);
    const items = Array.isArray(response.data) ? response.data : [];
    host.innerHTML = items.length
      ? items.map((signal) => {
          const kind = getRecordString(signal, ["signalType", "type"]) ?? "signal";
          const signalStatus = getRecordString(signal, ["status"]) ?? "—";
          const source = getRecordString(signal, ["source"]) ?? "—";
          const confidence = getRecordNumber(signal, ["confidence"]);
          const value = signal.value;
          return `<div class="signal-item"><div><strong>${escapeHtml(kind)}</strong><p>${escapeHtml(typeof value === "string" ? value : JSON.stringify(value) ?? "—")}</p></div><div class="signal-side"><span class="pill ${signalStatus === "active" ? "success" : ""}">${escapeHtml(signalStatus)}</span><small>${confidence !== undefined ? `conf. ${Math.round(confidence*100)}%` : ""} · ${escapeHtml(source)}</small></div></div>`;
        }).join("")
      : '<div class="slot-empty"><span>✓</span><p>سیگنال فعالی پیدا نشد.</p></div>';
    meta.textContent = `${items.length} signal`;
    localStorage.setItem(STORAGE.business, subjectType === "business" ? subject : (localStorage.getItem(STORAGE.business) ?? ""));
  } catch (error) {
    meta.textContent = "خطا";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن trust signals ناموفق بود.")}</p></div>`;
  }
}

async function rebuildTrustReputation(): Promise<void> {
  const targetId = document.querySelector<HTMLInputElement>("#trust-subject")?.value.trim() ?? "";
  const targetType = document.querySelector<HTMLSelectElement>("#trust-subject-type")?.value ?? "";
  const policyVersion = document.querySelector<HTMLInputElement>("#trust-policy")?.value.trim() ?? "";
  const state = document.querySelector<HTMLElement>("#trust-rebuild-state");
  if (!state) return;
  if (!targetId || !policyVersion) { showToast("Target ID و Policy version لازم هستند."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  state.textContent = "در حال بازسازی…";
  state.className = "connection-state";
  try {
    const response = await apiJson<{ data: Record<string, unknown> }>("/api/v1/trust/reputation/rebuild", {
      method: "POST",
      body: { targetType, targetId, policyVersion },
    });
    const score = getRecordNumber(response.data, ["score", "reputationScore"]);
    state.textContent = score !== undefined ? `Reputation بازسازی شد · ${score}` : "Reputation بازسازی شد.";
    state.className = "connection-state success";
    await loadTrustSignals();
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "بازسازی reputation ناموفق بود.";
    state.className = "connection-state error";
  }
}

async function createTrustReview(): Promise<void> {
  const customerId = document.querySelector<HTMLInputElement>("#trust-review-customer")?.value.trim() ?? "";
  const businessId = document.querySelector<HTMLInputElement>("#trust-review-business")?.value.trim() ?? "";
  const ratingValue = Number(document.querySelector<HTMLSelectElement>("#trust-review-rating")?.value ?? "0");
  const content = document.querySelector<HTMLInputElement>("#trust-review-content")?.value.trim() ?? "";
  const state = document.querySelector<HTMLElement>("#trust-review-state");
  if (!state) return;
  if (!customerId || !businessId || !Number.isSafeInteger(ratingValue)) { showToast("Customer، Business و Rating لازم هستند."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  state.textContent = "در حال ثبت review…";
  state.className = "connection-state";
  try {
    const response = await apiJson<{ data: { id: string; moderationState?: string } }>("/api/v1/trust/reviews", {
      method: "POST",
      body: { customerId, businessId, ratingValue, ...(content ? { content } : {}) },
    });
    state.textContent = `Review ساخته شد · ${response.data.id} · ${response.data.moderationState ?? "pending"}`;
    state.className = "connection-state success";
    showToast("Review ثبت شد.");
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "ثبت review ناموفق بود.";
    state.className = "connection-state error";
  }
}

function renderBilling(): string {
  const business = localStorage.getItem(STORAGE.business) ?? "";
  const customer = localStorage.getItem(STORAGE.customer) ?? "";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Billing & Plans</span><h1>هزینه و ارزش را <em>شفاف</em> ببینید.</h1><p>Plans و invoices از Billing canonical خوانده می‌شوند؛ frontend محاسبه مالی انجام نمی‌دهد.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-load-billing>بروزرسانی</button></div>
    </section>
    <section class="billing-grid">
      <article class="glass-card billing-card">
        <div class="card-section-heading"><div><span class="section-kicker">Plans</span><h2>طرح‌های فعال</h2></div><span id="billing-plan-meta">—</span></div>
        <div id="billing-plans" class="plan-list"><div class="slot-empty"><span>◈</span><p>در حال بارگذاری…</p></div></div>
      </article>
      <article class="glass-card billing-card">
        <div class="card-section-heading"><div><span class="section-kicker">Invoices</span><h2>صورتحساب‌ها</h2></div><span id="billing-invoice-meta">—</span></div>
        <div class="billing-filters">
          <input class="studio-input-line" id="billing-business" type="text" value="${escapeAttr(business)}" placeholder="Business ID" />
          <input class="studio-input-line" id="billing-customer" type="text" value="${escapeAttr(customer)}" placeholder="Customer ID" />
        </div>
        <div id="billing-invoices" class="invoice-list"><div class="slot-empty"><span>◫</span><p>برای خواندن invoice، شناسه را وارد کنید.</p></div></div>
      </article>
    </section>
  `;
}

type BillingPlanView = Record<string, unknown>;
type BillingInvoiceView = Record<string, unknown>;

async function loadBillingState(): Promise<void> {
  const plans = document.querySelector<HTMLDivElement>("#billing-plans");
  const invoices = document.querySelector<HTMLDivElement>("#billing-invoices");
  const planMeta = document.querySelector<HTMLElement>("#billing-plan-meta");
  const invoiceMeta = document.querySelector<HTMLElement>("#billing-invoice-meta");
  if (!plans || !invoices || !planMeta || !invoiceMeta) return;

  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }

  plans.innerHTML = '<div class="slot-loading">در حال خواندن plans…</div>';
  try {
    const response = await apiJson<{ data: BillingPlanView[] }>("/api/v1/billing/plans");
    const items = Array.isArray(response.data) ? response.data : [];
    plans.innerHTML = items.length
      ? items.map((plan) => {
          const name = getRecordString(plan, ["name", "displayName", "code"]) ?? "Plan";
          const description = getRecordString(plan, ["description", "summary"]) ?? "طرح Billing";
          const status = getRecordString(plan, ["status"]) ?? "active";
          return `<div class="plan-item"><div><span class="section-kicker">Plan</span><strong>${escapeHtml(name)}</strong><p>${escapeHtml(description)}</p></div><span class="pill ${status === "active" ? "success" : ""}">${escapeHtml(status)}</span></div>`;
        }).join("")
      : '<div class="slot-empty"><span>◈</span><p>Plan فعال پیدا نشد.</p></div>';
    planMeta.textContent = `${items.length} plan`;
  } catch (error) {
    plans.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن plans ناموفق بود.")}</p></div>`;
  }

  await loadBillingInvoices();
}

async function loadBillingInvoices(): Promise<void> {
  const invoices = document.querySelector<HTMLDivElement>("#billing-invoices");
  const meta = document.querySelector<HTMLElement>("#billing-invoice-meta");
  const business = document.querySelector<HTMLInputElement>("#billing-business")?.value.trim() ?? "";
  const customer = document.querySelector<HTMLInputElement>("#billing-customer")?.value.trim() ?? "";
  if (!invoices || !meta) return;
  if (!business && !customer) {
    invoices.innerHTML = '<div class="slot-empty"><span>◫</span><p>Business ID یا Customer ID را وارد کنید.</p></div>';
    meta.textContent = "—";
    return;
  }

  const params = new URLSearchParams({ limit: "50" });
  if (business) params.set("business_id", business);
  if (customer) params.set("customer_id", customer);

  invoices.innerHTML = '<div class="slot-loading">در حال خواندن invoices…</div>';
  try {
    const response = await apiJson<{ data: BillingInvoiceView[] }>(`/api/v1/billing/invoices?${params.toString()}`);
    const items = Array.isArray(response.data) ? response.data : [];
    invoices.innerHTML = items.length
      ? items.map((invoice) => {
          const id = getRecordString(invoice, ["id", "invoiceId"]) ?? "—";
          const status = getRecordString(invoice, ["status"]) ?? "unknown";
          const currency = getRecordString(invoice, ["currency"]) ?? "";
          const total = getRecordNumber(invoice, ["totalMinor", "grandTotalMinor", "amountMinor"]);
          const created = getRecordString(invoice, ["issuedAt", "createdAt"]);
          return `<div class="invoice-item"><div><strong>${escapeHtml(id)}</strong><p>${escapeHtml(status)} · ${escapeHtml(currency)} ${total !== undefined ? formatMinor(total) : "—"}</p></div><small>${escapeHtml(formatDate(created))}</small></div>`;
        }).join("")
      : '<div class="slot-empty"><span>◫</span><p>Invoiceای پیدا نشد.</p></div>';
    meta.textContent = `${items.length} invoice`;
  } catch (error) {
    invoices.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن invoice ناموفق بود.")}</p></div>`;
    meta.textContent = "خطا";
  }
}

function getRecordString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function getRecordNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function formatMinor(value: number): string {
  return (value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderCommunication(): string {
  const recipient = localStorage.getItem(STORAGE.customer) ?? "";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Communication Center</span><h1>پیام درست، <em>در زمان درست.</em></h1><p>ارسال notification و مدیریت preference از قرارداد canonical Communication انجام می‌شود.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-comm-load>بارگذاری وضعیت</button></div>
    </section>
    <section class="communication-grid">
      <article class="glass-card communication-card">
        <div class="card-section-heading"><div><span class="section-kicker">Notification</span><h2>ارسال پیام</h2></div><span id="comm-status" class="pill">آماده</span></div>
        <div class="booking-fields">
          <div><label class="field-label" for="comm-recipient">Recipient Reference</label><input class="studio-input-line" id="comm-recipient" type="text" value="${escapeAttr(recipient)}" placeholder="Customer ID" /></div>
          <div><label class="field-label" for="comm-intent">Intent</label><input class="studio-input-line" id="comm-intent" type="text" value="transaction_update" placeholder="booking.confirmed" /></div>
          <div><label class="field-label" for="comm-channel">Channel</label><select class="studio-input-line" id="comm-channel"><option value="in_app">in_app</option><option value="email">email</option><option value="sms">sms</option><option value="push">push</option><option value="whatsapp">whatsapp</option></select></div>
          <div><label class="field-label" for="comm-priority">Priority</label><select class="studio-input-line" id="comm-priority"><option value="normal">normal</option><option value="low">low</option><option value="high">high</option><option value="urgent">urgent</option></select></div>
          <div class="field-span-2"><label class="field-label" for="comm-locale">Locale <span class="field-optional">اختیاری</span></label><input class="studio-input-line" id="comm-locale" type="text" value="fa-IR" /></div>
        </div>
        <div class="checkout-actions"><button class="button button-primary button-lg" type="button" data-send-notification>ارسال notification <span>→</span></button></div>
        <div id="comm-result" class="connection-state">هنوز ارسالی انجام نشده است.</div>
      </article>
      <article class="glass-card communication-card">
        <div class="card-section-heading"><div><span class="section-kicker">Preferences</span><h2>قواعد ارتباطی</h2></div><span id="comm-pref-meta">—</span></div>
        <div id="comm-preferences" class="preference-list"><div class="slot-empty"><span>◌</span><p>Recipient را وارد کنید.</p></div></div>
        <div class="preference-editor">
          <select class="studio-input-line" id="comm-pref-category"><option value="transactional">transactional</option><option value="security">security</option><option value="marketing">marketing</option><option value="reminders">reminders</option><option value="product_updates">product_updates</option></select>
          <select class="studio-input-line" id="comm-pref-status"><option value="allowed">allowed</option><option value="denied">denied</option></select>
          <select class="studio-input-line" id="comm-pref-channel"><option value="in_app">in_app</option><option value="email">email</option><option value="sms">sms</option><option value="push">push</option><option value="whatsapp">whatsapp</option></select>
          <button class="button button-primary" type="button" data-save-comm-pref>ذخیره</button>
        </div>
      </article>
    </section>
  `;
}

type CommunicationPreferenceView = {
  id?: string;
  recipientReference?: string;
  category?: string;
  channel?: string | null;
  status?: string;
  source?: string;
};

async function loadCommunicationState(): Promise<void> {
  const recipientInput = document.querySelector<HTMLInputElement>("#comm-recipient");
  const host = document.querySelector<HTMLDivElement>("#comm-preferences");
  const meta = document.querySelector<HTMLElement>("#comm-pref-meta");
  const status = document.querySelector<HTMLElement>("#comm-status");
  if (!recipientInput || !host || !meta || !status) return;

  const recipient = recipientInput.value.trim();
  if (!recipient) {
    host.innerHTML = '<div class="slot-empty"><span>◌</span><p>Recipient Reference لازم است.</p></div>';
    meta.textContent = "—";
    return;
  }
  localStorage.setItem(STORAGE.customer, recipient);
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }

  host.innerHTML = '<div class="slot-loading">در حال خواندن preferenceها…</div>';
  try {
    const response = await apiJson<{ data: CommunicationPreferenceView[] }>(
      `/api/v1/communications/preferences?recipientReference=${encodeURIComponent(recipient)}`,
    );
    const items = Array.isArray(response.data) ? response.data : [];
    host.innerHTML = items.length
      ? items.map((item) => `<div class="preference-item"><span>${escapeHtml(item.category ?? "—")}</span><strong>${escapeHtml(item.status ?? "—")} ${item.channel ? "· " + escapeHtml(item.channel) : ""}</strong><small>${escapeHtml(item.source ?? "—")}</small></div>`).join("")
      : '<div class="slot-empty"><span>◌</span><p>Preference ثبت نشده است.</p></div>';
    meta.textContent = `${items.length} preference`;
    status.textContent = "متصل";
    status.className = "pill success";
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن preference ناموفق بود.")}</p></div>`;
  }
}

async function sendCommunicationNotification(): Promise<void> {
  const recipient = document.querySelector<HTMLInputElement>("#comm-recipient")?.value.trim() ?? "";
  const intent = document.querySelector<HTMLInputElement>("#comm-intent")?.value.trim() ?? "";
  const channel = document.querySelector<HTMLSelectElement>("#comm-channel")?.value ?? "";
  const priority = document.querySelector<HTMLSelectElement>("#comm-priority")?.value ?? "";
  const locale = document.querySelector<HTMLInputElement>("#comm-locale")?.value.trim() ?? "";
  const state = document.querySelector<HTMLElement>("#comm-result");
  if (!state) return;
  if (!recipient || !intent || !channel) {
    showToast("Recipient، Intent و Channel الزامی هستند.");
    return;
  }
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }
  state.textContent = "در حال ایجاد notification…";
  state.className = "connection-state";
  try {
    const response = await apiJson<{ data: { id: string; status?: string } }>("/api/v1/communications/notifications", {
      method: "POST",
      body: {
        recipientReference: recipient,
        intent,
        channel,
        priority,
        ...(locale ? { locale } : {}),
      },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    state.textContent = `Notification ساخته شد · ${response.data.id}`;
    state.className = "connection-state success";
    showToast("Notification در Communication قرار گرفت.");
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "ارسال notification ناموفق بود.";
    state.className = "connection-state error";
  }
}

async function saveCommunicationPreference(): Promise<void> {
  const recipient = document.querySelector<HTMLInputElement>("#comm-recipient")?.value.trim() ?? "";
  const category = document.querySelector<HTMLSelectElement>("#comm-pref-category")?.value ?? "";
  const status = document.querySelector<HTMLSelectElement>("#comm-pref-status")?.value ?? "";
  const channel = document.querySelector<HTMLSelectElement>("#comm-pref-channel")?.value ?? "";
  if (!recipient) { showToast("Recipient Reference لازم است."); return; }
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  try {
    await apiJson("/api/v1/communications/preferences", {
      method: "PATCH",
      body: {
        recipientReference: recipient,
        category,
        status,
        channel,
        source: "web",
        effectiveFrom: new Date().toISOString(),
      },
    });
    showToast("Communication preference ذخیره شد.");
    void loadCommunicationState();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "ذخیره preference ناموفق بود.");
  }
}

function renderCustomer(): string {
  const customerId = localStorage.getItem(STORAGE.customer) ?? "";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Customer & CRM</span><h1>رابطه را بشناسید، <em>دوباره ارزش بسازید.</em></h1><p>پروفایل، ترجیحات و timeline مشتری از قراردادهای canonical Customer/CRM خوانده می‌شوند.</p></div>
      <div class="heading-actions">
        <button class="button button-ghost" type="button" data-customer-refresh>بروزرسانی</button>
        <button class="button button-primary" type="button" data-customer-create>${customerId ? "مشتری جدید" : "ایجاد مشتری"}</button>
      </div>
    </section>
    <section class="customer-grid">
      <article class="glass-card customer-profile-card">
        <div class="card-section-heading"><div><span class="section-kicker">Profile</span><h2>پروفایل مشتری</h2></div><span id="customer-status" class="pill">در حال بررسی</span></div>
        <div id="customer-profile" class="customer-profile-body">
          <div class="account-empty"><span>♙</span><p>${customerId ? "در حال خواندن پروفایل…" : "یک Customer ID ایجاد یا ثبت کنید."}</p></div>
        </div>
      </article>
      <article class="glass-card customer-timeline-card">
        <div class="card-section-heading"><div><span class="section-kicker">CRM Timeline</span><h2>آخرین تعاملات</h2></div><span id="customer-history-meta">—</span></div>
        <div id="customer-history" class="timeline-list"><div class="slot-empty"><span>◌</span><p>هنوز timeline خوانده نشده است.</p></div></div>
      </article>
    </section>
    <section class="customer-grid customer-grid-secondary">
      <article class="glass-card customer-profile-card">
        <div class="card-section-heading"><div><span class="section-kicker">Preferences</span><h2>ترجیحات ثبت‌شده</h2></div></div>
        <div id="customer-preferences" class="preference-list"><div class="slot-empty"><span>✦</span><p>ترجیحات بعد از اتصال نمایش داده می‌شوند.</p></div></div>
        <div class="preference-add">
          <input class="studio-input-line" id="customer-pref-key" type="text" placeholder="مثلاً category" />
          <input class="studio-input-line" id="customer-pref-value" type="text" placeholder="مثلاً beauty" />
          <button class="button button-primary" type="button" data-customer-add-pref>ثبت ترجیح</button>
        </div>
      </article>
      <article class="glass-card customer-profile-card">
        <div class="card-section-heading"><div><span class="section-kicker">Context</span><h2>شناسه‌های فعال</h2></div></div>
        <div class="account-details">
          <div class="account-row"><span>Customer ID</span><strong id="customer-id-display">${escapeHtml(customerId || "—")}</strong></div>
          <div class="account-row"><span>Workspace</span><strong>${escapeHtml(localStorage.getItem(STORAGE.workspace) ?? "—")}</strong></div>
          <div class="account-row"><span>Business</span><strong>${escapeHtml(localStorage.getItem(STORAGE.business) ?? "—")}</strong></div>
        </div>
      </article>
    </section>
  `;
}

async function loadCustomerState(): Promise<void> {
  const customerId = localStorage.getItem(STORAGE.customer);
  const status = document.querySelector<HTMLElement>("#customer-status");
  const profile = document.querySelector<HTMLElement>("#customer-profile");
  const history = document.querySelector<HTMLElement>("#customer-history");
  const historyMeta = document.querySelector<HTMLElement>("#customer-history-meta");
  const preferences = document.querySelector<HTMLElement>("#customer-preferences");
  if (!status || !profile || !history || !historyMeta || !preferences) return;

  if (!customerId) {
    status.textContent = "نیازمند Customer";
    status.className = "pill warning";
    profile.innerHTML = '<div class="account-empty"><span>♙</span><p>Customer ID ثبت نشده است. از «ایجاد مشتری» استفاده کنید.</p></div>';
    history.innerHTML = '<div class="slot-empty"><span>◌</span><p>ابتدا Customer ایجاد شود.</p></div>';
    preferences.innerHTML = '<div class="slot-empty"><span>✦</span><p>ابتدا Customer ایجاد شود.</p></div>';
    return;
  }

  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    status.textContent = "بدون session";
    status.className = "pill warning";
    profile.innerHTML = '<div class="account-empty"><span>!</span><p>برای خواندن Customer باید session متصل باشد.</p></div>';
    return;
  }

  profile.innerHTML = '<div class="slot-loading">در حال خواندن Customer profile…</div>';
  history.innerHTML = '<div class="slot-loading">در حال خواندن timeline…</div>';
  preferences.innerHTML = '<div class="slot-loading">در حال خواندن ترجیحات…</div>';

  try {
    const [profileResponse, historyResponse, preferenceResponse] = await Promise.all([
      apiJson<{ data: { customer: CustomerRecordView; preferences: CustomerPreferenceView[]; addresses: CustomerAddressView[] } }>(
        `/api/v1/customers/${encodeURIComponent(customerId)}/profile`,
      ),
      apiJson<{ data: CustomerHistoryView[] }>(
        `/api/v1/customers/${encodeURIComponent(customerId)}/history?limit=20`,
      ),
      apiJson<{ data: CustomerPreferenceView[] }>(
        `/api/v1/customers/${encodeURIComponent(customerId)}/preferences`,
      ),
    ]);

    const customer = profileResponse.data.customer;
    status.textContent = customer.status ?? "active";
    status.className = customer.status === "active" ? "pill success" : "pill warning";
    profile.innerHTML = `
      <div class="customer-identity">
        <div class="customer-avatar">♙</div>
        <div><span class="section-kicker">Customer</span><h3>${escapeHtml(customer.id)}</h3><p>${escapeHtml(customer.locale ?? "locale unset")} · ${escapeHtml(customer.timezone ?? "timezone unset")}</p></div>
      </div>
      <div class="account-details">
        <div class="account-row"><span>Created</span><strong>${escapeHtml(formatDate(customer.createdAt))}</strong></div>
        <div class="account-row"><span>User</span><strong>${escapeHtml(customer.userId ?? "—")}</strong></div>
        <div class="account-row"><span>Addresses</span><strong>${profileResponse.data.addresses.length}</strong></div>
      </div>`;

    const timeline = historyResponse.data ?? [];
    history.innerHTML = timeline.length
      ? timeline.map((event) => `
        <div class="timeline-item">
          <span class="timeline-dot"></span>
          <div><strong>${escapeHtml(event.eventType ?? event.type ?? "event")}</strong><p>${escapeHtml(event.summary ?? event.description ?? stringifyTimelinePayload(event.payload))}</p><small>${escapeHtml(formatDate(event.occurredAt ?? event.createdAt))} · ${escapeHtml(event.sourceModule ?? "crm")}</small></div>
        </div>`).join("")
      : '<div class="slot-empty"><span>◌</span><p>timeline خالی است.</p></div>';
    historyMeta.textContent = `${timeline.length} رویداد`;

    const pref = preferenceResponse.data ?? profileResponse.data.preferences ?? [];
    preferences.innerHTML = pref.length
      ? pref.map((item) => `<div class="preference-item"><span>${escapeHtml(item.attribute)}</span><strong>${escapeHtml(item.valueReference)}</strong><small>${escapeHtml(item.source)}</small></div>`).join("")
      : '<div class="slot-empty"><span>✦</span><p>هنوز ترجیحی ثبت نشده است.</p></div>';
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    const message = error instanceof Error ? error.message : "خواندن Customer ناموفق بود.";
    profile.innerHTML = `<div class="account-empty"><span>!</span><p>${escapeHtml(message)}</p></div>`;
    history.innerHTML = '<div class="slot-empty"><span>!</span><p>timeline در دسترس نیست.</p></div>';
    historyMeta.textContent = "خطا";
  }
}

type CustomerRecordView = {
  id: string;
  userId?: string | null;
  status?: string | null;
  locale?: string | null;
  timezone?: string | null;
  createdAt: string;
};

type CustomerPreferenceView = {
  attribute: string;
  valueReference: string;
  source: string;
  confidence?: number;
  persistence?: string;
};

type CustomerAddressView = { id: string; formatted?: string | null };

type CustomerHistoryView = {
  eventType?: string | null;
  type?: string | null;
  summary?: string | null;
  description?: string | null;
  sourceModule?: string | null;
  payload?: Record<string, unknown> | null;
  occurredAt?: string | null;
  createdAt?: string;
};

function stringifyTimelinePayload(payload?: Record<string, unknown> | null): string {
  if (!payload) return "تعامل ثبت‌شده در CRM";
  try {
    const compact = JSON.stringify(payload);
    return compact && compact.length > 180 ? compact.slice(0, 177) + "…" : compact || "تعامل ثبت‌شده در CRM";
  } catch {
    return "تعامل ثبت‌شده در CRM";
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function openCustomerCreatePanel(): void {
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    showToast("ابتدا session را متصل کنید.");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "connection-overlay";
  overlay.innerHTML = `
    <div class="connection-backdrop" data-close-customer></div>
    <section class="connection-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="customer-create-title">
      <button class="connection-close" type="button" data-close-customer aria-label="بستن">×</button>
      <span class="eyebrow"><i></i> Customer Setup</span>
      <h2 id="customer-create-title">Customer جدید</h2>
      <p>این موجودیت مستقیماً از Customer canonical ساخته می‌شود.</p>
      <label class="field-label" for="customer-locale">Locale <span class="field-optional">اختیاری</span></label>
      <input id="customer-locale" class="studio-input-line" type="text" placeholder="fa-IR" value="fa-IR" />
      <label class="field-label" for="customer-timezone">Timezone <span class="field-optional">اختیاری</span></label>
      <input id="customer-timezone" class="studio-input-line" type="text" placeholder="Asia/Baku" value="Asia/Baku" />
      <div id="customer-create-state" class="connection-state">وضعیت: آماده</div>
      <div class="connection-actions">
        <button class="button button-ghost" type="button" data-close-customer>لغو</button>
        <button class="button button-primary" type="button" data-submit-customer>ایجاد Customer</button>
      </div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLElement>("[data-close-customer]").forEach((node) => node.addEventListener("click", () => overlay.remove()));
  overlay.querySelector<HTMLButtonElement>("[data-submit-customer]")?.addEventListener("click", async () => {
    const locale = overlay.querySelector<HTMLInputElement>("#customer-locale")?.value.trim() ?? "";
    const timezone = overlay.querySelector<HTMLInputElement>("#customer-timezone")?.value.trim() ?? "";
    const state = overlay.querySelector<HTMLElement>("#customer-create-state");
    if (!state) return;
    state.textContent = "در حال ایجاد…";
    try {
      const response = await apiJson<{ data: { id: string } }>("/api/v1/customers", {
        method: "POST",
        body: { ...(locale ? { locale } : {}), ...(timezone ? { timezone } : {}) },
      });
      localStorage.setItem(STORAGE.customer, response.data.id);
      state.textContent = "Customer ساخته شد.";
      state.className = "connection-state success";
      showToast("Customer ساخته شد.");
      window.setTimeout(() => {
        overlay.remove();
        render();
      }, 600);
    } catch (error) {
      state.textContent = error instanceof Error ? error.message : "ساخت Customer ناموفق بود.";
      state.className = "connection-state error";
    }
  });
}

async function addCustomerPreference(): Promise<void> {
  const customerId = localStorage.getItem(STORAGE.customer);
  const key = document.querySelector<HTMLInputElement>("#customer-pref-key")?.value.trim() ?? "";
  const value = document.querySelector<HTMLInputElement>("#customer-pref-value")?.value.trim() ?? "";
  if (!customerId) { showToast("ابتدا Customer ایجاد کنید."); return; }
  if (!key || !value) { showToast("کلید و مقدار ترجیح الزامی است."); return; }
  try {
    await apiJson(`/api/v1/customers/${encodeURIComponent(customerId)}/preferences`, {
      method: "POST",
      body: { attribute: key, valueReference: value, source: "web", confidence: 1, persistence: "persistent" },
    });
    showToast("ترجیح ثبت شد.");
    void loadCustomerState();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "ثبت ترجیح ناموفق بود.");
  }
}

function renderAccount(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Account & Session</span><h1>کنترل اتصال و <em>فضای کاری</em> شما.</h1><p>وضعیت session و context مستقیماً از runtime ققنوس خوانده می‌شود.</p></div>
      <button class="button button-primary" type="button" data-refresh-account>بروزرسانی وضعیت</button>
    </section>
    <section class="account-grid">
      <article class="glass-card account-card">
        <div class="card-section-heading"><div><span class="section-kicker">Session</span><h2>وضعیت احراز</h2></div><span id="account-status" class="pill">در حال بررسی</span></div>
        <div id="account-details" class="account-details">
          <div class="account-row"><span>Actor</span><strong>—</strong></div>
          <div class="account-row"><span>Tenant</span><strong>—</strong></div>
          <div class="account-row"><span>Workspace</span><strong>—</strong></div>
        </div>
        <div class="account-actions">
          <button class="button button-ghost" type="button" data-account-connect>تنظیم اتصال</button>
          <button class="button button-danger" type="button" data-account-revoke>خروج از session</button>
        </div>
      </article>
      <article class="glass-card account-card">
        <span class="section-kicker">Runtime Context</span>
        <h2>مجوزهای فعال</h2>
        <div id="account-permissions" class="permission-cloud"><span class="permission-empty">برای مشاهده مجوزها به session متصل شوید.</span></div>
      </article>
    </section>
  `;
}

async function loadAccountState(): Promise<void> {
  const status = document.querySelector<HTMLElement>("#account-status");
  const details = document.querySelector<HTMLElement>("#account-details");
  const permissions = document.querySelector<HTMLElement>("#account-permissions");
  if (!status || !details || !permissions) return;

  try {
    const [session, context] = await Promise.all([
      apiJson<{ session: { authenticated: boolean; actorId?: string; tenantId?: string; workspaceId?: string } }>("/api/v1/session"),
      apiJson<{ authenticated: boolean; actorId?: string; tenantId?: string; workspaceId?: string; permissions?: string[] }>("/api/v1/context"),
    ]);

    status.textContent = session.session.authenticated ? "متصل" : "احراز نشده";
    status.className = session.session.authenticated ? "pill success" : "pill warning";
    details.innerHTML = `
      <div class="account-row"><span>Actor</span><strong>${escapeHtml(context.actorId ?? session.session.actorId ?? "—")}</strong></div>
      <div class="account-row"><span>Tenant</span><strong>${escapeHtml(context.tenantId ?? session.session.tenantId ?? "—")}</strong></div>
      <div class="account-row"><span>Workspace</span><strong>${escapeHtml(context.workspaceId ?? session.session.workspaceId ?? "—")}</strong></div>`;
    const permissionList = context.permissions ?? [];
    permissions.innerHTML = permissionList.length
      ? permissionList.map((permission) => `<span class="permission-chip">${escapeHtml(permission)}</span>`).join("")
      : '<span class="permission-empty">مجوزی در context فعلی برنگشت.</span>';
  } catch (error) {
    status.textContent = "متصل نیست";
    status.className = "pill warning";
    const message = error instanceof Error ? error.message : "session در دسترس نیست.";
    details.innerHTML = `<div class="account-empty"><span>!</span><p>${escapeHtml(message)}</p></div>`;
    permissions.innerHTML = '<span class="permission-empty">ابتدا اتصال را تنظیم کنید.</span>';
  }
}

async function revokeCurrentSession(): Promise<void> {
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    showToast("session فعالی در مرورگر ثبت نشده است.");
    return;
  }
  try {
    await apiJson<{ revoked: boolean }>("/api/v1/session/revoke", { method: "POST" });
    sessionStorage.removeItem(STORAGE.accessToken);
    showToast("session با موفقیت خارج شد.");
    render();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "خروج از session ناموفق بود.");
  }
}

function renderDiscover(): string {
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q") ?? "";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Discovery</span><h1>چیزی را که می‌خواهید، <em>پیدا کنید.</em></h1><p>جست‌وجو بر اساس نیاز، زمینه و عرضه واقعی ققنوس.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-toast="فیلترها به‌زودی به Discovery اضافه می‌شوند.">فیلترها</button></div>
    </section>
    <section class="discover-search glass-card">
      <div class="search-main"><span>⌕</span><input id="discover-query" type="search" autocomplete="off" value="${escapeAttr(initialQuery)}" placeholder="مثلاً یک کافه آرام برای جلسه عصر..." /></div>
      <button class="button button-primary" type="button" data-run-discovery>کشف کن <span>→</span></button>
    </section>
    <div class="discover-layout">
      <div class="results-column">
        <div class="results-header"><strong id="results-title">پیشنهادهای امروز</strong><span id="results-meta">نمونه نمایشی</span></div>
        <div id="discovery-results" class="results-grid">${renderResultCards(demoBusinesses)}</div>
      </div>
      <aside class="insight-card glass-card">
        <div class="insight-icon">✦</div>
        <span class="section-kicker">هوش ققنوس</span>
        <h3>به‌جای رتبه ساده، زمینه را هم می‌بینیم.</h3>
        <p>در نسخه زنده، Discovery از موجودیت‌های مجاز، مکان، اعتماد، دسترسی و سیگنال‌های matching برای ساخت نتایج استفاده می‌کند.</p>
        <div class="insight-list"><span>✓ چندمعیاره</span><span>✓ tenant-aware</span><span>✓ قابل ردیابی</span></div>
      </aside>
    </div>
  `;
}

function renderResultCards(items: DiscoveryResult[]): string {
  activeDiscoveryItems = items;
  return items.map((item,index) => {
    const title = escapeHtml(item.title ?? item.displayName ?? item.name ?? "مورد قابل کشف");
    const description = escapeHtml(item.description ?? item.body ?? "یک موجودیت قابل کشف از شبکه ققنوس.");
    const locality = escapeHtml(item.locality ?? item.city ?? "در فضای کاری شما");
    const score = item.score ?? 0;
    const rating = item.rating;
    const sourceType = escapeHtml(item.sourceType ?? "resource");
    const key = item.id ?? item.sourceId ?? "";
    const shortlisted = getShortlist().some((entry) => (entry.id ?? entry.sourceId) === key && Boolean(key));
    return `
      <button class="result-card result-card-button${shortlisted ? " shortlisted" : ""}" type="button" data-discovery-index="${index}" aria-label="${title}">
        <div class="result-art result-${index % 3}"><span>${["ک","س","ب"][index % 3]}</span></div>
        <div class="result-content">
          <div class="result-head"><span class="tiny-status">● eligible</span><span class="score-chip">${score ? String(Math.round(score)) : "—"} <small>score</small></span></div>
          <h3>${title}</h3>
          <p>${description}</p>
          <div class="result-meta"><span>⌖ ${locality}</span><span>◈ ${sourceType}</span>${rating !== undefined && rating !== null ? `<span>★ ${Number(rating).toFixed(1)}</span>` : ""}</div>
          ${shortlisted ? '<span class="result-shortlist-badge">✓ در فهرست انتخابی</span>' : ""}
        </div>
      </button>`;
  }).join("");
}

function openDiscoveryResultPanel(item: DiscoveryResult): void {
  const title = item.title ?? item.displayName ?? item.name ?? "مورد قابل کشف";
  const body = item.body ?? item.description ?? "توضیحی برای این projection ثبت نشده است.";
  const metadataEntries = Object.entries(item.metadata ?? {}).slice(0, 8);
  const overlay = document.createElement("div");
  overlay.className = "connection-overlay";
  overlay.innerHTML = `
    <div class="connection-backdrop" data-close-discovery></div>
    <section class="connection-modal glass-card discovery-detail-modal" role="dialog" aria-modal="true" aria-labelledby="discovery-detail-title">
      <button class="connection-close" type="button" data-close-discovery aria-label="بستن">×</button>
      <span class="eyebrow"><i></i> Discovery Projection</span>
      <h2 id="discovery-detail-title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      <div class="discovery-detail-grid">
        <div><span>Source type</span><strong>${escapeHtml(item.sourceType ?? "—")}</strong></div>
        <div><span>Source ID</span><strong>${escapeHtml(item.sourceId ?? "—")}</strong></div>
        <div><span>Document version</span><strong>${item.documentVersion ?? "—"}</strong></div>
        <div><span>Score</span><strong>${item.score ?? "—"}</strong></div>
      </div>
      ${metadataEntries.length ? `<div class="metadata-cloud">${metadataEntries.map(([key,value]) => `<span><b>${escapeHtml(key)}</b> ${escapeHtml(String(value))}</span>`).join("")}</div>` : ""}
      <div class="connection-actions">
        <button class="button button-primary" type="button" data-open-booking-from-discovery>بررسی رزرو</button>
        <button class="button button-ghost" type="button" data-toggle-shortlist>انتخاب برای مقایسه</button>
        <button class="button button-ghost" type="button" data-close-discovery>بستن</button>
      </div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLElement>("[data-close-discovery]").forEach((node) => node.addEventListener("click", () => overlay.remove()));
  overlay.querySelector<HTMLButtonElement>("[data-open-booking-from-discovery]")?.addEventListener("click", () => {
    overlay.remove();
    navigate("/booking");
  });
  overlay.querySelector<HTMLButtonElement>("[data-toggle-shortlist]")?.addEventListener("click", () => {
    toggleShortlist(item);
    renderShortlist();
  });
}

function renderCheckout(): string {
  const params = new URLSearchParams(location.search);
  const product = params.get("product") ?? "";
  const entity = params.get("entity") ?? "";
  const resource = product || entity;
  const resourceType: "product_variant" | "offering" | "service" = product ? "product_variant" : entity ? "offering" : params.get("type") === "service" ? "service" : "product_variant";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Commerce</span><h1>از انتخاب تا <em>Checkout</em> بدون پرش.</h1><p>این سطح فقط orchestration می‌کند؛ cart و checkout state از Commerce canonical می‌آیند.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-account-connect>تنظیم اتصال</button></div>
    </section>
    <section class="checkout-grid">
      <article class="glass-card checkout-panel">
        <div class="card-section-heading"><div><span class="section-kicker">Cart</span><h2>شروع سبد خرید</h2></div><span id="checkout-status" class="pill">آماده</span></div>
        <div class="booking-fields">
          <div><label class="field-label" for="checkout-currency">Currency</label><input class="studio-input-line" id="checkout-currency" type="text" value="USD" maxlength="8" /></div>
          <div><label class="field-label" for="checkout-customer">Customer ID <span class="field-optional">اختیاری</span></label><input class="studio-input-line" id="checkout-customer" type="text" placeholder="Customer ID" /></div>
          <div><label class="field-label" for="checkout-resource-type">Resource type</label><select class="studio-input-line" id="checkout-resource-type"><option value="product_variant" ${resourceType === "product_variant" ? "selected" : ""}>product_variant</option><option value="offering" ${resourceType === "offering" ? "selected" : ""}>offering</option><option value="service" ${resourceType === "service" ? "selected" : ""}>service</option></select></div>
          <div><label class="field-label" for="checkout-resource">Resource ID</label><input class="studio-input-line" id="checkout-resource" type="text" value="${escapeAttr(resource)}" placeholder="Product / offering ID" /></div>
          <div><label class="field-label" for="checkout-quantity">Quantity</label><input class="studio-input-line" id="checkout-quantity" type="number" min="1" step="1" value="1" /></div>
        </div>
        <div class="checkout-actions"><button class="button button-primary button-lg" type="button" data-start-checkout>ساخت Cart و شروع Checkout <span>→</span></button></div>
      </article>
      <article class="glass-card checkout-result">
        <div class="card-section-heading"><div><span class="section-kicker">Live state</span><h2>وضعیت Checkout</h2></div></div>
        <div id="checkout-result-body" class="checkout-result-body"><div class="slot-empty"><span>◫</span><p>اطلاعات checkout بعد از اجرای جریان نمایش داده می‌شود.</p></div></div>
      </article>
    </section>
  `;
}

async function startCheckoutFlow(): Promise<void> {
  const currency = document.querySelector<HTMLInputElement>("#checkout-currency")?.value.trim() ?? "";
  const customerId = document.querySelector<HTMLInputElement>("#checkout-customer")?.value.trim() ?? "";
  const resourceType = document.querySelector<HTMLSelectElement>("#checkout-resource-type")?.value ?? "";
  const resourceId = document.querySelector<HTMLInputElement>("#checkout-resource")?.value.trim() ?? "";
  const quantity = Number(document.querySelector<HTMLInputElement>("#checkout-quantity")?.value ?? "0");
  const status = document.querySelector<HTMLElement>("#checkout-status");
  const result = document.querySelector<HTMLDivElement>("#checkout-result-body");
  if (!status || !result) return;

  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    showToast("برای شروع Checkout باید session متصل باشد.");
    return;
  }
  if (!currency || !resourceId || !Number.isSafeInteger(quantity) || quantity < 1) {
    showToast("Currency، Resource ID و Quantity معتبر لازم است.");
    return;
  }

  status.textContent = "در حال اجرا";
  status.className = "pill warning";
  result.innerHTML = '<div class="slot-loading">در حال ساخت Cart و Checkout…</div>';

  try {
    const cartResponse = await apiJson<{ data: { id: string; status: string; currency: string } }>("/api/v1/commerce/carts", {
      method: "POST",
      body: { currency, ...(customerId ? { customerId } : {}) },
    });
    const cartId = cartResponse.data.id;
    await apiJson<{ data: { id: string } }>(`/api/v1/commerce/carts/${encodeURIComponent(cartId)}/lines`, {
      method: "POST",
      body: { resourceType, resourceId, quantity },
    });
    const checkoutResponse = await apiJson<{ data: { id: string; cartId: string; status: string; startedAt?: string } }>("/api/v1/commerce/checkout", {
      method: "POST",
      body: { cartId },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    status.textContent = checkoutResponse.data.status;
    status.className = "pill success";
    result.innerHTML = `
      <div class="checkout-success">
        <div class="draft-orb">✓</div>
        <span class="section-kicker">Checkout session</span>
        <h3>${escapeHtml(checkoutResponse.data.id)}</h3>
        <div class="account-row"><span>Cart</span><strong>${escapeHtml(cartId)}</strong></div>
        <div class="account-row"><span>Status</span><strong>${escapeHtml(checkoutResponse.data.status)}</strong></div>
        <p>Checkout canonical ساخته شد. پرداخت و fulfillment در لایه‌های تخصصی خودشان ادامه پیدا می‌کنند.</p>
      </div>`;
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    result.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "Checkout ناموفق بود.")}</p></div>`;
  }
}
function renderBusiness(): string {
  const businessId = localStorage.getItem(STORAGE.business) ?? "";
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Business Workspace</span><h1>کسب‌وکارتان را <em>قابل کشف</em> کنید.</h1><p>پروفایل، مکان‌ها، ساعات، تماس‌ها و وضعیت انتشار مستقیماً از Business canonical خوانده می‌شوند.</p></div>
      <div class="heading-actions">
        <button class="button button-ghost" type="button" data-business-create>ساخت کسب‌وکار</button>
        <button class="button button-ghost" type="button" data-business-refresh>بروزرسانی</button>
        <a class="button button-primary" href="/product-studio" data-nav>ساخت محصول با AI <span>✦</span></a>
      </div>
    </section>

    <section class="business-grid">
      <article class="glass-card business-main">
        <div class="card-section-heading"><div><span class="section-kicker">Profile</span><h2>پروفایل کسب‌وکار</h2></div><span id="business-management-status" class="pill">در حال بررسی</span></div>
        <div id="business-profile-content" class="business-profile-content"><div class="slot-empty"><span>▦</span><p>${businessId ? "در حال خواندن پروفایل…" : "یک Business ID برای مدیریت این فضای کاری ثبت کنید."}</p></div></div>
        <div class="business-management-form">
          <input id="business-name-input" class="studio-input-line" placeholder="نام canonical" />
          <input id="business-display-name-input" class="studio-input-line" placeholder="نام نمایشی" />
          <input id="business-type-input" class="studio-input-line" placeholder="نوع کسب‌وکار" />
          <input id="business-timezone-input" class="studio-input-line" placeholder="Timezone" />
          <input id="business-currency-input" class="studio-input-line" placeholder="Currency" />
          <button class="button button-primary" type="button" data-business-save>${businessId ? "ذخیره پروفایل" : "ابتدا Business بسازید"}</button>
        </div>
      </article>

      <article class="glass-card ai-action-card">
        <span class="ai-badge">AI COPILOT</span>
        <h2>عرضه را سریع‌تر غنی کنید.</h2>
        <p>Seller AI می‌تواند از متن و تصویر خام، پیش‌نویس محصول بسازد؛ Catalog و publication همچنان canonical باقی می‌مانند.</p>
        <a class="button button-primary" href="/product-studio" data-nav>باز کردن Product Studio <span>→</span></a>
      </article>
    </section>

    <section class="business-detail-grid">
      <article class="glass-card business-detail-card">
        <div class="card-section-heading"><div><span class="section-kicker">Locations</span><h2>مکان‌ها</h2></div><button class="button button-ghost" type="button" data-business-add-location>افزودن مکان</button></div>
        <div id="business-locations" class="business-location-list"><div class="slot-empty"><span>⌖</span><p>داده مکان بعد از اتصال نمایش داده می‌شود.</p></div></div>
      </article>
      <article class="glass-card business-detail-card">
        <div class="card-section-heading"><div><span class="section-kicker">Availability Context</span><h2>ساعات فعال</h2></div></div>
        <div id="business-hours" class="business-hours-list"><div class="slot-empty"><span>◷</span><p>ساعات بعد از اتصال نمایش داده می‌شوند.</p></div></div>
      </article>
      <article class="glass-card business-detail-card">
        <div class="card-section-heading"><div><span class="section-kicker">Contacts</span><h2>راه‌های تماس</h2></div></div>
        <div id="business-contacts" class="metadata-cloud"><span>—</span></div>
      </article>
      <article class="glass-card business-detail-card">
        <div class="card-section-heading"><div><span class="section-kicker">Publication</span><h2>وضعیت انتشار</h2></div><span id="business-publication-status" class="pill">—</span></div>
        <div id="business-publication-detail" class="connection-state">—</div>
      </article>
    </section>
  `;
}


async function loadBusinessAccess(): Promise<void> {
  const status = document.querySelector<HTMLElement>("#business-management-status");
  const profile = document.querySelector<HTMLElement>("#business-profile-content");
  const locations = document.querySelector<HTMLElement>("#business-locations");
  const hours = document.querySelector<HTMLElement>("#business-hours");
  const contacts = document.querySelector<HTMLElement>("#business-contacts");
  const publication = document.querySelector<HTMLElement>("#business-publication-status");
  const publicationDetail = document.querySelector<HTMLElement>("#business-publication-detail");
  if (!status || !profile || !locations || !hours || !contacts || !publication || !publicationDetail) return;
  const businessId = localStorage.getItem(STORAGE.business);
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    status.textContent = "بدون session";
    status.className = "pill warning";
    return;
  }
  if (!businessId) {
    status.textContent = "Business لازم است";
    status.className = "pill warning";
    profile.innerHTML = '<div class="slot-empty"><span>▦</span><p>Business ID ثبت نشده است.</p></div>';
    return;
  }
  status.textContent = "در حال بارگذاری";
  status.className = "pill";
  profile.innerHTML = '<div class="slot-loading">در حال خواندن Business…</div>';
  locations.innerHTML = '<div class="slot-loading">در حال خواندن Locations…</div>';
  hours.innerHTML = '<div class="slot-loading">در حال خواندن Hours…</div>';
  try {
    const response = await apiJson<{ data: { business: Record<string, unknown>; locations: Array<Record<string, unknown>>; hours: Array<Record<string, unknown>>; contacts: Array<Record<string, unknown>>; socialLinks: Array<Record<string, unknown>> } }>(
      `/api/v1/businesses/${encodeURIComponent(businessId)}/management`,
    );
    const business = response.data.business;
    const locationsData = response.data.locations ?? [];
    const hoursData = response.data.hours ?? [];
    const contactsData = response.data.contacts ?? [];
    profile.innerHTML = `
      <div class="business-profile-grid">
        <div><span>نام</span><strong>${escapeHtml(getRecordString(business, ["name"]) ?? "—")}</strong></div>
        <div><span>نام نمایشی</span><strong>${escapeHtml(getRecordString(business, ["displayName"]) ?? "—")}</strong></div>
        <div><span>وضعیت</span><strong>${escapeHtml(getRecordString(business, ["status"]) ?? "—")}</strong></div>
        <div><span>Locale</span><strong>${escapeHtml(getRecordString(business, ["defaultLocale"]) ?? "—")}</strong></div>
        <div><span>Timezone</span><strong>${escapeHtml(getRecordString(business, ["timezone"]) ?? "—")}</strong></div>
        <div><span>Currency</span><strong>${escapeHtml(getRecordString(business, ["defaultCurrency"]) ?? "—")}</strong></div>
      </div>`;
    const setInput=(selector:string,key:string)=>{const input=document.querySelector<HTMLInputElement>(selector); if(input) input.value=getRecordString(business,[key])??"";};
    setInput("#business-name-input","name");
    setInput("#business-display-name-input","displayName");
    setInput("#business-type-input","businessType");
    setInput("#business-timezone-input","timezone");
    setInput("#business-currency-input","defaultCurrency");
    locations.innerHTML = locationsData.length ? locationsData.map((item)=>`
      <div class="business-location-item">
        <div><strong>${escapeHtml(getRecordString(item,["name"])??"Location")}</strong><small>${escapeHtml(getRecordString(item,["locationType"])??"—")} · ${escapeHtml(getRecordString(item,["timezone"])??"—")}</small></div>
        <span class="pill ${getRecordString(item,["status"])==="active"?"success": "warning"}">${escapeHtml(getRecordString(item,["status"])??"—")}</span>
      </div>`).join("") : '<div class="slot-empty"><span>⌖</span><p>هنوز مکانی ثبت نشده است.</p></div>';
    hours.innerHTML = hoursData.length ? hoursData.map((item)=>`<div class="business-hour-item"><span>${escapeHtml(String(item.dayOfWeek ?? "—"))}</span><strong>${escapeHtml(String(item.opens ?? "—"))} — ${escapeHtml(String(item.closes ?? "—"))}</strong><small>${escapeHtml(String(item.timezone ?? "—"))}</small></div>`).join("") : '<div class="slot-empty"><span>◷</span><p>ساعت فعالی ثبت نشده است.</p></div>';
    contacts.innerHTML = contactsData.length ? contactsData.map((item)=>`<span><b>${escapeHtml(getRecordString(item,["contactType"])??"contact")}</b> ${escapeHtml(getRecordString(item,["value"])??"—")}</span>`).join("") : '<span>تماس عمومی ثبت نشده است.</span>';
    const publicationValue=getRecordString(business,["publicationStatus"])??"unpublished";
    publication.textContent=publicationValue;
    publication.className=publicationValue==="published"?"pill success":"pill warning";
    publicationDetail.textContent=publicationValue==="published"?"این کسب‌وکار منتشر است.":"انتشار هنوز از policy canonical عبور نکرده است.";
    status.textContent="Connected";
    status.className="pill success";
  } catch (error) {
    status.textContent="خطا";
    status.className="pill warning";
    const message=error instanceof Error?error.message:"خواندن Business ناموفق بود.";
    profile.innerHTML=`<div class="slot-empty"><span>!</span><p>${escapeHtml(message)}</p></div>`;
    locations.innerHTML='<div class="slot-empty"><span>!</span><p>Locations در دسترس نیست.</p></div>';
    hours.innerHTML='<div class="slot-empty"><span>!</span><p>Hours در دسترس نیست.</p></div>';
  }
}


  const status = document.querySelector<HTMLElement>("#business-access-status");
  const workspace = document.querySelector<HTMLElement>("#business-workspace-short");
  const note = document.querySelector<HTMLElement>("#business-access-note");
  if (!status || !workspace || !note) return;
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    status.textContent = "بدون session";
    status.className = "pill warning";
    note.textContent = "اتصال لازم است";
    return;
  }
  try {
    const response = await apiJson<{ status: string; tenantId?: string; workspaceId?: string }>("/api/v1/business-access");
    status.textContent = response.status === "authorized" ? "مجاز" : response.status;
    status.className = response.status === "authorized" ? "pill success" : "pill warning";
    workspace.textContent = compactId(response.workspaceId);
    note.textContent = response.tenantId ? `tenant · ${compactId(response.tenantId)}` : "workspace context فعال";
  } catch (error) {
    status.textContent = "خطا";
    status.className = "pill warning";
    note.textContent = error instanceof Error ? error.message : "دسترسی workspace خوانده نشد.";
  }
}

function compactId(value?: string): string {
  if (!value) return "—";
  return value.length > 12 ? value.slice(0, 6) + "…" + value.slice(-4) : value;
}

async function saveBusinessProfile(): Promise<void> {
  const id=localStorage.getItem(STORAGE.business);
  if(!id){showToast("Business ID لازم است.");return;}
  const name=document.querySelector<HTMLInputElement>("#business-name-input")?.value.trim()??"";
  const displayName=document.querySelector<HTMLInputElement>("#business-display-name-input")?.value.trim()??"";
  if(!name||!displayName){showToast("نام و نام نمایشی الزامی است.");return;}
  try{
    await apiJson(`/api/v1/businesses/${encodeURIComponent(id)}`,{method:"PATCH",body:{
      name,displayName,
      businessType:document.querySelector<HTMLInputElement>("#business-type-input")?.value.trim()||undefined,
      timezone:document.querySelector<HTMLInputElement>("#business-timezone-input")?.value.trim()||undefined,
      defaultCurrency:document.querySelector<HTMLInputElement>("#business-currency-input")?.value.trim()||undefined,
    }});
    showToast("پروفایل Business ذخیره شد.");
    await loadBusinessAccess();
  }catch(error){showToast(error instanceof Error?error.message:"ذخیره Business ناموفق بود.");}
}

function openBusinessLocationPanel(): void {
  const businessId=localStorage.getItem(STORAGE.business);
  if(!businessId){showToast("ابتدا Business ID را ثبت کنید.");return;}
  openSimpleFormDialog("افزودن مکان","Business Location",[
    {id:"location-name",label:"نام مکان",placeholder:"مثلاً شعبه مرکزی",value:""},
    {id:"location-timezone",label:"Timezone",placeholder:"Asia/Tehran",value:""},
    {id:"location-type",label:"نوع",placeholder:"physical",value:"physical"},
    {id:"location-address",label:"آدرس JSON",placeholder:'{"city":"..."}',value:""},
    {id:"location-lat",label:"Latitude",placeholder:"35.7",value:""},
    {id:"location-lng",label:"Longitude",placeholder:"51.4",value:""},
  ],async(dialog)=>{
    const name=dialog.querySelector<HTMLInputElement>("#location-name")?.value.trim()??"";
    const type=dialog.querySelector<HTMLInputElement>("#location-type")?.value.trim()||"physical";
    const timezone=dialog.querySelector<HTMLInputElement>("#location-timezone")?.value.trim()||undefined;
    const lat=Number(dialog.querySelector<HTMLInputElement>("#location-lat")?.value);
    const lng=Number(dialog.querySelector<HTMLInputElement>("#location-lng")?.value);
    const addressRaw=dialog.querySelector<HTMLInputElement>("#location-address")?.value.trim()??"";
    let address:Record<string,unknown>|undefined;
    if(addressRaw){try{const parsed=JSON.parse(addressRaw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("آدرس باید JSON object باشد.");address=parsed as Record<string,unknown>}catch(error){showToast(error instanceof Error?error.message:"JSON آدرس نامعتبر است.");return false;}}
    const geoPoint=Number.isFinite(lat)&&Number.isFinite(lng)?{latitude:lat,longitude:lng}:undefined;
    try{
      await apiJson(`/api/v1/businesses/${encodeURIComponent(businessId)}/locations`,{method:"POST",body:{name,locationType:type, ...(timezone?{timezone}:{}), ...(address?{address}:{}), ...(geoPoint?{geoPoint}:{}),}});
      dialog.remove(); showToast("Location ساخته شد."); await loadBusinessAccess(); return true;
    }catch(error){showToast(error instanceof Error?error.message:"ساخت Location ناموفق بود.");return false;}
  });
}

function openSimpleFormDialog(title:string,kicker:string,fields:Array<{id:string;label:string;placeholder:string;value:string}>,onSubmit:(dialog:HTMLElement)=>Promise<boolean>|boolean):void{
  const overlay=document.createElement("div");
  overlay.className="connection-overlay";
  overlay.innerHTML=`<div class="connection-backdrop" data-close-simple></div><section class="connection-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="simple-form-title"><button class="connection-close" type="button" data-close-simple aria-label="بستن">×</button><span class="eyebrow"><i></i> ${escapeHtml(kicker)}</span><h2 id="simple-form-title">${escapeHtml(title)}</h2><div class="control-form">${fields.map(field=>`<label class="field-label" for="${escapeAttr(field.id)}">${escapeHtml(field.label)}<input id="${escapeAttr(field.id)}" class="studio-input-line" value="${escapeAttr(field.value)}" placeholder="${escapeAttr(field.placeholder)}" /></label>`).join("")}</div><div class="connection-actions"><button class="button button-ghost" type="button" data-close-simple>لغو</button><button class="button button-primary" type="button" data-submit-simple>ذخیره</button></div></section>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLElement>("[data-close-simple]").forEach(node=>node.addEventListener("click",()=>overlay.remove()));
  overlay.querySelector<HTMLButtonElement>("[data-submit-simple]")?.addEventListener("click",async()=>{
    const ok=await onSubmit(overlay);
    if(ok) overlay.remove();
  });
}

async function loadHomeState(): Promise<void> {
  const setText = (selector: string, value: string): void => {
    const node = document.querySelector<HTMLElement>(selector);
    if (node) node.textContent = value;
  };
  const setProgress = (selector: string, value: number): void => {
    const node = document.querySelector<HTMLElement>(selector);
    if (node) node.style.width = Math.max(0, Math.min(100, value)) + "%";
  };
  const recent = getSavedSearches();
  const latestDiscovery = readStorageRecord<{ count: number; at: string }>("phoenix-last-discovery");
  const latestAi = readStorageRecord<{ units: string; at: string }>("phoenix-last-ai-usage");

  setText("#home-demand-count", String(recent.length));
  setText("#home-demand-value", String(recent.length));
  setText("#home-demand-insight", recent.length ? String(recent.length) + " جست‌وجوی اخیر ثبت شده است" : "هنوز نیاز قابل ردیابی ثبت نشده");
  setText("#home-demand-note", latestDiscovery ? "آخرین کشف: " + String(latestDiscovery.count) + " نتیجه" : "جست‌وجوی اخیر");
  setText("#home-matching-value", latestDiscovery ? String(latestDiscovery.count) : "—");
  setText("#home-matching-insight", latestDiscovery ? "آخرین Discovery: " + formatDate(latestDiscovery.at) : "پس از Discovery واقعی");
  setText("#home-live-time", new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(new Date()));
  if (latestAi) {
    setText("#home-ai-usage", latestAi.units);
    setText("#home-ai-note", "آخرین اجرا: " + formatDate(latestAi.at));
  }

  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    setText("#home-live-status", "Offline UI");
    setText("#home-live-question", "برای context زنده، یک session ققنوس متصل کنید.");
    setText("#home-business-status", "—");
    setText("#home-business-note", "session متصل نیست");
    return;
  }

  try {
    const context = await apiJson<{ tenantId?: string; workspaceId?: string }>("/api/v1/context");
    setText("#home-live-status", "متصل");
    setText("#home-business-status", context.workspaceId ? "Connected" : "—");
    setText("#home-business-note", context.tenantId ? "Tenant · " + compactId(context.tenantId) : "Business context");
    setText("#home-live-question", context.workspaceId ? "Workspace معتبر و tenant-scoped فعال است." : "Workspace context موجود نیست.");
    setProgress("#home-business-progress", context.workspaceId ? 100 : 0);
    setText("#home-business-detail", context.workspaceId ? "Context معتبر و آمادهٔ عملیات است." : "برای Supply به Workspace نیاز است");

    if (localStorage.getItem(STORAGE.business)) {
      try {
        const access = await apiJson<{ status: string }>("/api/v1/business-access");
        const ok = access.status === "authorized";
        setText("#home-business-status", ok ? "Ready" : "Blocked");
        setText("#home-business-badge", ok ? "● آماده" : "● نیازمند توجه");
        setText("#home-business-detail", ok ? "Business management قابل استفاده است." : "Business access قابل استفاده نیست.");
        setProgress("#home-business-progress", ok ? 100 : 20);
      } catch {
        setText("#home-business-status", "Unknown");
        setText("#home-business-note", "Business access خوانده نشد");
      }
    }
  } catch (error) {
    setText("#home-live-status", "نیازمند توجه");
    setText("#home-live-question", error instanceof Error ? error.message : "context زنده در دسترس نیست.");
  }
}

function readStorageRecord<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as T : null;
  } catch {
    return null;
  }
}

function renderProductStudio(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Seller AI Studio</span><h1>محصول را بده؛ <em>بقیه‌اش با ققنوس.</em></h1><p>متن خام، تصویر یا توضیح آزاد را به یک پیش‌نویس محصول قابل بازبینی تبدیل کن.</p></div>
      <span class="billing-note">هر اجرای AI مصرف‌محور است.</span>
    </section>

    <section class="studio-grid">
      <article class="glass-card studio-input">
        <div class="studio-tabs"><button class="studio-tab active" type="button">ورودی</button><button class="studio-tab" type="button">تصویر</button></div>
        <div class="studio-meta-fields">
          <div>
            <label class="field-label" for="studio-business">شناسه کسب‌وکار</label>
            <input id="studio-business" class="studio-input-line" type="text" autocomplete="off" placeholder="Business ID" value="${escapeAttr(localStorage.getItem(STORAGE.business) ?? "")}" />
          </div>
          <div>
            <label class="field-label" for="studio-workspace">Workspace ID</label>
            <input id="studio-workspace" class="studio-input-line" type="text" autocomplete="off" placeholder="Workspace ID" value="${escapeAttr(localStorage.getItem(STORAGE.workspace) ?? "")}" />
          </div>
        </div>
        <label class="field-label" for="studio-text">توضیح محصول</label>
        <textarea id="studio-text" rows="7" placeholder="مثلاً: کفش چرمی دست‌دوز، رنگ قهوه‌ای، مناسب استفاده روزمره..."></textarea>
        <label class="media-dropzone" for="studio-file">
          <input id="studio-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic" />
          <span class="media-drop-icon">＋</span>
          <span><strong>عکس محصول را اینجا اضافه کنید</strong><small>JPG / PNG / WebP · حداکثر 10MB</small></span>
          <span id="studio-file-name" class="media-file-name">بدون تصویر</span>
        </label>
        <div class="studio-actions">
          <span class="field-hint">ورودی می‌تواند ناقص باشد؛ ققنوس سؤال‌های ضروری را مشخص می‌کند.</span>
          <button class="button button-primary" type="button" data-generate-draft>ساخت پیش‌نویس <span>✦</span></button>
        </div>
      </article>

      <article class="glass-card studio-preview">
        <div class="preview-top"><span class="section-kicker">پیش‌نمایش زنده</span><span class="pill" id="studio-status">آماده</span></div>
        <div id="studio-draft" class="draft-empty"><div class="draft-orb">✦</div><strong>هنوز پیش‌نویسی ساخته نشده</strong><p>یک ورودی کوتاه بنویس و اجازه بده ققنوس ساختار، متن و فیلدهای لازم را پیشنهاد کند.</p></div>
      </article>
    </section>

    <section class="studio-flow">
      ${["ورودی فروشنده","درک و استخراج","غنی‌سازی","بازبینی","انتشار"].map((step,i)=>`<div class="studio-step ${i===0 ? "active" : ""}"><span>0${i+1}</span><div><strong>${step}</strong><small>${["خام و آزاد","ساختارمند کردن داده","پیشنهاد بهتر","کنترل انسانی","ورود به Catalog"][i]}</small></div></div>`).join("")}
    </section>
  `;
}

function bindDiscoveryResultEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-discovery-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.discoveryIndex);
      const item = Number.isInteger(index) ? activeDiscoveryItems[index] : undefined;
      if (item) openDiscoveryResultPanel(item);
    });
  });
}

function openCommandPalette(): void {
  const existing = document.querySelector(".command-overlay");
  if (existing) {
    existing.querySelector<HTMLInputElement>("#global-command-input")?.focus();
    return;
  }

  const items = routes.map((route) => ({
    path: route.path,
    label: route.label,
    icon: route.icon,
  }));
  const overlay = document.createElement("div");
  overlay.className = "command-overlay";
  overlay.innerHTML = `
    <div class="command-backdrop" data-close-command></div>
    <section class="command-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="global-command-title">
      <div class="command-modal-head">
        <div>
          <span class="section-kicker">Phoenix Command</span>
          <h2 id="global-command-title">کجا می‌خواهید بروید؟</h2>
        </div>
        <button class="icon-button" type="button" data-close-command aria-label="بستن">×</button>
      </div>
      <div class="command-search-row">
        <span>⌕</span>
        <input id="global-command-input" class="command-modal-input" autocomplete="off" placeholder="جست‌وجوی بخش‌ها، ابزارها و صفحات…" />
        <kbd>Esc</kbd>
      </div>
      <div id="global-command-results" class="command-results"></div>
      <div class="command-hint"><span>↑↓ انتخاب</span><span>Enter باز کردن</span><span>/ جست‌وجوی سریع</span></div>
    </section>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>("#global-command-input");
  const results = overlay.querySelector<HTMLElement>("#global-command-results");
  let selected = 0;

  const renderResults = (): void => {
    const query = input?.value.trim().toLocaleLowerCase("fa") ?? "";
    const filtered = items.filter((item) => !query || (item.label + " " + item.path).toLocaleLowerCase("fa").includes(query));
    selected = Math.min(selected, Math.max(0, filtered.length - 1));
    if (!results) return;
    results.innerHTML = filtered.length
      ? filtered.map((item, index) => `<button type="button" class="command-result ${index === selected ? "selected" : ""}" data-command-path="${escapeAttr(item.path)}"><span class="command-result-icon">${escapeHtml(item.icon)}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.path)}</small></span><b>↵</b></button>`).join("")
      : '<div class="command-no-results">نتیجه‌ای پیدا نشد.</div>';
    results.querySelectorAll<HTMLButtonElement>("[data-command-path]").forEach((button) => button.addEventListener("click", () => {
      const path = button.dataset.commandPath ?? "/";
      overlay.remove();
      navigate(path);
    }));
  };

  const close = (): void => overlay.remove();
  overlay.querySelectorAll<HTMLElement>("[data-close-command]").forEach((node) => node.addEventListener("click", close));
  input?.addEventListener("input", () => { selected = 0; renderResults(); });
  input?.addEventListener("keydown", (event) => {
    const query = input.value.trim().toLocaleLowerCase("fa");
    const filtered = items.filter((item) => !query || (item.label + " " + item.path).toLocaleLowerCase("fa").includes(query));
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); selected = Math.min(selected + 1, Math.max(0, filtered.length - 1)); renderResults(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); selected = Math.max(selected - 1, 0); renderResults(); }
    else if (event.key === "Enter" && filtered[selected]) { event.preventDefault(); const path = filtered[selected]!.path; close(); navigate(path); }
  });
  renderResults();
  window.requestAnimationFrame(() => input?.focus());
}

function bindGlobalEvents(): void {
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const href = element.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      event.preventDefault();
      navigate(href);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-nav-click]").forEach((element) => {
    element.addEventListener("click", () => navigate(element.dataset.navClick ?? "/"));
  });

  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((element) => element.addEventListener("click", toggleTheme));

  document.querySelectorAll<HTMLElement>("[data-toast]").forEach((element) => {
    element.addEventListener("click", () => showToast(element.dataset.toast ?? "انجام شد."));
  });

  document.querySelectorAll<HTMLElement>("[data-coming-soon]").forEach((element) => {
    element.addEventListener("click", () => showToast(`${element.dataset.comingSoon ?? "این بخش"} در حال آماده‌سازی است.`));
  });

  document.querySelector<HTMLElement>("[data-focus-search]")?.addEventListener("click", () => {
    openCommandPalette();
  });

  document.querySelectorAll<HTMLElement>("[data-workspace-toggle]").forEach((node) => node.addEventListener("click", openWorkspaceSwitcher));
  document.querySelectorAll<HTMLElement>("[data-notification-toggle]").forEach((node) => node.addEventListener("click", openNotificationCenter));

  document.querySelector<HTMLElement>("[data-profile-toggle]")?.addEventListener("click", openConnectionPanel);
  document.querySelector<HTMLButtonElement>("[data-business-create]")?.addEventListener("click", openBusinessCreatePanel);
  document.querySelector<HTMLButtonElement>("[data-business-refresh]")?.addEventListener("click", () => { void loadBusinessAccess(); });
  document.querySelector<HTMLButtonElement>("[data-business-save]")?.addEventListener("click", () => { void saveBusinessProfile(); });
  document.querySelector<HTMLButtonElement>("[data-business-add-location]")?.addEventListener("click", openBusinessLocationPanel);
  document.querySelector<HTMLButtonElement>("[data-refresh-account]")?.addEventListener("click", loadAccountState);
  document.querySelector<HTMLButtonElement>("[data-account-connect]")?.addEventListener("click", openConnectionPanel);
  document.querySelector<HTMLButtonElement>("[data-account-revoke]")?.addEventListener("click", revokeCurrentSession);
  document.querySelector<HTMLButtonElement>("[data-customer-refresh]")?.addEventListener("click", loadCustomerState);
  document.querySelector<HTMLButtonElement>("[data-customer-create]")?.addEventListener("click", openCustomerCreatePanel);
  document.querySelector<HTMLButtonElement>("[data-customer-add-pref]")?.addEventListener("click", addCustomerPreference);
  document.querySelector<HTMLButtonElement>("[data-comm-load]")?.addEventListener("click", loadCommunicationState);
  document.querySelector<HTMLButtonElement>("[data-send-notification]")?.addEventListener("click", sendCommunicationNotification);
  document.querySelector<HTMLButtonElement>("[data-save-comm-pref]")?.addEventListener("click", saveCommunicationPreference);
  document.querySelector<HTMLButtonElement>("[data-load-billing]")?.addEventListener("click", loadBillingState);
  document.querySelectorAll<HTMLButtonElement>("[data-trust-load]")?.forEach((button) => button.addEventListener("click", loadTrustSignals));
  document.querySelector<HTMLButtonElement>("[data-trust-rebuild]")?.addEventListener("click", rebuildTrustReputation);
  document.querySelector<HTMLButtonElement>("[data-trust-create-review]")?.addEventListener("click", createTrustReview);
  document.querySelector<HTMLButtonElement>("[data-ops-refresh]")?.addEventListener("click", () => { void loadCases(); });
  document.querySelector<HTMLButtonElement>("[data-load-cases]")?.addEventListener("click", () => { void loadCases(); });
  document.querySelector<HTMLButtonElement>("[data-load-fulfillment]")?.addEventListener("click", () => { void loadFulfillment(); });
  document.querySelector<HTMLButtonElement>("[data-seo-audit]")?.addEventListener("click", () => { void runSeoAudit(); });
  document.querySelector<HTMLButtonElement>("[data-seo-crawl]")?.addEventListener("click", () => { void runSeoProductionCrawl(); });
  document.querySelector<HTMLButtonElement>("[data-seo-visibility]")?.addEventListener("click", () => { void runSeoVisibilityMeasurement(); });
  document.querySelector<HTMLButtonElement>("[data-seo-competitive]")?.addEventListener("click", () => { void loadSeoCompetitiveIntelligence(); });
  document.querySelector<HTMLButtonElement>("[data-seo-health]")?.addEventListener("click", () => { void loadSeoHealth(); });
  document.querySelector<HTMLElement>("[data-control-connect]")?.addEventListener("click", openConnectionPanel);
  document.querySelector<HTMLButtonElement>("[data-approval-create]")?.addEventListener("click", () => { void createApprovalRequest(); });
  document.querySelector<HTMLButtonElement>("[data-approval-approve]")?.addEventListener("click", () => { void decideApproval("approve"); });
  document.querySelector<HTMLButtonElement>("[data-approval-reject]")?.addEventListener("click", () => { void decideApproval("reject"); });
  document.querySelector<HTMLButtonElement>("[data-auto-create]")?.addEventListener("click", () => { void createAutomationWorkflow(); });
  document.querySelector<HTMLButtonElement>("[data-integration-connect]")?.addEventListener("click", () => { void connectIntegrationAccount(); });
  document.querySelector<HTMLButtonElement>("[data-privacy-consent]")?.addEventListener("click", () => { void grantPrivacyConsent(); });
  document.querySelector<HTMLButtonElement>("[data-privacy-request]")?.addEventListener("click", () => { void createPrivacyRequest(); });
  document.querySelector<HTMLButtonElement>("[data-catalog-create]")?.addEventListener("click", () => { void createCatalogProduct(); });
  document.querySelector<HTMLButtonElement>("[data-promo-create]")?.addEventListener("click", () => { void createPromotion(); });
  document.querySelector<HTMLButtonElement>("[data-promo-version]")?.addEventListener("click", () => { void createPromotionVersion(); });
  document.querySelector<HTMLButtonElement>("[data-promo-activate]")?.addEventListener("click", () => { void activatePromotion(); });
  document.querySelector<HTMLButtonElement>("[data-promo-evaluate]")?.addEventListener("click", () => { void evaluatePromotion(); });
  document.querySelector<HTMLButtonElement>("[data-loyalty-create]")?.addEventListener("click", () => { void createLoyaltyProgram(); });
  document.querySelector<HTMLButtonElement>("[data-loyalty-enroll]")?.addEventListener("click", () => { void enrollLoyaltyMember(); });
  document.querySelector<HTMLButtonElement>("[data-loyalty-ledger]")?.addEventListener("click", () => { void postLoyaltyLedger(); });
  document.querySelector<HTMLButtonElement>("[data-ad-account]")?.addEventListener("click", () => { void createAdvertisingAccount(); });
  document.querySelector<HTMLButtonElement>("[data-ad-campaign]")?.addEventListener("click", () => { void createAdvertisingCampaign(); });
  document.querySelector<HTMLButtonElement>("[data-ad-version]")?.addEventListener("click", () => { void createAdvertisingVersion(); });
  document.querySelector<HTMLButtonElement>("[data-ad-activate]")?.addEventListener("click", () => { void activateAdvertisingCampaign(); });
  document.querySelector<HTMLButtonElement>("[data-ad-create]")?.addEventListener("click", () => { void createAdvertisingAd(); });
  document.querySelector<HTMLButtonElement>("[data-ad-delivery]")?.addEventListener("click", () => { void recordAdvertisingDelivery(); });
  document.querySelector<HTMLButtonElement>("[data-ad-report]")?.addEventListener("click", () => { void loadAdvertisingReport(); });
  document.querySelector<HTMLButtonElement>("[data-ad-impression]")?.addEventListener("click", () => { void recordAdvertisingImpression(); });
  document.querySelector<HTMLButtonElement>("[data-ad-click]")?.addEventListener("click", () => { void recordAdvertisingClick(); });
  document.querySelector<HTMLInputElement>("#billing-business")?.addEventListener("keydown", (event) => { if (event.key === "Enter") void loadBillingInvoices(); });
  document.querySelector<HTMLInputElement>("#billing-customer")?.addEventListener("keydown", (event) => { if (event.key === "Enter") void loadBillingInvoices(); });

  document.querySelector<HTMLButtonElement>("[data-run-discovery]")?.addEventListener("click", runDiscovery);
  document.querySelector<HTMLInputElement>("#discover-query")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runDiscovery();
  });

  document.querySelector<HTMLButtonElement>("[data-load-slots]")?.addEventListener("click", loadBookingSlots);
  document.querySelector<HTMLButtonElement>("[data-start-checkout]")?.addEventListener("click", startCheckoutFlow);

  document.querySelector<HTMLButtonElement>("[data-generate-draft]")?.addEventListener("click", generateDraft);
  document.querySelector<HTMLInputElement>("#studio-file")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    const name = document.querySelector<HTMLElement>("#studio-file-name");
    if (name) name.textContent = file ? `${file.name} · ${Math.round(file.size / 1024)}KB` : "بدون تصویر";
    const preview = document.querySelector<HTMLImageElement>("#studio-image-preview");
    if (preview) {
      if (studioPreviewUrl) URL.revokeObjectURL(studioPreviewUrl);
      if (file) {
        studioPreviewUrl = URL.createObjectURL(file);
        preview.src = studioPreviewUrl;
        preview.hidden = false;
      } else {
        preview.removeAttribute("src");
        preview.hidden = true;
        studioPreviewUrl = undefined;
      }
    }
  });
  document.querySelectorAll<HTMLButtonElement>("[data-open-connection]").forEach((button) => button.addEventListener("click", openConnectionPanel));
  document.querySelector<HTMLButtonElement>("[data-confirm-seller-draft]")?.addEventListener("click", confirmSellerDraft);
  document.querySelector<HTMLButtonElement>("[data-cancel-seller-draft]")?.addEventListener("click", cancelSellerDraft);
  document.querySelector<HTMLButtonElement>("[data-admin-refresh]")?.addEventListener("click", loadAdminState);

  // Keyboard shortcut is registered once at module load.
}

function handleGlobalShortcut(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName ?? "";
  if (event.key === "Escape") {
    document.querySelector<HTMLElement>("[data-close-command]")?.click();
    return;
  }
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
    event.preventDefault();
    openCommandPalette();
  }
}

async function runDiscovery(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#discover-query");
  const resultHost = document.querySelector<HTMLDivElement>("#discovery-results");
  const meta = document.querySelector<HTMLElement>("#results-meta");
  if (!input || !resultHost || !meta) return;

  const query = input.value.trim();
  if (!query) {
    showToast("یک نیاز یا عبارت جست‌وجو وارد کن.");
    input.focus();
    return;
  }

  resultHost.innerHTML = renderSkeletonCards(3);
  meta.textContent = "در حال تحلیل…";

  try {
    const params = new URLSearchParams({ q: query, limit: "9" });
    const data = await apiJson<{ data: DiscoveryResult[] }>(`/api/v1/discovery/search?${params.toString()}`);
    const items = Array.isArray(data.data) ? data.data : [];
    if (items.length === 0) {
      resultHost.innerHTML = renderResultCards(demoBusinesses);
      meta.textContent = "نمونه جایگزین؛ داده‌ای از API برنگشت";
      showToast("نتیجه‌ای از Discovery برنگشت؛ نتایج نمونه نمایش داده شدند.");
      bindDiscoveryResultEvents();
      return;
    }
    resultHost.innerHTML = renderResultCards(items);
    meta.textContent = `${items.length} نتیجه`;
    bindDiscoveryResultEvents();
  } catch (error) {
    resultHost.innerHTML = renderResultCards(demoBusinesses);
    meta.textContent = "Demo mode";
    showToast(error instanceof Error ? error.message : "اتصال به Discovery برقرار نشد؛ حالت نمایشی فعال شد.");
    bindDiscoveryResultEvents();
  }
}

function renderSkeletonCards(count: number): string {
  return Array.from({ length: count }, () => '<article class="result-card skeleton-card"><div class="skeleton skeleton-art"></div><div class="result-content"><div class="skeleton line short"></div><div class="skeleton line long"></div><div class="skeleton line medium"></div><div class="skeleton line short"></div></div></article>').join("");
}

async function uploadSellerMedia(file: File, businessId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("فایل انتخاب‌شده تصویر نیست.");
  if (file.size > 10 * 1024 * 1024) throw new Error("حجم تصویر باید کمتر از 10MB باشد.");
  const form = new FormData();
  form.set("file", file);
  form.set("ownerType", "business");
  form.set("ownerId", businessId);
  form.set("metadata", JSON.stringify({ source: "seller-product-studio", originalName: file.name }));
  const response = await apiFormData<{ data: { id: string; storageKey?: string; status?: string } }>("/api/v1/media/assets", form);
  return response.data.id;
}

async function generateDraft(): Promise<void> {
  const input = document.querySelector<HTMLTextAreaElement>("#studio-text");
  const draft = document.querySelector<HTMLDivElement>("#studio-draft");
  const status = document.querySelector<HTMLElement>("#studio-status");
  const businessInput = document.querySelector<HTMLInputElement>("#studio-business");
  const workspaceInput = document.querySelector<HTMLInputElement>("#studio-workspace");
  if (!input || !draft || !status || !businessInput || !workspaceInput) return;

  const text = input.value.trim();
  const file = document.querySelector<HTMLInputElement>("#studio-file")?.files?.[0] ?? null;
  const businessId = businessInput.value.trim();
  const workspaceId = workspaceInput.value.trim();

  if (!text && !file) {
    showToast("توضیح یا تصویر محصول لازم است.");
    input.focus();
    return;
  }

  if (!businessId) {
    showToast("شناسه کسب‌وکار را وارد کن.");
    businessInput.focus();
    return;
  }

  if (!workspaceId) {
    showToast("برای اجرای Seller AI، Workspace ID لازم است.");
    workspaceInput.focus();
    return;
  }

  localStorage.setItem(STORAGE.business, businessId);
  localStorage.setItem(STORAGE.workspace, workspaceId);

  const token = sessionStorage.getItem(STORAGE.accessToken);
  if (!token) {
    openConnectionPanel();
    showToast("ابتدا access token را در اتصال ققنوس ثبت کن.");
    return;
  }

  status.textContent = "در حال اتصال";
  status.className = "pill warning";
  draft.innerHTML = renderDraftSkeleton();

  try {
    const sessionResponse = await apiJson<{ session: { id: string } }>("/api/v1/ai/seller/product-creation-sessions", {
      method: "POST",
      body: { businessId },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });

    const sessionId = sessionResponse.session.id;
    const mediaAssetId = file ? await uploadSellerMedia(file, businessId) : undefined;

    if (!text && !mediaAssetId) throw new Error("Seller AI input is empty.");
    await apiJson<{ accepted: boolean }>(`/api/v1/ai/seller/product-creation-sessions/${encodeURIComponent(sessionId)}/inputs`, {
      method: "POST",
      body: {
        ...(text ? { rawText: text } : {}),
        ...(mediaAssetId ? { mediaAssetId } : {}),
      },
    });

    const result = await apiJson<{ data: SellerRunResult }>(
      `/api/v1/ai/seller/product-creation-sessions/${encodeURIComponent(sessionId)}/run`,
      {
        method: "POST",
        body: {
          input: { ...(text ? { rawText: text } : {}), ...(mediaAssetId ? { mediaAssetId } : {}) },
          dataClassification: "internal",
          promptVersion: "seller-product-v1",
          outputSchemaVersion: "seller-product-draft-v1",
          policyVersion: "seller-product-policy-v1",
        },
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    );

    if (result.data.status === "succeeded") {
      const sessionState = await apiJson<{ session: { id: string; currentDraftVersion: number }; draft: unknown }>(
        `/api/v1/ai/seller/product-creation-sessions/${encodeURIComponent(sessionId)}`,
      );
      if (result.data.usage || result.data.cost) {
        localStorage.setItem("phoenix-last-ai-usage", JSON.stringify({ units: String(result.data.usage?.providerUnits ?? ((result.data.usage?.inputTokens ?? 0) + (result.data.usage?.outputTokens ?? 0)) || "—"), at: new Date().toISOString() }));
      }
      draft.dataset.sessionId = sessionId;
      draft.dataset.draftVersion = String(sessionState.session.currentDraftVersion);
      draft.innerHTML = renderRemoteDraft(result.data, sessionId, sessionState.session.currentDraftVersion);
      status.textContent = "پیش‌نویس آماده";
      status.className = "pill success";
      bindGlobalEvents();
    } else {
      draft.innerHTML = renderRemotePending(result.data.status, result.data.error);
      status.textContent = result.data.retryable ? "نیازمند تلاش مجدد" : "بررسی لازم";
      status.className = "pill warning";
    }
    bindGlobalEvents();
  } catch (error) {
    const message = error instanceof Error ? error.message : "اجرای Seller AI ناموفق بود.";
    draft.innerHTML = `
      <div class="draft-empty">
        <div class="draft-orb">!</div>
        <strong>اجرای واقعی تکمیل نشد</strong>
        <p>${escapeHtml(message)}</p>
        <button class="button button-primary" type="button" data-open-connection>بررسی اتصال</button>
      </div>`;
    status.textContent = "خطا";
    status.className = "pill warning";
    bindGlobalEvents();
  }
}

type SellerRunResult = {
  status: string;
  retryable?: boolean;
  error?: string | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    imageUnits?: number;
    providerUnits?: number;
  } | null;
  cost?: {
    estimatedProviderCost?: number;
    costCurrency?: string;
    inputUnits?: number;
    outputUnits?: number;
  } | null;
  output?: {
    product?: Record<string, unknown>;
  } | null;
};

function renderRemoteDraft(result: SellerRunResult, sessionId: string, version: number): string {
  const product = result.output?.product ?? {};
  const name = stringField(product, "name") ?? stringField(product, "title") ?? "محصول پیشنهادی";
  const description = stringField(product, "description") ?? "پیش‌نویس توسط Seller AI تولید شد.";
  const category = stringField(product, "category") ?? "نیازمند بررسی";
  return `
    <div class="draft-ready">
      <div class="draft-preview-art"><span>AI</span></div>
      <div class="draft-copy">
        <span class="section-kicker">پیش‌نویس واقعی · نسخه ${version}</span>
        <h2>${escapeHtml(name)}</h2>
        <p>${escapeHtml(description)}</p>
        <div class="draft-fields">
          <span><b>دسته</b> ${escapeHtml(category)}</span>
          <span><b>وضعیت</b> آماده بازبینی</span>
          <span><b>Session</b> ${escapeHtml(sessionId)}</span>
        </div>
        ${result.usage || result.cost ? `
          <div class="ai-usage-strip">
            <span><b>مصرف</b> ${escapeHtml(String(result.usage?.providerUnits ?? ((result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0)) || "—"))}</span>
            <span><b>ورودی</b> ${escapeHtml(String(result.usage?.inputTokens ?? "—"))}</span>
            <span><b>خروجی</b> ${escapeHtml(String(result.usage?.outputTokens ?? "—"))}</span>
            <span><b>هزینه داخلی</b> ${result.cost?.estimatedProviderCost !== undefined ? escapeHtml(String(result.cost.estimatedProviderCost)) + " " + escapeHtml(result.cost.costCurrency ?? "USD") : "ثبت شد"}</span>
          </div>` : ""}
        <div class="draft-actions">
          <button class="button button-primary" type="button" data-confirm-seller-draft>بازبینی و ساخت محصول</button>
          <button class="button button-ghost" type="button" data-cancel-seller-draft>لغو session</button>
        </div>
        <div id="seller-confirm-state" class="connection-state">نسخه ${version} برای بازبینی آماده است.</div><div id="seller-confirm-state" class="connection-state">نسخه ${version} برای بازبینی آماده است.</div><div id="seller-publication-controls" class="seller-publication-controls"></div>
      </div>
    </div>`;
}

async function confirmSellerDraft(): Promise<void> {
  const draft = document.querySelector<HTMLElement>("#studio-draft");
  const state = document.querySelector<HTMLElement>("#seller-confirm-state");
  if (!draft || !state) return;
  const sessionId = draft.dataset.sessionId;
  const version = Number(draft.dataset.draftVersion);
  if (!sessionId || !Number.isSafeInteger(version) || version < 1) {
    showToast("اطلاعات نسخه Seller AI در UI موجود نیست.");
    return;
  }

  const button = document.querySelector<HTMLButtonElement>("[data-confirm-seller-draft]");
  if (button) button.disabled = true;
  state.textContent = "در حال ثبت بازبینی…";
  state.className = "connection-state";

  try {
    await apiJson<{ reviewed: boolean }>(
      `/api/v1/ai/seller/product-creation-sessions/${encodeURIComponent(sessionId)}/review`,
      { method: "POST", body: { version } },
    );
    state.textContent = "بازبینی ثبت شد؛ در حال ساخت محصول در Catalog…";

    const response = await apiJson<{ confirmed: boolean; catalogSaved: boolean; catalogProductId?: string; version: number }>(
      `/api/v1/ai/seller/product-creation-sessions/${encodeURIComponent(sessionId)}/confirm`,
      { method: "POST", body: { version } },
    );

    if (!response.confirmed || !response.catalogSaved) throw new Error("Catalog linkage was not confirmed.");
    state.textContent = `محصول Catalog ساخته شد · ${response.catalogProductId ?? "ID unavailable"}`;
    state.className = "connection-state success";
    if (response.catalogProductId) {
      draft.dataset.catalogProductId = response.catalogProductId;
      renderSellerPublicationControls(draft, response.catalogProductId);
    }
    showToast("محصول Seller AI به Catalog متصل شد.");
    if (button) button.textContent = "محصول ساخته شد";
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "تأیید Seller AI ناموفق بود.";
    state.className = "connection-state error";
    if (button) button.disabled = false;
  }
}

function renderSellerPublicationControls(container: HTMLElement, productId: string): void {
  const host = container.querySelector<HTMLElement>("#seller-publication-controls");
  if (!host) return;
  host.innerHTML = `
    <div class="publication-mini-card">
      <div class="card-section-heading"><div><span class="section-kicker">Publication</span><strong>Listing انتشار</strong></div><span class="pill">مرحله بعد</span></div>
      <label class="field-label" for="seller-offer-title">عنوان Listing</label>
      <input id="seller-offer-title" class="studio-input-line" value="محصول ققنوس" placeholder="عنوان قابل نمایش" />
      <p>برای انتشار عمومی، محصول باید به یک Offering canonical متصل شود.</p>
      <div class="engine-actions">
        <button class="button button-primary" type="button" data-create-seller-offer data-product-id="${escapeAttr(productId)}">ساخت Listing</button>
        <button class="button button-ghost" type="button" data-publish-seller-offer disabled>درخواست انتشار</button>
      </div>
      <div id="seller-publication-state" class="connection-state">هنوز Offering ساخته نشده است.</div>
    </div>`;
  host.querySelector<HTMLButtonElement>("[data-create-seller-offer]")?.addEventListener("click", () => { void createSellerOffer(); });
  host.querySelector<HTMLButtonElement>("[data-publish-seller-offer]")?.addEventListener("click", () => { void publishSellerOffer(); });
}

async function createSellerOffer(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>("[data-create-seller-offer]");
  const productId = button?.dataset.productId;
  const businessId = localStorage.getItem(STORAGE.business);
  const draft = document.querySelector<HTMLElement>("#studio-draft");
  const state = document.querySelector<HTMLElement>("#seller-publication-state");
  const title = document.querySelector<HTMLInputElement>("#seller-offer-title")?.value.trim() ?? "";
  if (!productId || !businessId || !title || !draft || !state) {
    showToast("Business، Product و عنوان Listing لازم هستند.");
    return;
  }
  button.disabled = true;
  try {
    const response = await apiJson<{ data: { id: string; status: string; publicationStatus: string } }>("/api/v1/catalog/offers", {
      method: "POST",
      body: { businessId, productId, offeringType: "product", title },
    });
    draft.dataset.offeringId = response.data.id;
    state.textContent = "Listing ساخته شد · " + response.data.id;
    state.className = "connection-state success";
    const publish = document.querySelector<HTMLButtonElement>("[data-publish-seller-offer]");
    if (publish) publish.disabled = false;
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "ساخت Listing ناموفق بود.";
    state.className = "connection-state error";
    button.disabled = false;
  }
}

async function publishSellerOffer(): Promise<void> {
  const draft = document.querySelector<HTMLElement>("#studio-draft");
  const state = document.querySelector<HTMLElement>("#seller-publication-state");
  const button = document.querySelector<HTMLButtonElement>("[data-publish-seller-offer]");
  const offeringId = draft?.dataset.offeringId;
  if (!offeringId || !state || !button) return;
  button.disabled = true;
  state.textContent = "در حال ثبت درخواست انتشار…";
  state.className = "connection-state";
  try {
    const response = await apiJson<{ data: { id: string; publicationStatus: string } }>(
      "/api/v1/catalog/offers/" + encodeURIComponent(offeringId) + "/publish",
      { method: "POST" },
    );
    state.textContent = "درخواست انتشار ثبت شد · " + response.data.publicationStatus;
    state.className = "connection-state success";
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : "درخواست انتشار ناموفق بود.";
    state.className = "connection-state error";
    button.disabled = false;
  }
}

async function cancelSellerDraft(): Promise<void> {
  const draft = document.querySelector<HTMLElement>("#studio-draft");
  if (!draft) return;
  const sessionId = draft.dataset.sessionId;
  if (!sessionId) return;
  try {
    await apiJson<{ cancelled: boolean }>(
      `/api/v1/ai/seller/product-creation-sessions/${encodeURIComponent(sessionId)}/cancel`,
      { method: "POST" },
    );
    showToast("Seller AI session لغو شد.");
    draft.innerHTML = '<div class="draft-empty"><div class="draft-orb">×</div><strong>Session لغو شد</strong><p>می‌توانید دوباره یک محصول جدید بسازید.</p></div>';
  } catch (error) {
    showToast(error instanceof Error ? error.message : "لغو session ناموفق بود.");
  }
}


function renderRemotePending(status: string, error?: string | null): string {
  return `
    <div class="draft-empty">
      <div class="draft-orb">…</div>
      <strong>Seller AI در وضعیت ${escapeHtml(status)} است</strong>
      <p>${escapeHtml(error ?? "این عملیات هنوز خروجی نهایی ندارد.")}</p>
    </div>`;
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}


function openBusinessCreatePanel(): void {
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    showToast("ابتدا session را به ققنوس متصل کن.");
    return;
  }
  if (!localStorage.getItem(STORAGE.workspace)) {
    openConnectionPanel();
    showToast("برای ساخت کسب‌وکار Workspace ID لازم است.");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "connection-overlay";
  overlay.innerHTML = `
    <div class="connection-backdrop" data-close-business></div>
    <section class="connection-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="business-create-title">
      <button class="connection-close" type="button" data-close-business aria-label="بستن">×</button>
      <span class="eyebrow"><i></i> Business Setup</span>
      <h2 id="business-create-title">کسب‌وکار جدید بسازید</h2>
      <p>این فرم مستقیماً Business canonical را از طریق API ققنوس ایجاد می‌کند.</p>
      <label class="field-label" for="business-name">نام فنی</label>
      <input id="business-name" class="studio-input-line" type="text" placeholder="my-business" />
      <label class="field-label" for="business-display-name">نام نمایشی</label>
      <input id="business-display-name" class="studio-input-line" type="text" placeholder="کسب‌وکار من" />
      <label class="field-label" for="business-type">نوع کسب‌وکار <span class="field-optional">اختیاری</span></label>
      <input id="business-type" class="studio-input-line" type="text" placeholder="مثلاً beauty" />
      <div id="business-create-state" class="connection-state">وضعیت: آماده</div>
      <div class="connection-actions">
        <button class="button button-ghost" type="button" data-close-business>لغو</button>
        <button class="button button-primary" type="button" data-submit-business>ایجاد کسب‌وکار</button>
      </div>
    </section>`;
  document.body.appendChild(overlay);

  overlay.querySelectorAll<HTMLElement>("[data-close-business]").forEach((node) =>
    node.addEventListener("click", () => overlay.remove()),
  );

  overlay.querySelector<HTMLButtonElement>("[data-submit-business]")?.addEventListener("click", async () => {
    const name = overlay.querySelector<HTMLInputElement>("#business-name")?.value.trim() ?? "";
    const displayName = overlay.querySelector<HTMLInputElement>("#business-display-name")?.value.trim() ?? "";
    const businessType = overlay.querySelector<HTMLInputElement>("#business-type")?.value.trim() ?? "";
    const state = overlay.querySelector<HTMLElement>("#business-create-state");
    if (!state) return;

    if (!name || !displayName) {
      state.textContent = "نام فنی و نام نمایشی الزامی هستند.";
      state.className = "connection-state error";
      return;
    }

    state.textContent = "در حال ایجاد…";
    state.className = "connection-state";

    try {
      const response = await apiJson<{ data: { id: string; name?: string; displayName?: string } }>("/api/v1/businesses", {
        method: "POST",
        body: {
          name,
          displayName,
          ...(businessType ? { businessType } : {}),
        },
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      localStorage.setItem(STORAGE.business, response.data.id);
      state.textContent = "کسب‌وکار با موفقیت ایجاد شد.";
      state.className = "connection-state success";
      showToast("Business ساخته شد و Business ID ذخیره شد.");
      window.setTimeout(() => {
        overlay.remove();
        navigate("/product-studio");
      }, 700);
    } catch (error) {
      state.textContent = error instanceof Error ? error.message : "ساخت کسب‌وکار ناموفق بود.";
      state.className = "connection-state error";
    }
  });
}

function openConnectionPanel(): void {
  const existing = document.querySelector(".connection-overlay");
  if (existing) return;

  const token = sessionStorage.getItem(STORAGE.accessToken) ?? "";
  const workspace = localStorage.getItem(STORAGE.workspace) ?? "";
  const business = localStorage.getItem(STORAGE.business) ?? "";

  const overlay = document.createElement("div");
  overlay.className = "connection-overlay";
  overlay.innerHTML = `
    <div class="connection-backdrop" data-close-connection></div>
    <section class="connection-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="connection-title">
      <button class="connection-close" type="button" data-close-connection aria-label="بستن">×</button>
      <span class="eyebrow"><i></i> Phoenix Connection</span>
      <h2 id="connection-title">اتصال به فضای کاری</h2>
      <p>Frontend منطق احراز هویت جداگانه‌ای نمی‌سازد؛ اینجا فقط session/access context موجود Phoenix را به UI متصل می‌کنیم.</p>
      <label class="field-label" for="connection-token">Access token</label>
      <input id="connection-token" class="studio-input-line" type="password" autocomplete="off" value="${escapeAttr(token)}" placeholder="Bearer token" />
      <label class="field-label" for="connection-workspace">Workspace ID</label>
      <input id="connection-workspace" class="studio-input-line" type="text" autocomplete="off" value="${escapeAttr(workspace)}" placeholder="Workspace ID" />
      <label class="field-label" for="connection-business">Business ID <span class="field-optional">اختیاری</span></label>
      <input id="connection-business" class="studio-input-line" type="text" autocomplete="off" value="${escapeAttr(business)}" placeholder="Business ID" />
      <div id="connection-state" class="connection-state">وضعیت: بررسی نشده</div>
      <div class="connection-actions">
        <button class="button button-ghost" type="button" data-close-connection>لغو</button>
        <button class="button button-primary" type="button" data-test-connection>بررسی و ذخیره</button>
      </div>
    </section>`;
  document.body.appendChild(overlay);

  overlay.querySelectorAll<HTMLElement>("[data-close-connection]").forEach((node) =>
    node.addEventListener("click", () => overlay.remove()),
  );

  overlay.querySelector<HTMLButtonElement>("[data-test-connection]")?.addEventListener("click", async () => {
    const tokenInput = overlay.querySelector<HTMLInputElement>("#connection-token");
    const workspaceInput = overlay.querySelector<HTMLInputElement>("#connection-workspace");
    const businessInput = overlay.querySelector<HTMLInputElement>("#connection-business");
    const state = overlay.querySelector<HTMLElement>("#connection-state");
    if (!tokenInput || !workspaceInput || !businessInput || !state) return;

    const accessToken = tokenInput.value.trim();
    const workspaceId = workspaceInput.value.trim();
    const businessId = businessInput.value.trim();

    if (!accessToken || !workspaceId) {
      state.textContent = "Access token و Workspace ID الزامی هستند.";
      state.className = "connection-state error";
      return;
    }

    sessionStorage.setItem(STORAGE.accessToken, accessToken);
    localStorage.setItem(STORAGE.workspace, workspaceId);
    if (businessId) localStorage.setItem(STORAGE.business, businessId);

    state.textContent = "در حال بررسی session…";
    state.className = "connection-state";

    try {
      const session = await apiJson<{ session: { authenticated: boolean; actorId?: string; workspaceId?: string } }>("/api/v1/session");
      const context = await apiJson<{ authenticated: boolean; tenantId?: string; workspaceId?: string; permissions?: string[] }>("/api/v1/context");
      state.textContent = context.authenticated
        ? `متصل شد · workspace ${context.workspaceId ?? session.session.workspaceId ?? workspaceId}`
        : "Session احراز نشد.";
      state.className = context.authenticated ? "connection-state success" : "connection-state error";
      if (context.authenticated) window.setTimeout(() => overlay.remove(), 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : "اتصال برقرار نشد.";
      state.textContent = message;
      state.className = "connection-state error";
    }
  });
}

function renderDraftSkeleton(): string {
  return '<div class="draft-loading"><div class="draft-loading-orb"></div><div class="skeleton line long"></div><div class="skeleton line medium"></div><div class="skeleton line short"></div><p>ققنوس در حال ساختن یک پیش‌نویس قابل بازبینی است…</p></div>';
}

async function apiFormData<T>(url: string, form: FormData): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  const token = sessionStorage.getItem(STORAGE.accessToken);
  const workspace = localStorage.getItem(STORAGE.workspace);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (workspace) headers.set("x-workspace-id", workspace);

  const response = await fetch(url, { method: "POST", headers, body: form });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error && typeof body.error.message === "string"
        ? body.error.message
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

async function apiJson<T>(url: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  const token = sessionStorage.getItem(STORAGE.accessToken);
  const workspace = localStorage.getItem(STORAGE.workspace);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (workspace) headers.set("x-workspace-id", workspace);
  for (const [key, value] of Object.entries(options.headers ?? {})) headers.set(key, value);

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error && typeof body.error.message === "string"
        ? body.error.message
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}


async function loadShellContext(): Promise<void> {
  if (shellLoadInFlight || !sessionStorage.getItem(STORAGE.accessToken)) {
    updateShellIndicators();
    return;
  }
  shellLoadInFlight = true;
  try {
    const [context, workspaces, notifications] = await Promise.all([
      apiJson<{ actorId?: string; tenantId?: string; workspaceId?: string }>("/api/v1/context"),
      apiJson<{ data: WorkspaceSummary[]; currentWorkspaceId?: string | null }>("/api/v1/workspaces"),
      apiJson<{ data: NotificationView[] }>("/api/v1/notifications?limit=30"),
    ]);
    shellContext = context;
    shellWorkspaces = Array.isArray(workspaces.data) ? workspaces.data : [];
    shellNotifications = Array.isArray(notifications.data) ? notifications.data : [];
  } catch {
    // Shell remains usable when authenticated read models are unavailable.
  } finally {
    shellLoadInFlight = false;
    updateShellIndicators();
  }
}

function updateShellIndicators(): void {
  const currentId = localStorage.getItem(STORAGE.workspace) ?? shellContext.workspaceId ?? "";
  const current = shellWorkspaces.find((workspace) => workspace.id === currentId);
  const name = current?.name ?? (currentId ? compactId(currentId) : "فضای شما");
  document.querySelectorAll<HTMLElement>("#shell-workspace-name, #sidebar-workspace-name").forEach((node) => {
    node.textContent = name;
  });
  document.querySelectorAll<HTMLElement>("#sidebar-workspace-status").forEach((node) => {
    node.textContent = current?.status === "active" ? "فعال · Workspace" : current ? current.status ?? "Workspace" : "فضای کاری من";
  });
  const readIds = getReadNotificationIds();
  const unread = shellNotifications.filter((item) => !readIds.has(item.id)).length;
  document.querySelectorAll<HTMLElement>("#notification-count").forEach((node) => {
    node.textContent = String(unread);
    node.hidden = unread === 0;
  });
}

function getReadNotificationIds(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem("phoenix-read-notifications") ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string").slice(-200) : []);
  } catch {
    return new Set();
  }
}

function markNotificationReadLocally(id: string): void {
  const ids = getReadNotificationIds();
  ids.add(id);
  localStorage.setItem("phoenix-read-notifications", JSON.stringify(Array.from(ids).slice(-200)));
  updateShellIndicators();
}

function openWorkspaceSwitcher(): void {
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "workspace-overlay";
  const currentId = localStorage.getItem(STORAGE.workspace) ?? shellContext.workspaceId ?? "";
  const rows = shellWorkspaces.length
    ? shellWorkspaces.map((workspace) => `
        <button class="workspace-option ${workspace.id === currentId ? "active" : ""}" type="button" data-select-workspace="${escapeAttr(workspace.id)}">
          <span class="workspace-option-icon">◆</span>
          <span><strong>${escapeHtml(workspace.name)}</strong><small>${escapeHtml(workspace.id)}</small></span>
          <b>${workspace.id === currentId ? "✓" : "→"}</b>
        </button>`).join("")
    : '<div class="slot-empty"><span>◆</span><p>Workspace مجاز دیگری برای این حساب پیدا نشد.</p></div>';
  overlay.innerHTML = `
    <div class="connection-backdrop" data-close-workspace></div>
    <section class="connection-modal glass-card workspace-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-title">
      <button class="connection-close" type="button" data-close-workspace aria-label="بستن">×</button>
      <span class="eyebrow"><i></i> Workspace Switcher</span>
      <h2 id="workspace-title">فضای کاری را انتخاب کنید</h2>
      <p>فقط workspaceهایی که کاربر در آن‌ها Membership فعال دارد قابل انتخاب هستند.</p>
      <div class="workspace-option-list">${rows}</div>
      <div class="connection-actions">
        <button class="button button-ghost" type="button" data-close-workspace>بستن</button>
        <button class="button button-primary" type="button" data-refresh-shell>بروزرسانی</button>
      </div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLElement>("[data-close-workspace]").forEach((node) => node.addEventListener("click", () => overlay.remove()));
  overlay.querySelector<HTMLButtonElement>("[data-refresh-shell]")?.addEventListener("click", () => {
    void loadShellContext();
    showToast("Workspace context بروزرسانی شد.");
  });
  overlay.querySelectorAll<HTMLButtonElement>("[data-select-workspace]").forEach((button) => {
    button.addEventListener("click", async () => {
      const next = button.dataset.selectWorkspace;
      if (!next) return;
      const previous = localStorage.getItem(STORAGE.workspace);
      localStorage.setItem(STORAGE.workspace, next);
      try {
        const context = await apiJson<{ authenticated: boolean; workspaceId?: string }>("/api/v1/context");
        if (!context.authenticated || context.workspaceId !== next) throw new Error("Workspace context مجاز نیست.");
        overlay.remove();
        render();
        showToast("Workspace تغییر کرد.");
      } catch (error) {
        if (previous) localStorage.setItem(STORAGE.workspace, previous); else localStorage.removeItem(STORAGE.workspace);
        showToast(error instanceof Error ? error.message : "تغییر Workspace ناموفق بود.");
      }
    });
  });
}

function openNotificationCenter(): void {
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "notification-overlay";
  const readIds = getReadNotificationIds();
  const rows = shellNotifications.length
    ? shellNotifications.map((item) => `
        <article class="notification-item ${readIds.has(item.id) ? "read" : "unread"}">
          <div class="notification-item-icon">${item.channel === "in_app" ? "♢" : "◌"}</div>
          <div class="notification-item-copy">
            <div class="notification-item-top"><strong>${escapeHtml(item.intent ?? "notification")}</strong><span>${escapeHtml(item.priority ?? "normal")}</span></div>
            <p>${escapeHtml(notificationSummary(item))}</p>
            <small>${escapeHtml(formatDate(item.createdAt))} · ${escapeHtml(item.status ?? "created")}</small>
          </div>
          <button class="notification-read" type="button" data-mark-notification-read="${escapeAttr(item.id)}">${readIds.has(item.id) ? "خوانده شد" : "خواندم"}</button>
        </article>`).join("")
    : '<div class="slot-empty"><span>♢</span><p>اعلان جدیدی برای این حساب ثبت نشده است.</p></div>';
  overlay.innerHTML = `
    <div class="connection-backdrop" data-close-notification></div>
    <section class="connection-modal glass-card notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-title">
      <button class="connection-close" type="button" data-close-notification aria-label="بستن">×</button>
      <span class="eyebrow"><i></i> Notification Center</span>
      <h2 id="notification-title">اعلان‌های شما</h2>
      <p>وضعیت خوانده‌شدن در سطح UI مدیریت می‌شود و delivery state همچنان متعلق به Communication است.</p>
      <div class="notification-list">${rows}</div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLElement>("[data-close-notification]").forEach((node) => node.addEventListener("click", () => overlay.remove()));
  overlay.querySelectorAll<HTMLButtonElement>("[data-mark-notification-read]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.markNotificationRead;
      if (!id) return;
      markNotificationReadLocally(id);
      button.textContent = "خوانده شد";
      button.parentElement?.classList.remove("unread");
      button.parentElement?.classList.add("read");
    });
  });
}

function notificationSummary(item: NotificationView): string {
  if (!item.variables || typeof item.variables !== "object") return "اعلان ثبت‌شده در ققنوس.";
  const values = Object.values(item.variables).filter((value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean");
  return values.length ? values.slice(0, 2).map(String).join(" · ") : "اعلان ثبت‌شده در ققنوس.";
}

function renderAdminHealth(): void {
  const status = document.querySelector<HTMLElement>("#admin-health-status");
  const host = document.querySelector<HTMLElement>("#admin-health");
  if (!status || !host) return;
  host.innerHTML = '<div class="slot-loading">در حال بررسی readiness…</div>';
  void fetch("/ready").then(async (response) => {
    const body = await response.json().catch(() => ({}));
    status.textContent = response.ok ? "Ready" : "Not Ready";
    status.className = response.ok ? "pill success" : "pill warning";
    host.innerHTML = `
      <div><span>Runtime</span><strong>${escapeHtml(String(body?.checks?.runtime ?? "—"))}</strong></div>
      <div><span>Database</span><strong>${escapeHtml(String(body?.checks?.database ?? "—"))}</strong></div>
      <div><span>Migrations</span><strong>${escapeHtml(String(body?.checks?.migrationRegistry ?? "—"))}</strong></div>`;
  }).catch((error) => {
    status.textContent = "خطا";
    status.className = "pill warning";
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "Readiness ناموفق بود.")}</p></div>`;
  });
}

async function loadAdminState(): Promise<void> {
  renderAdminHealth();
  const tenant = document.querySelector<HTMLElement>("#admin-tenant-id");
  const workspace = document.querySelector<HTMLElement>("#admin-workspace-id");
  const members = document.querySelector<HTMLElement>("#admin-members");
  const memberCount = document.querySelector<HTMLElement>("#admin-member-count");
  const notificationCount = document.querySelector<HTMLElement>("#admin-notification-count");
  const contextStatus = document.querySelector<HTMLElement>("#admin-context-status");
  const usageSummary = document.querySelector<HTMLElement>("#admin-ai-usage-summary");
  const usageList = document.querySelector<HTMLElement>("#admin-ai-usage-list");
  const auditList = document.querySelector<HTMLElement>("#admin-audit-list");
  const auditMeta = document.querySelector<HTMLElement>("#admin-audit-meta");
  const jobsList = document.querySelector<HTMLElement>("#admin-jobs-list");
  const jobsMeta = document.querySelector<HTMLElement>("#admin-jobs-meta");
  if (tenant) tenant.textContent = shellContext.tenantId ? compactId(shellContext.tenantId) : "—";
  if (workspace) workspace.textContent = shellContext.workspaceId ? compactId(shellContext.workspaceId) : "—";
  if (notificationCount) notificationCount.textContent = String(shellNotifications.length);
  if (usageList) usageList.innerHTML = '<div class="slot-loading">در حال خواندن AI telemetry…</div>';
  if (auditList) auditList.innerHTML = '<div class="slot-loading">در حال خواندن Audit…</div>';
  if (jobsList) jobsList.innerHTML = '<div class="slot-loading">در حال خواندن jobs…</div>';

  const tasks: Promise<void>[] = [];
  if (members) {
    members.innerHTML = '<div class="slot-loading">در حال خواندن اعضا…</div>';
    if (!shellContext.workspaceId) {
      members.innerHTML = '<div class="slot-empty"><span>◎</span><p>Workspace context موجود نیست.</p></div>';
    } else {
      tasks.push((async () => {
        try {
          const response = await apiJson<{ data: { id: string; userId: string; status: string }[] }>(`/api/v1/workspaces/${encodeURIComponent(shellContext.workspaceId)}/members`);
          const items = Array.isArray(response.data) ? response.data : [];
          if (memberCount) memberCount.textContent = String(items.length);
          if (contextStatus) {
            contextStatus.textContent = "Connected";
            contextStatus.className = "pill success";
          }
          members.innerHTML = items.length ? items.map((item) => `
            <div class="admin-member-row"><span class="avatar">${escapeHtml((item.userId || "U").slice(0,1).toUpperCase())}</span><div><strong>${escapeHtml(item.userId)}</strong><small>${escapeHtml(item.status)}</small></div><span class="pill success">member</span></div>`).join("") : '<div class="slot-empty"><span>◎</span><p>عضوی ثبت نشده است.</p></div>';
        } catch (error) {
          members.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن اعضا ناموفق بود.")}</p></div>`;
        }
      })());
    }
  }

  if (usageList) {
    tasks.push((async () => {
      try {
        const response = await apiJson<{ data: { operationId: string; operationType: string; meterUnit: string; quantity: number; modelId?: string | null; billingUsageReference?: string | null; createdAt: string }[] }>("/api/v1/ai/usage?limit=12");
        const items = Array.isArray(response.data) ? response.data : [];
        const total = items.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0), 0);
        if (usageSummary) usageSummary.textContent = items.length ? `${items.length} رکورد · ${total.toLocaleString("fa-IR")} ${items[0]?.meterUnit ?? "units"}` : "هنوز telemetry AI برای این حساب ثبت نشده است.";
        usageList.innerHTML = items.length ? items.slice(0,6).map((item) => `
          <div class="admin-usage-row"><div><strong>${escapeHtml(item.operationType)}</strong><small>${escapeHtml(item.modelId ?? "provider/model نامشخص")} · ${escapeHtml(formatDate(item.createdAt))}</small></div><span>${escapeHtml(String(item.quantity))} ${escapeHtml(item.meterUnit)}</span></div>`).join("") : '<div class="slot-empty"><span>✦</span><p>Usage فعالی ثبت نشده است.</p></div>';
      } catch (error) {
        usageList.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن AI usage ناموفق بود.")}</p></div>`;
        if (usageSummary) usageSummary.textContent = "Usage API در دسترس نیست.";
      }
    })());
  }

  if (jobsList) {
    tasks.push((async () => {
      try {
        const response = await apiJson<{ data: { id: string; status: string; workflowId: string; createdAt: string; businessId?: string | null }[] }>("/api/v1/automation/executions?limit=20");
        const items = Array.isArray(response.data) ? response.data : [];
        if (jobsMeta) jobsMeta.textContent = String(items.length) + " pending";
        jobsList.innerHTML = items.length
          ? items.map((item) => `<div class="admin-job-row"><div><strong>${escapeHtml(item.workflowId)}</strong><small>${escapeHtml(item.businessId ?? "workspace")} · ${escapeHtml(formatDate(item.createdAt))}</small></div><span class="pill warning">${escapeHtml(item.status)}</span></div>`).join("")
          : '<div class="slot-empty"><span>⚙</span><p>Job pendingای وجود ندارد.</p></div>';
      } catch (error) {
        jobsList.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن jobs ناموفق بود.")}</p></div>`;
        if (jobsMeta) jobsMeta.textContent = "خطا";
      }
    })());
  }

  if (auditList) {
    tasks.push((async () => {
      try {
        const response = await apiJson<{ data: { id: string; actorId?: string; action: string; targetType?: string; targetId?: string; outcome: string; createdAt: string }[] }>("/api/v1/audit?limit=20");
        const items = Array.isArray(response.data) ? response.data : [];
        if (auditMeta) auditMeta.textContent = `${items.length} رویداد`;
        auditList.innerHTML = items.length ? items.slice(0,10).map((item) => `
          <div class="admin-audit-row"><div><strong>${escapeHtml(item.action)}</strong><small>${escapeHtml(item.targetType ?? "target")} · ${escapeHtml(item.targetId ?? "—")} · ${escapeHtml(formatDate(item.createdAt))}</small></div><span class="pill ${item.outcome === "succeeded" ? "success" : "warning"}">${escapeHtml(item.outcome)}</span></div>`).join("") : '<div class="slot-empty"><span>◎</span><p>Audit eventی برای این scope پیدا نشد.</p></div>';
      } catch (error) {
        if (auditMeta) auditMeta.textContent = "خطا";
        auditList.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن Audit ناموفق بود.")}</p></div>`;
      }
    })());
  }

  await Promise.all(tasks);
}


function showToast(message: string): void {
  let host = document.querySelector<HTMLDivElement>(".toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>✦</span><p>${escapeHtml(message)}</p>`;
  host.appendChild(toast);
  window.setTimeout(() => toast.classList.add("visible"), 10);
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 240);
  }, 3400);
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}


window.addEventListener("popstate", () => {
  const target = normalizePath(location.pathname);
  if (!routes.some((route) => route.path === target)) {
    window.location.reload();
    return;
  }
  render();
});
window.addEventListener("keydown", handleGlobalShortcut);
render();
void hydrateSessionContext();
