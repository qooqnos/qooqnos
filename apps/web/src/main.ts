import { uiButton, uiField, uiSelect, uiTabs, uiTable, uiDropdown, uiDialog, uiEmpty, uiSkeleton } from "./ui.js";
import { getBusinessVerticalUi, resolveBusinessVerticalKey } from "./business-vertical-ui.js";
import { getVerticalModuleBlueprint, getVerticalModuleForSlug, getVerticalModuleRoleFit, getVerticalModuleRoute, getVerticalModuleUiContract, resolveVerticalRoleLens, type VerticalModuleBlueprint } from "./business-module-ui.js";
import { bindVerticalWorkflowCanvas, bindVerticalWorkflowOverview, renderVerticalWorkflowCanvas, renderVerticalWorkflowOverview } from "./vertical-workflow-ui.js";
import { getVerticalWorkflowStageModule, getVerticalWorkflowSteps } from "./business-workflow-ui.js";
import { resolveVerticalModuleAlias } from "./business-module-ui.js";
import { defaultI18n, getDirection, getLocaleFromPreference, LOCALE_STORAGE_KEY, persistLocale, readPersistedLocale, translateCanonicalTerm, translateUiText, type SupportedLanguage } from "./i18n-runtime.js";
type Theme = "dark" | "light";
type Language = SupportedLanguage;

type Route = {
  path: string;
  label: string;
  icon: string;
  render: () => string;
};

const ROUTE_CANONICAL_TERM_KEYS: Readonly<Record<string, string>> = {
  "/business": "canonical.business.business",
  "/business/profile": "canonical.business.businessProfile",
  "/booking": "canonical.booking.booking",
  "/customer": "canonical.customer.customer",
  "/notifications": "canonical.communication.notification",
  "/communication": "canonical.communication.conversation",
  "/promotion": "canonical.promotion.promotion",
};

function routeUiLabel(route: Route): string {
  const key = ROUTE_CANONICAL_TERM_KEYS[route.path];
  return key ? canonicalUi(key) : uiText(route.label);
}

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
  price?: number | null;
  currency?: string | null;
};

const STORAGE = {
  theme: "phoenix-theme-v2",
  language: LOCALE_STORAGE_KEY,
  workspace: "phoenix-workspace-id",
  accessToken: "phoenix-access-token",
  business: "phoenix-business-id",
  businessVertical: "phoenix-business-vertical",
  customer: "phoenix-customer-id",
};

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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
const socialActionIds = new Map<string, string>();
const socialState = {
  follows: new Map<string, string>(),
  engagements: new Map<string, string>(),
};
let discoveryOffset = 0;
let discoveryHasMore = false;
let discoveryBusy = false;

function socialKey(targetType: string, targetId: string): string {
  return targetType + ":" + targetId;
}

function isSocialActive(action: "follow" | "like" | "save", item: DiscoveryResult): boolean {
  const target = action === "follow"
    ? (item.metadata && typeof item.metadata.businessId === "string"
      ? { targetType: "business" as const, targetId: item.metadata.businessId }
      : item.sourceType === "business"
        ? { targetType: "business" as const, targetId: item.sourceId ?? item.id ?? "" }
        : null)
    : socialTarget(item);
  if (!target?.targetId) return false;
  return action === "follow"
    ? socialState.follows.has(socialKey(target.targetType, target.targetId))
    : socialState.engagements.has(action + ":" + socialKey(target.targetType, target.targetId));
}

async function loadSocialState(): Promise<void> {
  if (!sessionStorage.getItem(STORAGE.accessToken)) return;
  try {
    const result = await apiJson<{ data: { follows?: Array<{ id: string; targetType: string; targetId: string }>; engagements?: Array<{ id: string; targetType: string; targetId: string; engagementType: string }> } }>("/api/v1/social/state?limit=200");
    socialState.follows.clear();
    socialState.engagements.clear();
    for (const follow of result.data.follows ?? []) socialState.follows.set(socialKey(follow.targetType, follow.targetId), follow.id);
    for (const engagement of result.data.engagements ?? []) socialState.engagements.set(engagement.engagementType + ":" + socialKey(engagement.targetType, engagement.targetId), engagement.id);
    refreshSocialFeed();
  } catch {
    // Read state is progressive enhancement; feed remains usable without it.
  }
}

function refreshSocialFeed(): void {
  const host = document.querySelector<HTMLElement>("#discovery-results");
  if (!host || !activeDiscoveryItems.length) return;
  host.innerHTML = renderSocialPosts(activeDiscoveryItems);
  bindDiscoveryResultEvents();
  renderCompareTray();
}

function socialTarget(item: DiscoveryResult): { targetType: "product" | "service" | "business"; targetId: string } | null {
  const metadataType = item.metadata && typeof item.metadata.offeringType === "string" ? item.metadata.offeringType : undefined;
  const targetType = item.sourceType === "product" || item.sourceType === "service" || item.sourceType === "business"
    ? item.sourceType
    : metadataType === "product" || metadataType === "service" ? metadataType : undefined;
  const targetId = item.sourceId ?? item.id;
  return targetType && targetId ? { targetType, targetId } : null;
}

async function loadSocialActivity(): Promise<unknown[]> {
  const result = await apiJson<{ data: unknown[] }>("/api/v1/social/activity?limit=50");
  return Array.isArray(result.data) ? result.data : [];
}

function socialActivityLabel(eventType: string): string {
  const labels: Record<string,string> = {
    "social.follow.created": "کسب‌وکاری را دنبال کردی",
    "social.follow.removed": "دنبال‌کردن یک کسب‌وکار را برداشتی",
    "social.like.created": "یک مورد را پسندیدی",
    "social.like.removed": "پسندیدن یک مورد را برداشتی",
    "social.save.created": "یک مورد را ذخیره کردی",
    "social.save.removed": "ذخیره یک مورد را برداشتی",
    "social.comment.created": "برای یک مورد نظر ثبت کردی",
    "social.comment.removed": "نظر خودت را حذف کردی",
  };
  return labels[eventType] ?? "یک فعالیت اجتماعی ثبت شد";
}

async function persistSocialAction(action: "like" | "save", item: DiscoveryResult): Promise<boolean> {
  const target = socialTarget(item);
  if (!target) throw new Error("این محتوا هنوز به یک عرضه canonical متصل نیست.");
  const key = action + ":" + socialKey(target.targetType, target.targetId);
  const existingId = socialState.engagements.get(key) ?? socialActionIds.get(key);
  if (existingId) {
    await apiJson("/api/v1/social/" + (action === "like" ? "likes" : "saves") + "/" + encodeURIComponent(existingId), { method: "DELETE" });
    socialActionIds.delete(key);
    socialState.engagements.delete(key);
    return false;
  }
  const result = await apiJson<{ data: { id: string } }>("/api/v1/social/" + (action === "like" ? "likes" : "saves"), { method: "POST", body: target });
  socialActionIds.set(key, result.data.id);
  socialState.engagements.set(key, result.data.id);
  return true;
}

async function persistSocialFollow(item: DiscoveryResult): Promise<boolean> {
  const businessId = item.metadata && typeof item.metadata.businessId === "string" ? item.metadata.businessId : item.sourceType === "business" ? item.sourceId ?? item.id : undefined;
  if (!businessId) throw new Error("شناسه کسب‌وکار این محتوا هنوز canonical نشده است.");
  const key = socialKey("business", businessId);
  const existingId = socialState.follows.get(key) ?? socialActionIds.get("follow:" + key);
  if (existingId) {
    await apiJson("/api/v1/social/follows/" + encodeURIComponent(existingId), { method: "DELETE" });
    socialActionIds.delete("follow:" + key);
    socialState.follows.delete(key);
    return false;
  }
  const result = await apiJson<{ data: { id: string } }>("/api/v1/social/follows", { method: "POST", body: { targetType: "business", targetId: businessId } });
  socialActionIds.set("follow:" + key, result.data.id);
  socialState.follows.set(key, result.data.id);
  return true;
}

async function persistSocialComment(item: DiscoveryResult): Promise<void> {
  const target = socialTarget(item);
  if (!target) throw new Error("این محتوا هنوز به یک عرضه canonical متصل نیست.");
  const body = window.prompt("نظر شما چیست؟", "");
  if (!body?.trim()) return;
  await apiJson("/api/v1/social/comments", { method: "POST", body: { ...target, body: body.trim(), idempotencyKey: crypto.randomUUID() } });
}

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


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js?v=2").catch(() => undefined);
  }, { once: true });
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Phoenix web root is missing.");
const appRoot = app;

const routes: Route[] = [
  { path: "/", label: "خانه", icon: "⌂", render: renderHome },
  { path: "/discover", label: "کشف", icon: "⌕", render: renderDiscover },
  { path: "/compare", label: "مقایسه", icon: "⚖", render: renderCompare },
  { path: "/activity", label: "فعالیت", icon: "✦", render: renderActivity },
  { path: "/business", label: "کسب‌وکار", icon: "▦", render: renderBusiness },
  { path: "/business/profile", label: "پروفایل کسب‌وکار", icon: "◉", render: renderBusinessProfile },
  { path: "/product-studio", label: "استودیو محصول", icon: "✦", render: renderProductStudio },
  { path: "/transactions", label: "معاملات", icon: "↔", render: renderTransactions },
  { path: "/notifications", label: "اعلان‌ها", icon: "♢", render: renderNotifications },
  { path: "/profile", label: "پروفایل", icon: "◉", render: renderProfile },
  { path: "/account", label: "حساب", icon: "◎", render: renderAccount },
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
const initialLanguage = getInitialLanguage();
defaultI18n.setLanguage(initialLanguage);
document.documentElement.lang = initialLanguage;
document.documentElement.dir = getDirection(initialLanguage);

async function hydrateSessionContext(): Promise<void> {
  const token = sessionStorage.getItem(STORAGE.accessToken);
  if (!token) return;
  try {
    const response = await apiJson<{ session: { authenticated: boolean; workspaceId?: string | null; locale?: string | null } }>("/api/v1/session");
    if (!response.session.authenticated) {
      sessionStorage.removeItem(STORAGE.accessToken);
      return;
    }
    if (!readPersistedLocale(localStorage) && response.session.locale) {
      const serverLocale = getLocaleFromPreference(response.session.locale, "fa");
      persistLocale(serverLocale, localStorage);
      defaultI18n.setLanguage(serverLocale);
      document.documentElement.lang = serverLocale;
      document.documentElement.dir = getDirection(serverLocale);
      render();
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
  return "light";
}

function getInitialLanguage(): Language {
  return readPersistedLocale(localStorage) ?? "fa";
}


function applyLanguageToNode(root: Node, language: Language): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  nodes.forEach((textNode) => {
    const value = textNode.nodeValue ?? "";
    if (!value.trim()) return;
    const translated = translateUiText(value, language);
    if (translated !== value) textNode.nodeValue = translated;
  });

  if (root instanceof Element && root.matches("[placeholder], [aria-label], [title]")) {
    (["placeholder", "aria-label", "title"] as const).forEach((attribute) => {
      const value = root.getAttribute(attribute);
      if (!value) return;
      const translated = translateUiText(value, language);
      if (translated !== value) root.setAttribute(attribute, translated);
    });
  }

  if (root instanceof Element || root instanceof Document) {
    root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]").forEach((element) => {
      (["placeholder", "aria-label", "title"] as const).forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (!value) return;
        const translated = translateUiText(value, language);
        if (translated !== value) element.setAttribute(attribute, translated);
      });
    });
  }
}

function applyLanguageToUi(): void {
  const language = getInitialLanguage();
  defaultI18n.setLanguage(language);
  applyLanguageToNode(document.body, language);
  document.querySelectorAll<HTMLElement>("[data-language-current]").forEach((node) => {
    node.textContent = languageLabel(language);
  });
}

let languageObserverInstalled = false;
function installLanguageObserver(): void {
  if (languageObserverInstalled || !appRoot) return;
  languageObserverInstalled = true;
  const observer = new MutationObserver((mutations) => {
    const language = getInitialLanguage();
    defaultI18n.setLanguage(language);
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((addedNode) => {
        if (addedNode.nodeType === Node.ELEMENT_NODE || addedNode.nodeType === Node.TEXT_NODE) {
          applyLanguageToNode(addedNode, language);
        }
      });
    }
    document.querySelectorAll<HTMLElement>("[data-language-current]").forEach((node) => {
      if (node.textContent !== languageLabel(language)) node.textContent = languageLabel(language);
    });
  });
  observer.observe(appRoot, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["placeholder", "aria-label", "title"],
  });
}

function languageLabel(language: Language): string {
  return language === "en" ? "EN" : language === "ar" ? "عربي" : "فا";
}

function uiText(value: string): string {
  return translateUiText(value, getInitialLanguage());
}

function canonicalUi(key: string): string {
  return translateCanonicalTerm(key, getInitialLanguage());
}

const ROUTE_CANONICAL_LABELS: Readonly<Record<string, string>> = {
  "/business": "canonical.business.business",
  "/business/profile": "canonical.business.businessProfile",
  "/booking": "canonical.booking.booking",
  "/customer": "canonical.customer.customer",
  "/notifications": "canonical.communication.notification",
  "/catalog": "canonical.catalog.category",
};

function routeUiLabel(route: Route): string {
  const key = ROUTE_CANONICAL_LABELS[route.path];
  return key ? canonicalUi(key) : uiText(route.label);
}

function setLanguage(language: Language): void {
  const next = getLocaleFromPreference(language, "fa");
  persistLocale(next, localStorage);
  defaultI18n.setLanguage(next);
  document.documentElement.lang = next;
  document.documentElement.dir = getDirection(next);
  render();
}

function toggleLanguageMenu(): void {
  const menu = document.querySelector<HTMLElement>("[data-language-menu]");
  const trigger = document.querySelector<HTMLButtonElement>("[data-language-toggle]");
  if (!menu || !trigger) return;
  menu.hidden = !menu.hidden;
  trigger.setAttribute("aria-expanded", String(!menu.hidden));
}
function renderLanguageSwitcher(): string {
  const active = getInitialLanguage();
  const selected = (language: Language): string => language === active ? " active" : "";
  const mark = (language: Language): string => language === active ? "true" : "false";
  return '<div class="language-switcher">' +
    '<button class="icon-button language-toggle" type="button" data-language-toggle aria-label="انتخاب زبان" aria-haspopup="listbox" aria-expanded="false"><span aria-hidden="true">文</span><span data-language-current>' + languageLabel(active) + '</span><span aria-hidden="true">⌄</span></button>' +
    '<div class="language-menu glass-card" data-language-menu role="listbox" aria-label="انتخاب زبان" hidden>' +
      '<button type="button" class="language-option' + selected("fa") + '" data-language-option="fa" role="option" aria-selected="' + mark("fa") + '"><span class="language-option-code">فا</span><span>فارسی</span><b aria-hidden="true">✓</b></button>' +
      '<button type="button" class="language-option' + selected("en") + '" data-language-option="en" role="option" aria-selected="' + mark("en") + '"><span class="language-option-code">EN</span><span>English</span><b aria-hidden="true">✓</b></button>' +
      '<button type="button" class="language-option' + selected("ar") + '" data-language-option="ar" role="option" aria-selected="' + mark("ar") + '"><span class="language-option-code">عربي</span><span>العربية</span><b aria-hidden="true">✓</b></button>' +
    '</div></div>';
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
  const businessModule = parseBusinessModuleRequest(normalized) ?? parseBusinessModuleAliasPath(normalized);
  if (normalized.startsWith("/businesses/") && normalized.split("/").filter(Boolean).length === 2) {
    return {
      path: normalized,
      label: "پروفایل کسب‌وکار",
      icon: "◆",
      render: renderBusinessPublic,
    };
  }
  if (businessModule) {
    const semanticPath = businessModulePath(businessModule.vertical, businessModule.module);
    return {
      path: semanticPath,
      label: businessModule.module,
      icon: "▦",
      render: () => renderBusinessModule(businessModule.vertical, businessModule.module),
    };
  }
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
  const url = new URL(path, window.location.origin);
  const targetPath = normalizePath(url.pathname);
  const targetUrl = targetPath + url.search + url.hash;
  const currentUrl = normalizePath(location.pathname) + location.search + location.hash;
  const isKnownDynamicBusinessPath = Boolean(parseBusinessModulePath(targetPath) || parseBusinessModuleAliasPath(targetPath, url.search)) || targetPath.startsWith("/businesses/");
  if (targetPath !== normalizePath(location.pathname) && !routes.some((route) => route.path === targetPath) && !isKnownDynamicBusinessPath) {
    window.location.assign(targetUrl);
    return;
  }
  if (currentUrl === targetUrl) {
    render();
    return;
  }
  history.pushState({}, "", targetUrl);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render(): void {
  const route = currentRoute();
  const page = route.render();
  if (route.label !== "صفحه عمومی") clearHydratedSeoSurface(route);
  const isHome = route.path === "/";
  const isSocial = route.path === "/discover" || route.path === "/compare" || route.path === "/activity";
  const isPublicBusiness = route.path.startsWith("/businesses/");
  appRoot.innerHTML = `
    <div class="app-shell ${isHome ? "home-shell" : ""} ${isSocial ? "social-shell" : ""} ${isPublicBusiness ? "public-business-shell" : ""}">
      ${isHome || isPublicBusiness ? renderPublicHeader() : isSocial ? renderSocialHeader(route.path === "/activity" ? "activity" : route.path === "/discover" ? (new URLSearchParams(location.search).get("tab") === "explore" ? "explore" : new URLSearchParams(location.search).get("tab") === "following" ? "following" : "feed") : "feed") : renderHeader(route)}
      <div class="app-body">
        ${isHome || isSocial || isPublicBusiness ? "" : renderSidebar(route)}
        <main id="main" class="page-content ${isHome ? "home-page-content" : isSocial ? "social-page-content" : isPublicBusiness ? "public-business-page-content" : ""}">${page}</main>
      </div>
      ${isHome || isPublicBusiness ? "" : isSocial ? renderSocialMobileNav() : renderMobileNav(route)}
      ${renderToastHost()}
    </div>
  `;
  bindGlobalEvents();
  syncThemeButtons();
  applyLanguageToUi();
  installLanguageObserver();
  if (route.path === "/discover") {
    const params = new URLSearchParams(location.search);
    const initialDiscoveryQuery = params.get("q")?.trim() ?? "";
    const socialTab = params.get("tab") ?? "for-you";
    if (initialDiscoveryQuery || socialTab === "explore" || socialTab === "following") void runDiscovery();
    bindDiscoveryResultEvents();
    renderCompareTray();
    void loadSocialState();
  }
  if (route.path === "/compare") {
    document.querySelector<HTMLButtonElement>("[data-clear-compare]")?.addEventListener("click", () => { localStorage.removeItem("phoenix-compare-items"); render(); });
  }
  if (route.path === "/activity") void loadActivityPage();
  void loadShellContext();
  if (route.path === "/") bindHomeEvents();
  if (route.path === "/account") void loadAccountState();
  if (route.path === "/booking") {
    const bookingParams = new URLSearchParams(location.search);
    const bookingSchedule = bookingParams.get("scheduleId")?.trim();
    const bookingBusiness = bookingParams.get("businessId")?.trim() || bookingParams.get("business")?.trim();
    const bookingOffering = bookingParams.get("offering")?.trim() || bookingParams.get("offeringId")?.trim();
    if (bookingOffering) void loadBookingOfferingContext();
    if (bookingSchedule) void loadBookingSlots();
    else if (bookingBusiness && bookingOffering) void loadBusinessBookingSchedules();
  }
  if (route.path === "/notifications") void loadNotificationsPage();
  if (route.path === "/profile") void loadProfilePage();
  if (route.path === "/transactions") void loadTransactionsPage();
  if (route.path === "/customer") void loadCustomerState();
  if (route.path === "/communication") void loadCommunicationState();
  if (route.path === "/billing") void loadBillingState();
  if (parseBusinessModulePath(route.path)) bindVerticalWorkflowCanvas(appRoot);
  bindVerticalWorkflowOverview(appRoot);
  if (route.path === "/business" || parseBusinessModulePath(route.path)) {
    if (route.path === "/business" && !new URLSearchParams(location.search).get("module")) void loadBusinessAccess();
    else void loadBusinessModuleContext();
  }
  if (route.path === "/business/profile") {
    void loadBusinessProfile();
    document.querySelector<HTMLElement>("#public-business-publication-action")?.addEventListener("click", () => void requestBusinessPublication());
  }
  if (route.path.startsWith("/businesses/")) {
    void loadBusinessPublicPage(route.path);
    document.querySelector<HTMLButtonElement>("#public-business-follow")?.addEventListener("click", () => void togglePublicBusinessFollow(route.path));
    document.querySelector<HTMLButtonElement>("#public-business-review")?.addEventListener("click", () => void openPublicBusinessReview(route.path));
    document.querySelector<HTMLButtonElement>("#public-business-share")?.addEventListener("click", () => void sharePublicBusiness());
  }
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
    "/activity": { title: "فعالیت | ققنوس", description: "فعالیت اجتماعی ثبت‌شده در ققنوس." },
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

function renderPublicHeader(): string {
  return `
    <header class="phoenix-public-header">
      <div class="phoenix-public-header-inner container-wide">
        <a class="phoenix-public-brand" href="/" data-nav aria-label="ققنوس">
          <span class="brand-mark phoenix-brand-mark" aria-hidden="true"><img src="/phoenix-mark.svg?v=1" alt="" /></span>
          <span><strong>ققنوس</strong><small>Phoenix Intelligence</small></span>
        </a>
        <nav class="phoenix-public-nav" aria-label="${uiText("ناوبری اصلی")}">
          <a href="#phoenix-loop">${uiText("چگونه کار می‌کند؟")}</a>
          <a href="/discover" data-nav>${uiText("کشف")}</a>
          <a href="/business" data-nav>${uiText("برای کسب‌وکارها")}</a>
        </nav>
        <a class="button button-primary phoenix-header-cta" href="#phoenix-demand-form">${uiText("نیازت را بگو")} <span>←</span></a>
        <div class="phoenix-public-actions">
          <button type="button" class="button button-ghost" data-open-connection>${uiText("ورود")}</button>
          ${renderLanguageSwitcher()}
          <button type="button" class="icon-button" data-theme-toggle aria-label="${uiText("تغییر پوسته")}">◐</button>
        </div>
      </div>
    </header>
  `;
}

function renderHeader(route: Route): string {
  return `
    <header class="app-header" data-shell-header>
      <div class="header-inner container-wide">
        <a class="brand" href="/" data-nav aria-label="بازگشت به خانه ققنوس">
          <span class="brand-mark" aria-hidden="true"><img src="/phoenix-mark.svg?v=1" alt="" /></span>
          <span class="brand-copy"><strong>ققنوس</strong><small>Phoenix Intelligence</small></span>
        </a>
        <div class="header-context" aria-live="polite">
          <span class="header-context-kicker">Phoenix</span>
          <strong>${escapeHtml(routeUiLabel(route))}</strong>
        </div>
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
          <button class="profile-chip workspace-trigger" type="button" data-workspace-toggle aria-haspopup="dialog" aria-label="انتخاب فضای کاری">
            <span class="avatar">ق</span>
            <span class="profile-copy"><strong id="shell-workspace-name">فضای شما</strong><small>${escapeHtml(routeUiLabel(route))}</small></span>
            <span class="chevron">⌄</span>
          </button>
          ${renderLanguageSwitcher()}
          <button class="icon-button" type="button" data-theme-toggle aria-label="${uiText("تغییر پوسته")}">◐</button>
        </div>
      </div>
    </header>
  `;
}

function renderSidebar(route: Route): string {
  const sidebarActivePath = route.path.startsWith("/business/workspace/")
    || route.path.startsWith("/business/workflow/")
    ? "/business"
    : route.path;
  return `
    <aside class="sidebar" aria-label="پوسته برنامه ققنوس">
      <div class="sidebar-top">
        <button class="workspace-card workspace-trigger" type="button" data-workspace-toggle aria-haspopup="dialog" aria-label="انتخاب فضای کاری">
          <div class="workspace-icon">◆</div>
          <div class="workspace-card-copy"><strong id="sidebar-workspace-name">ققنوس</strong><span id="sidebar-workspace-status">فضای کاری من</span></div>
          <span class="status-live" aria-label="فعال"></span>
        </button>
      </div>
      <div class="side-nav-scroll">
        <nav class="side-nav" aria-label="ناوبری برنامه">
          <div class="nav-label">${canonicalUi("canonical.catalog.product")}</div>
          ${routes
            .map(
              (item) => `
                <a href="${item.path}" data-nav class="nav-item ${item.path === sidebarActivePath ? "active" : ""}" ${item.path === sidebarActivePath ? 'aria-current="page"' : ""}>
                  <span class="nav-icon" aria-hidden="true">${item.icon}</span><span class="nav-copy">${routeUiLabel(item)}</span>
                </a>`,
            )
            .join("")}
          <div class="nav-label nav-spaced">${uiText("مدیریت")}</div>
          <a class="nav-item ${route.path === "/booking" ? "active" : ""}" href="/booking" data-nav ${route.path === "/booking" ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">◷</span><span class="nav-copy">${uiText("رزروها")}</span></a>
          <button class="nav-item disabled" type="button" data-coming-soon="ارتباطات"><span class="nav-icon" aria-hidden="true">◌</span><span class="nav-copy">${uiText("ارتباطات")}</span><em>${uiText("به‌زودی")}</em></button>
          <button class="nav-item disabled" type="button" data-coming-soon="گزارش‌ها"><span class="nav-icon" aria-hidden="true">↗</span><span class="nav-copy">${uiText("گزارش‌ها")}</span><em>${uiText("به‌زودی")}</em></button>
        </nav>
      </div>
      <div class="sidebar-bottom">
        <div class="ai-mini-card">
          <div class="ai-orb" aria-hidden="true">✦</div>
          <div><strong>${uiText("هوش ققنوس")}</strong><span>${uiText("آماده برای کمک")}</span></div>
        </div>
        <button class="nav-item muted" type="button" data-toast="مرکز راهنما به‌زودی فعال می‌شود."><span class="nav-icon" aria-hidden="true">?</span><span class="nav-copy">${uiText("راهنما")}</span></button>
      </div>
    </aside>
  `;
}

function renderMobileNav(route: Route): string {
  const mobileItems = [
    { path: "/", label: "خانه", icon: "⌂" },
    { path: "/product-studio", label: "محتوا", icon: "✦" },
    { path: "/transactions", label: "معاملات", icon: "↔" },
    { path: "/notifications", label: "اعلان‌ها", icon: "♢" },
    { path: "/profile", label: "پروفایل", icon: "◉" },
  ];
  return `
    <nav class="mobile-nav" aria-label="${uiText("ناوبری اصلی موبایل")}">
      ${mobileItems.map((item) => {
        const active = item.path === route.path;
        return `<a href="${item.path}" data-nav class="${active ? "active" : ""}" ${active ? 'aria-current="page"' : ""}>
          <span class="mobile-nav-icon" aria-hidden="true">${item.icon}</span><small>${uiText(item.label)}</small>
        </a>`;
      }).join("")}
    </nav>
  `;
}

function renderToastHost(): string {
  return '<div class="toast-host" aria-live="polite"></div>';
}

function renderHome(): string {
  return `
    <div class="phoenix-home">
      <section class="phoenix-home-hero">
        <div class="phoenix-home-copy">
          <span class="phoenix-eyebrow"><i></i> لایه هوشمند تصمیم‌گیری و اتصال</span>
          <h1>چیزی که نیاز داری را بگو.<br/><em>ققنوس راهش را پیدا می‌کند.</em></h1>
          <p>نیازت را به زبان خودت تعریف کن. ققنوس آن را می‌فهمد، گزینه‌های مناسب را پیدا می‌کند و مسیر اقدام را ساده می‌کند.</p>
          <form class="phoenix-demand-box" id="phoenix-demand-form">
            <div class="phoenix-demand-topline"><span><i></i> Ask Phoenix</span><small>با نیازت شروع کن، نه با کلمه کلیدی</small></div>
            <label for="phoenix-demand-input" class="sr-only">نیاز خود را بنویسید</label>
            <textarea id="phoenix-demand-input" rows="3" autocomplete="off" spellcheck="true" placeholder="مثلاً برای جمعه شب یک رستوران آرام برای ۴ نفر می‌خواهم، نزدیک مرکز شهر و با قیمت متوسط..."></textarea>
            <div class="phoenix-demand-footer">
              <span class="phoenix-demand-hint">هرچه برای تصمیم مهم است بنویس؛ ققنوس مسیر کشف را باز می‌کند.</span><span class="phoenix-demand-count" id="phoenix-demand-count">۰</span>
              <button class="button button-primary phoenix-demand-submit" type="submit">شروع کن <span>←</span></button>
            </div>
          </form>
          <div class="phoenix-intent-chips" aria-label="نمونه نیازها">
            <button type="button" data-phoenix-example="یک محصول مناسب برای هدیه می‌خواهم">یک محصول پیدا کن</button>
            <button type="button" data-phoenix-example="یک خدمت مناسب برای نیازم پیدا کن">یک خدمت پیدا کن</button>
            <button type="button" data-phoenix-example="یک کسب‌وکار مناسب نزدیک من می‌خواهم">یک کسب‌وکار پیدا کن</button>
            <button type="button" data-phoenix-example="بین چند گزینه مناسب کمکم کن انتخاب کنم">برای انتخاب کمکم کن</button>
          </div>
        </div>
        <div class="phoenix-home-visual" aria-label="هویت بصری و دستیار هوشمند ققنوس">
          <article class="phoenix-brand-stage">
            <div class="phoenix-brand-stage-glow"></div>
            <span class="phoenix-brand-stage-kicker">دستیار هوشمند ققنوس</span>
            <img class="phoenix-hero-mark" src="/phoenix-mark.svg?v=1" alt="" aria-hidden="true" />
            <strong>ققنوس</strong>
            <span class="phoenix-brand-stage-tagline">مسیرت را بفهم. انتخابت را ساده کن.</span>
            <div class="phoenix-brand-stage-actions">
              <span>Understand</span><i>→</i><span>Decide</span><i>→</i><span>Match</span>
            </div>
          </article>
          <div class="phoenix-floating-node node-demand"><b>نیاز</b><span>Understand</span></div>
          <div class="phoenix-floating-node node-match"><b>پیشنهاد</b><span>Decide</span></div>
          <div class="phoenix-floating-node node-connect"><b>اتصال</b><span>Connect</span></div>
        </div>
      </section>

      <section class="phoenix-section phoenix-experience-map" aria-labelledby="phoenix-experience-title">
        <div class="phoenix-section-heading centered">
          <span class="phoenix-kicker">Phoenix Experience</span>
          <h2 id="phoenix-experience-title">از «چه می‌خواهم؟» تا «حالا چه کنم؟»</h2>
          <p>صفحه اصلی نقطه شروع تصمیم مشتری است؛ عملیات مدیریت در مسیرهای اختصاصی باقی می‌ماند.</p>
        </div>
        <div class="phoenix-experience-grid">
          <article><span>۱</span><strong>نیازت را می‌گویی</strong><p>با زبان طبیعی؛ بدون اجبار به شناخت دسته‌بندی.</p></article>
          <article><span>۲</span><strong>نیاز ساختاربندی می‌شود</strong><p>محدودیت‌ها و چیزهای مهم برای تصمیم مشخص می‌شوند.</p></article>
          <article><span>۳</span><strong>کشف و تطبیق ادامه پیدا می‌کند</strong><p>نتیجه واقعی از داده‌های canonical ققنوس می‌آید.</p></article>
          <article><span>۴</span><strong>تصمیم و اقدام</strong><p>مقایسه، ارتباط، رزرو، خرید یا مسیر مناسب بعدی.</p></article>
        </div>
      </section>

      <section class="phoenix-section phoenix-live-demo">
        <div class="phoenix-section-heading">
          <span class="phoenix-kicker">Matching Demo · نمونه نمایشی</span>
          <h2>ببین «فهم نیاز» چگونه تصمیم را شکل می‌دهد.</h2>
          <p>این بخش یک نمونه آموزشی ثابت است؛ نتیجه زنده، امتیاز یا رتبه تولیدی نیست.</p>
        </div>
        <div class="phoenix-demo-grid">
          <article class="phoenix-demo-request">
            <span>نیاز مشتری</span>
            <blockquote>«برای تولد پدرم یک هدیه کاربردی می‌خواهم، حدود ۵ میلیون تومان.»</blockquote>
          </article>
          <article class="phoenix-understanding">
            <span>ققنوس فهمید</span>
            <div class="phoenix-understanding-chips">
              <span>مناسب برای: پدر</span><span>مناسبت: تولد</span><span>بودجه: حدود ۵ میلیون</span><span>ویژگی مهم: کاربردی</span>
            </div>
            <div class="phoenix-demo-result">
              <div class="phoenix-demo-result-icon">✦</div>
              <div><strong>دلیل ارتباط باید قابل توضیح باشد</strong><small>ققنوس نباید بدون پشتوانه، امتیاز یا رتبه ساختگی به کاربر نشان دهد.</small></div>
            </div>
            <div class="phoenix-demo-reasons">
              <div><b>01</b><strong>نیاز را دقیق‌تر می‌کند</strong><small>بودجه، مناسبت و کاربرد از متن جدا می‌شوند.</small></div>
              <div><b>02</b><strong>گزینه‌های ناسازگار را کنار می‌گذارد</strong><small>هر پیشنهاد باید به بخشی از نیاز متصل باشد.</small></div>
              <div><b>03</b><strong>انتخاب را برای کاربر نگه می‌دارد</strong><small>ققنوس تصمیم را به جای کاربر تحمیل نمی‌کند.</small></div>
            </div>
          </article>
        </div>
      </section>

      <section class="phoenix-section" id="phoenix-loop">
        <div class="phoenix-section-heading centered">
          <span class="phoenix-kicker">Phoenix Loop</span>
          <h2>از نیاز تا اقدام، با تصمیم هوشمند.</h2>
        </div>
        <div class="phoenix-loop">
          <div><b>01</b><strong>نیاز را می‌فهمد</strong><small>Understand Demand</small></div><span>←</span>
          <div><b>02</b><strong>عرضه را می‌شناسد</strong><small>Understand Supply</small></div><span>←</span>
          <div><b>03</b><strong>تصمیم می‌گیرد</strong><small>Decide</small></div><span>←</span>
          <div><b>04</b><strong>تطبیق می‌دهد</strong><small>Match</small></div><span>←</span>
          <div><b>05</b><strong>متصل می‌کند</strong><small>Connect</small></div><span>←</span>
          <div><b>06</b><strong>اقدام را ممکن می‌کند</strong><small>Act</small></div>
        </div>
        <div class="phoenix-loop-learn"><span>07</span><strong>Learn</strong><small>نتیجه تعامل و اقدام دوباره بخشی از چرخه یادگیری محصول می‌شود.</small></div>
      </section>

      <section class="phoenix-section">
        <div class="phoenix-section-heading">
          <span class="phoenix-kicker">کشف</span>
          <h2>هر نیازی، یک مسیر برای شروع.</h2>
          <p>لازم نیست محصول یا دسته‌بندی را از قبل بشناسی. کافی است نیازت را بگویی.</p>
        </div>
        <div class="phoenix-discovery-grid">
          <button type="button" data-phoenix-example="برای یک شام آرام برای دو نفر رستوران مناسب پیدا کن"><strong>🍽 رستوران و مکان</strong><span>«برای شام یک جای آرام می‌خواهم...»</span></button>
          <button type="button" data-phoenix-example="یک هدیه کاربردی برای پدرم با بودجه متوسط پیدا کن"><strong>🛍 محصول</strong><span>«برای تولد یک هدیه مناسب می‌خواهم...»</span></button>
          <button type="button" data-phoenix-example="یک متخصص مناسب برای نیاز من پیدا کن"><strong>✦ خدمت</strong><span>«یک متخصص خوب برای این کار می‌خواهم...»</span></button>
          <button type="button" data-phoenix-example="به من کمک کن بین چند گزینه مناسب انتخاب کنم"><strong>◈ تصمیم</strong><span>«بین چند گزینه نمی‌دانم کدام را انتخاب کنم...»</span></button>
        </div>
      </section>

      <section class="phoenix-section phoenix-trust-section" aria-labelledby="phoenix-trust-title">
        <div class="phoenix-section-heading centered">
          <span class="phoenix-kicker">Decision Guardrails</span>
          <h2 id="phoenix-trust-title">هوشمندی، بدون ساختن واقعیت جعلی.</h2>
          <p>نمونه نمایشی از داده واقعی جدا می‌ماند و مسیرهای عملیاتی به منبع canonical خودشان متصل می‌شوند.</p>
        </div>
        <div class="phoenix-trust-grid">
          <article><span>✓</span><strong>بدون امتیاز ساختگی</strong><p>رتبه یا دلیل تطبیق بدون پشتوانه به کاربر نمایش داده نمی‌شود.</p></article>
          <article><span>✓</span><strong>شرح‌پذیری</strong><p>ارتباط هر گزینه باید تا حد ممکن به بخشی از نیاز وصل باشد.</p></article>
          <article><span>✓</span><strong>انتخاب با کاربر</strong><p>ققنوس مسیر تصمیم را ساده می‌کند؛ تصمیم نهایی با کاربر است.</p></article>
        </div>
      </section>

      <section class="phoenix-section phoenix-business-section">
        <div>
          <span class="phoenix-kicker">For Business</span>
          <h2>کسب‌وکارت را به نیاز درست وصل کن.</h2>
          <p>اطلاعات و عرضه کسب‌وکارت را در اختیار ققنوس بگذار تا وقتی نیاز مناسبی شناسایی شد، بتواند تو را به مشتری مرتبط کند.</p>
          <a class="button button-primary" href="/business" data-nav>برای کسب‌وکارها <span>←</span></a>
        </div>
        <div class="phoenix-business-flow"><span>Supply</span><i>→</i><span>Phoenix</span><i>→</i><span>Customer Need</span></div>
      </section>

      <section class="phoenix-section phoenix-seller-ai">
        <div class="phoenix-section-heading">
          <span class="phoenix-kicker">Seller AI</span>
          <h2>فقط محصولت را معرفی کن.</h2>
          <p>ققنوس می‌تواند ورودی خام را به عرضه‌ای ساختاریافته و آماده برای کشف و تطبیق تبدیل کند؛ محتوای تولیدشده تا زمان تأیید، پیشنهادی باقی می‌ماند.</p>
        </div>
        <div class="phoenix-seller-flow">
          <div><b>01</b><strong>عکس یا اطلاعات خام</strong></div><span>→</span>
          <div><b>02</b><strong>درک و غنی‌سازی AI</strong></div><span>→</span>
          <div><b>03</b><strong>تأیید فروشنده</strong></div><span>→</span>
          <div><b>04</b><strong>قابل کشف و Match</strong></div>
        </div>
        <a class="text-link" href="/product-studio" data-nav>استودیو محصول ققنوس <span>←</span></a>
      </section>

      <section class="phoenix-final-cta">
        <span class="phoenix-kicker">Ask Phoenix</span>
        <h2>حالا تو بگو چه چیزی نیاز داری.</h2>
        <p class="phoenix-final-cta-copy">از یک جمله ساده شروع کن. ققنوس ادامه مسیر را در فضای کشف باز می‌کند.</p>
        <form class="phoenix-demand-box compact" id="phoenix-demand-form-final">
          <label for="phoenix-demand-input-final" class="sr-only">نیاز خود را بنویسید</label>
          <textarea id="phoenix-demand-input-final" rows="2" placeholder="نیازت را به زبان خودت بنویس..."></textarea>
          <button class="button button-primary" type="submit">از ققنوس بپرس <span>←</span></button>
        </form>
      </section>
      <footer class="phoenix-home-footer">
        <div><a class="phoenix-public-brand" href="/" data-nav aria-label="ققنوس"><span class="brand-mark phoenix-brand-mark" aria-hidden="true"><img src="/phoenix-mark.svg?v=1" alt="" /></span><span><strong>ققنوس</strong><small>Phoenix Intelligence</small></span></a><p>لایه هوشمند تصمیم‌گیری و اتصال مشتری و کسب‌وکار.</p></div>
        <nav aria-label="پیوندهای پایانی"><a href="/discover" data-nav>${uiText("کشف")}</a><a href="/business" data-nav>${uiText("برای کسب‌وکارها")}</a><a href="/product-studio" data-nav>استودیو محصول</a></nav>
      </footer>
    </div>
  `;
}

function bindHomeEvents(): void {
  const draftKey = "phoenix-home-demand-draft";
  const primaryInput = document.querySelector<HTMLTextAreaElement>("#phoenix-demand-input");
  const savedDraft = sessionStorage.getItem(draftKey);
  if (primaryInput && savedDraft && !primaryInput.value) primaryInput.value = savedDraft;
  const submit = (input: HTMLTextAreaElement | null): void => {
    const query = input?.value.trim() ?? "";
    if (!query) { input?.focus(); showToast("اول نیازت را بنویس."); return; }
    sessionStorage.setItem(draftKey, query.slice(0, 800));
    navigate("/discover?q=" + encodeURIComponent(query));
  };
  document.querySelector<HTMLFormElement>("#phoenix-demand-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submit(document.querySelector<HTMLTextAreaElement>("#phoenix-demand-input"));
  });
  document.querySelector<HTMLFormElement>("#phoenix-demand-form-final")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submit(document.querySelector<HTMLTextAreaElement>("#phoenix-demand-input-final"));
  });
  const syncCount = (input: HTMLTextAreaElement | null, counterId: string): void => {
    const counter = document.querySelector<HTMLElement>("#" + counterId);
    if (counter) counter.textContent = `${String(input?.value.trim().length ?? 0)} / 800`;
  };
  primaryInput?.addEventListener("input", () => {
    if (primaryInput.value.length > 800) primaryInput.value = primaryInput.value.slice(0, 800);
    sessionStorage.setItem(draftKey, primaryInput.value);
    syncCount(primaryInput, "phoenix-demand-count");
  });
  if (primaryInput) primaryInput.maxLength = 800;
  if (primaryInput?.value) syncCount(primaryInput, "phoenix-demand-count");
  document.querySelector<HTMLElement>(".phoenix-home")?.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "BUTTON", "A", "SELECT"].includes(target.tagName)) return;
    event.preventDefault();
    primaryInput?.focus();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-phoenix-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.phoenixExample ?? "";
      const input = document.querySelector<HTMLTextAreaElement>("#phoenix-demand-input");
      if (input) { input.value = value; syncCount(input, "phoenix-demand-count"); input.focus(); input.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  });
}

function toDateTimeLocal(value: Date): string {
  const pad = (number: number): string => String(number).padStart(2, "0");
  return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate()) + "T" + pad(value.getHours()) + ":" + pad(value.getMinutes());
}

function renderBooking(): string {
  const params = new URLSearchParams(location.search);
  const scheduleId = params.get("scheduleId")?.trim() ?? "";
  const businessId = params.get("businessId")?.trim() || params.get("business")?.trim() || localStorage.getItem(STORAGE.business) || "";
  const offeringId = params.get("offering")?.trim() || params.get("offeringId")?.trim() || "";
  const customerId = params.get("customerId")?.trim() || localStorage.getItem(STORAGE.customer) || "";
  const resourceId = params.get("resourceId")?.trim() || "";
  const from = params.get("from")?.trim() ?? "";
  const to = params.get("to")?.trim() ?? "";
  const duration = Number(params.get("duration") ?? "60");
  const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.trunc(duration) : 60;
  const fromLocal = from ? toDateTimeLocal(new Date(from)) : toDateTimeLocal(new Date());
  const toLocal = to ? toDateTimeLocal(new Date(to)) : toDateTimeLocal(new Date(Date.now() + 86400000));
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Booking / Availability</span><h1>زمان مناسب را پیدا کنید.</h1><p>Availability از سرویس canonical رزرو خوانده می‌شود؛ انتخاب slot از همین صفحه به Hold canonical متصل می‌شود.</p></div>
    </section>
    <section class="section-block">
      <article class="glass-card booking-panel">
        <div class="booking-context-strip">
          <div><span>${canonicalUi("canonical.business.business")}</span><strong>${escapeHtml(businessId || "—")}</strong></div>
          <div><span>${canonicalUi("canonical.catalog.offering")}</span><strong>${escapeHtml(offeringId || "برای مسیر رزرو مشخص نشده")}</strong></div>
          <div><span>${canonicalUi("canonical.customer.customer")}</span><strong>${escapeHtml(customerId || "از context حساب")}</strong></div>
          <div><span>${canonicalUi("canonical.booking.resource")}</span><strong>${escapeHtml(resourceId || "از Availability")}</strong></div>
        </div>
        <div id="booking-offering-context" class="booking-offering-context" aria-live="polite">
          ${offeringId
            ? '<div class="slot-loading booking-offering-loading">در حال خواندن اطلاعات خدمت از Business منتشرشده…</div>'
            : '<div class="booking-offering-empty">ابتدا یک Service/Offering را انتخاب کنید؛ سپس Availability مناسب همین Business را می‌بینید.</div>'}
        </div>
        <div class="booking-fields">
          <label class="field-label">Schedule ID<input id="booking-schedule" class="studio-input-line" placeholder="Schedule ID" value="${escapeAttr(scheduleId)}" /></label>
          <label class="field-label">Business ID<input id="booking-business" class="studio-input-line" placeholder="Business ID" value="${escapeAttr(businessId)}" /></label>
          <label class="field-label">Offering ID<input id="booking-offering" class="studio-input-line" placeholder="Offering ID (برای finalize)" value="${escapeAttr(offeringId)}" /></label>
          <label class="field-label">Customer ID<input id="booking-customer" class="studio-input-line" placeholder="Customer ID" value="${escapeAttr(customerId)}" /></label>
          <label class="field-label">From<input id="booking-from" class="studio-input-line" type="datetime-local" value="${escapeAttr(fromLocal)}" /></label>
          <label class="field-label">To<input id="booking-to" class="studio-input-line" type="datetime-local" value="${escapeAttr(toLocal)}" /></label>
          <label class="field-label">Duration (minutes)<input id="booking-duration" class="studio-input-line" type="number" min="1" value="${String(safeDuration)}" /></label>
          <label class="field-label">Resource ID<input id="booking-resource" class="studio-input-line" placeholder="Resource ID (اختیاری)" value="${escapeAttr(resourceId)}" /></label>
        </div>
        <div class="booking-action-row">
          <button class="button button-primary" type="button" data-load-slots>خواندن Availability</button>
          <button class="button button-ghost" type="button" data-load-business-schedules>یافتن زمان‌بندی این کسب‌وکار</button>
        </div>
        <div id="booking-schedules-result"></div>
        <div id="booking-hold-result" class="booking-hold-result" aria-live="polite"></div>
        <div id="booking-slots-result" class="slot-empty"><span>◷</span><p>${scheduleId ? "در حال اتصال به Availability…" : offeringId ? "یک Schedule از Availability انتخاب کنید." : "Schedule را وارد کنید."}</p></div>
      </article>
    </section>
  `;
}

type BookingSlotView = {
  slotReference?: string;
  startsAt?: string;
  endsAt?: string;
  remainingCapacity?: number;
  available?: boolean;
  status?: string;
};

type BookingOfferingPreview = {
  id: string;
  businessId: string;
  offeringType: "product" | "service";
  title: string;
  description?: string | null;
  serviceId?: string | null;
  productId?: string | null;
};

type BookingScheduleView = {
  id: string;
  businessId: string;
  locationId?: string | null;
  resourceId?: string | null;
  timezone?: string | null;
  status?: string;
};

async function loadBookingOfferingContext(): Promise<void> {
  const offeringId =
    document.querySelector<HTMLInputElement>("#booking-offering")?.value.trim()
    || new URLSearchParams(location.search).get("offering")?.trim()
    || new URLSearchParams(location.search).get("offeringId")?.trim()
    || "";
  const businessId =
    document.querySelector<HTMLInputElement>("#booking-business")?.value.trim()
    || new URLSearchParams(location.search).get("business")?.trim()
    || new URLSearchParams(location.search).get("businessId")?.trim()
    || localStorage.getItem(STORAGE.business)
    || "";
  const host = document.querySelector<HTMLElement>("#booking-offering-context");
  if (!host || !offeringId) return;
  if (!businessId) {
    host.innerHTML = '<div class="booking-offering-empty"><strong>Business context لازم است.</strong><span>برای رزرو خدمت، این Offering باید به یک Business مشخص متصل باشد.</span></div>';
    return;
  }

  host.innerHTML = '<div class="slot-loading booking-offering-loading">در حال خواندن عرضه منتشرشده…</div>';
  try {
    const response = await fetch("/api/v1/public/businesses/" + encodeURIComponent(businessId), { headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => null) as {
      offers?: BookingOfferingPreview[];
      error?: { message?: string };
    } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Public Business supply unavailable");
    const offers = Array.isArray(body?.offers) ? body.offers : [];
    const offer = offers.find((item) => item.id === offeringId);
    if (!offer) {
      host.innerHTML = '<div class="booking-offering-empty"><strong>این Offering در عرضه عمومی این کسب‌وکار پیدا نشد.</strong><span>شناسه انتخاب‌شده: ' + escapeHtml(offeringId) + ' · مسیر رزرو همچنان از Availability canonical پیروی می‌کند.</span></div>';
      return;
    }

    const kind = offer.offeringType === "service" ? "خدمت" : "محصول";
    host.innerHTML =
      '<div class="booking-offering-card">' +
        '<div class="booking-offering-card-main"><span class="section-kicker">Canonical Public Offering</span><h3>' + escapeHtml(offer.title) + '</h3><p>' + escapeHtml(offer.description ?? "توضیح منتشرشده‌ای برای این عرضه ثبت نشده است.") + '</p></div>' +
        '<div class="booking-offering-card-meta">' +
          '<span class="pill success">' + kind + '</span>' +
          '<span>Offering: <strong>' + escapeHtml(offer.id) + '</strong></span>' +
          (offer.serviceId ? '<span>Service: <strong>' + escapeHtml(offer.serviceId) + '</strong></span>' : '') +
        '</div>' +
      '</div>';
  } catch (error) {
    host.innerHTML = '<div class="booking-offering-empty"><strong>اطلاعات Offering فعلاً قابل خواندن نیست.</strong><span>' + escapeHtml(error instanceof Error ? error.message : "Public Business supply unavailable") + '</span></div>';
  }
}

async function loadBusinessBookingSchedules(): Promise<void> {
  const businessId =
    document.querySelector<HTMLInputElement>("#booking-business")?.value.trim()
    || new URLSearchParams(location.search).get("business")?.trim()
    || localStorage.getItem(STORAGE.business)
    || "";
  const host = document.querySelector<HTMLDivElement>("#booking-schedules-result");
  if (!host) return;
  if (!businessId) {
    host.innerHTML = '<div class="slot-empty"><span>!</span><p>برای پیدا کردن زمان‌بندی، Business ID لازم است.</p></div>';
    return;
  }
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }

  host.innerHTML = '<div class="slot-loading">در حال خواندن Scheduleهای واقعی این کسب‌وکار…</div>';
  try {
    const response = await apiJson<{ data: BookingScheduleView[] }>(
      "/api/v1/availability/schedules?businessId=" + encodeURIComponent(businessId) + "&limit=12",
    );
    const schedules = (response.data ?? []).filter((item) => item.status === undefined || item.status === "active");
    host.innerHTML = schedules.length
      ? '<div class="booking-schedule-picker"><div class="booking-schedule-picker-head"><div><span class="section-kicker">Canonical Availability</span><h3>زمان‌بندی‌های فعال</h3><p>Schedule از Availability خوانده می‌شود؛ این صفحه Schedule جدید ایجاد نمی‌کند.</p></div><span class="pill success">' + String(schedules.length) + ' مورد</span></div><div class="booking-schedule-grid">' +
        schedules.map((schedule) => {
          const currentId = document.querySelector<HTMLInputElement>("#booking-schedule")?.value.trim() ?? "";
          const active = currentId === schedule.id;
          const meta = [
            schedule.locationId ? "Location " + schedule.locationId : "",
            schedule.resourceId ? "Resource " + schedule.resourceId : "",
            schedule.timezone ?? "",
          ].filter(Boolean).join(" · ") || "منبع زمان‌بندی canonical";
          return '<article class="booking-schedule-card' + (active ? ' active' : '') + '">' +
            '<div class="booking-schedule-card-top"><span class="pill' + (active ? ' success' : '') + '">' + (active ? "انتخاب‌شده" : "فعال") + '</span><strong>' + escapeHtml(schedule.id) + '</strong></div>' +
            '<p>' + escapeHtml(meta) + '</p>' +
            '<button class="button ' + (active ? 'button-secondary' : 'button-primary') + '" type="button" data-select-booking-schedule="' + escapeAttr(schedule.id) + '" data-schedule-resource="' + escapeAttr(schedule.resourceId ?? "") + '">' + (active ? "بارگذاری Availability ↻" : "انتخاب این زمان‌بندی →") + '</button>' +
          '</article>';
        }).join("") +
      '</div></div>'
      : '<div class="slot-empty"><span>◌</span><p>برای این Business هنوز Schedule فعال قابل استفاده پیدا نشد.</p></div>';

    host.querySelectorAll<HTMLButtonElement>("[data-select-booking-schedule]").forEach((button) => {
      button.addEventListener("click", () => {
        const scheduleInput = document.querySelector<HTMLInputElement>("#booking-schedule");
        const resourceInput = document.querySelector<HTMLInputElement>("#booking-resource");
        if (scheduleInput) scheduleInput.value = button.dataset.selectBookingSchedule ?? "";
        if (resourceInput) resourceInput.value = button.dataset.scheduleResource ?? "";
        void loadBookingSlots();
        host.querySelectorAll<HTMLElement>(".booking-schedule-card").forEach((card) => card.classList.remove("active"));
        button.closest<HTMLElement>(".booking-schedule-card")?.classList.add("active");
      });
    });
  } catch (error) {
    host.innerHTML = '<div class="slot-empty"><span>!</span><p>' + escapeHtml(error instanceof Error ? error.message : "خواندن Scheduleهای Availability ناموفق بود.") + '</p></div>';
  }
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
  host.innerHTML = '<div class="slot-loading">در حال خواندن Availability…</div>';
  try {
    const response = await apiJson<{ data: BookingSlotView[] }>(
      "/api/v1/availability/schedules/" + encodeURIComponent(scheduleId) + "/slots?from=" + encodeURIComponent(new Date(from).toISOString()) + "&to=" + encodeURIComponent(new Date(to).toISOString()) + "&durationSeconds=" + String(Math.trunc(durationSeconds)),
    );
    host.innerHTML = response.data.length
      ? '<div class="booking-slot-grid">' + response.data.map((slot) => {
          const disabled = slot.available === false || (slot.status !== undefined && slot.status !== "available") || (slot.remainingCapacity !== undefined && slot.remainingCapacity <= 0) || !slot.slotReference;
          const reference = slot.slotReference ?? "";
          return '<article class="booking-slot-card">' +
            '<div class="booking-slot-card-meta"><span>' + escapeHtml(slot.status ?? "available") + '</span>' + (slot.remainingCapacity !== undefined ? '<span>' + String(Math.max(slot.remainingCapacity, 0)) + ' ظرفیت</span>' : '') + '</div>' +
            '<strong>' + escapeHtml(slot.startsAt ?? "—") + '</strong><small>' + escapeHtml(slot.endsAt ?? "—") + '</small>' +
            (disabled ? '<span class="pill warning">قابل رزرو نیست</span>' : '<button class="button button-primary booking-slot-action" type="button" data-book-slot="' + escapeAttr(reference) + '">گرفتن نوبت</button>') +
            '</article>';
        }).join("") + '</div>'
      : '<div class="slot-empty"><span>◌</span><p>در این بازه slot قابل‌نمایشی پیدا نشد.</p></div>';
    host.querySelectorAll<HTMLButtonElement>("[data-book-slot]").forEach((button) => {
      button.addEventListener("click", () => void createBookingHold(button.dataset.bookSlot ?? "", button));
    });
  } catch (error) {
    host.innerHTML = `<div class="slot-empty"><span>!</span><p>${escapeHtml(error instanceof Error ? error.message : "خواندن Availability ناموفق بود.")}</p></div>`;
  }
}

async function createBookingHold(slotReference: string, button: HTMLButtonElement): Promise<void> {
  const businessId = document.querySelector<HTMLInputElement>("#booking-business")?.value.trim() || localStorage.getItem(STORAGE.business) || "";
  const resourceId = document.querySelector<HTMLInputElement>("#booking-resource")?.value.trim() || "";
  const result = document.querySelector<HTMLElement>("#booking-hold-result");
  if (!result) return;
  if (!businessId || !slotReference) {
    result.innerHTML = '<div class="connection-state error">Business ID و slot reference برای Hold لازم است.</div>';
    return;
  }
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }
  button.disabled = true;
  button.textContent = "در حال رزرو موقت…";
  result.innerHTML = '<div class="connection-state">در حال ایجاد Hold canonical…</div>';
  try {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const response = await apiJson<{ data: { id: string; status: string; expiresAt: string; slotReference: string } }>("/api/v1/booking/holds", {
      method: "POST",
      body: { businessId, slotReference, ...(resourceId ? { resourceId } : {}), expiresAt },
    });
    result.innerHTML = '<div class="connection-state success"><strong>Slot موقتاً نگه داشته شد.</strong><span>Hold: ' + escapeHtml(response.data.id) + '</span><span>وضعیت: ' + escapeHtml(response.data.status) + '</span><span>انقضا: ' + escapeHtml(response.data.expiresAt) + '</span><p>مرحله finalize به اطلاعات معتبر Offering/price snapshot وابسته است و تا قبل از دریافت آن خودکار اجرا نمی‌شود.</p></div>';
    button.textContent = "Hold ایجاد شد ✓";
  } catch (error) {
    button.disabled = false;
    button.textContent = "گرفتن نوبت";
    result.innerHTML = '<div class="connection-state error">' + escapeHtml(error instanceof Error ? error.message : "ایجاد Hold ناموفق بود.") + '</div>';
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
      <div><span class="eyebrow"><i></i> ${canonicalUi("canonical.billing.plan")} & Billing</span><h1>هزینه و ارزش را <em>شفاف</em> ببینید.</h1><p>Plans و invoices از Billing canonical خوانده می‌شوند؛ frontend محاسبه مالی انجام نمی‌دهد.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-load-billing>بروزرسانی</button></div>
    </section>
    <section class="billing-grid">
      <article class="glass-card billing-card">
        <div class="card-section-heading"><div><span class="section-kicker">Plans</span><h2>طرح‌های فعال</h2></div><span id="billing-plan-meta">—</span></div>
        <div id="billing-plans" class="plan-list"><div class="slot-empty"><span>◈</span><p>در حال بارگذاری…</p></div></div>
      </article>
      <article class="glass-card billing-card">
        <div class="card-section-heading"><div><span class="section-kicker">Invoices</span><h2>${canonicalUi("canonical.billing.invoice")}</h2></div><span id="billing-invoice-meta">—</span></div>
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
      <div><span class="eyebrow"><i></i> ${canonicalUi("canonical.communication.conversation")} Center</span><h1>پیام درست، <em>در زمان درست.</em></h1><p>ارسال notification و مدیریت preference از قرارداد canonical Communication انجام می‌شود.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-comm-load>بارگذاری وضعیت</button></div>
    </section>
    <section class="communication-grid">
      <article class="glass-card communication-card">
        <div class="card-section-heading"><div><span class="section-kicker">${canonicalUi("canonical.communication.notification")}</span><h2>${canonicalUi("canonical.communication.message")}</h2></div><span id="comm-status" class="pill">آماده</span></div>
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
      <div><span class="eyebrow"><i></i> ${canonicalUi("canonical.customer.customer")} & CRM</span><h1>رابطه را بشناسید، <em>دوباره ارزش بسازید.</em></h1><p>پروفایل، ترجیحات و timeline مشتری از قراردادهای canonical Customer/CRM خوانده می‌شوند.</p></div>
      <div class="heading-actions">
        <button class="button button-ghost" type="button" data-customer-refresh>بروزرسانی</button>
        <button class="button button-primary" type="button" data-customer-create>${customerId ? "مشتری جدید" : "ایجاد مشتری"}</button>
      </div>
    </section>
    <section class="customer-grid">
      <article class="glass-card customer-profile-card">
        <div class="card-section-heading"><div><span class="section-kicker">Profile</span><h2>${canonicalUi("canonical.customer.customerProfile")}</h2></div><span id="customer-status" class="pill">در حال بررسی</span></div>
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
          <div class="account-row"><span>${canonicalUi("canonical.customer.customer")} ID</span><strong id="customer-id-display">${escapeHtml(customerId || "—")}</strong></div>
          <div class="account-row"><span>Workspace</span><strong>${escapeHtml(localStorage.getItem(STORAGE.workspace) ?? "—")}</strong></div>
          <div class="account-row"><span>${canonicalUi("canonical.business.business")}</span><strong>${escapeHtml(localStorage.getItem(STORAGE.business) ?? "—")}</strong></div>
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


function renderProfile(): string {
  return '<div class="phoenix-profile-page">' +
    '<section class="phoenix-profile-cover">' +
      '<div class="phoenix-profile-cover-art"></div>' +
      '<div class="phoenix-profile-identity">' +
        '<div class="phoenix-profile-avatar"><img src="/phoenix-mark.svg?v=1" alt="" /></div>' +
        '<div class="phoenix-profile-name"><span class="phoenix-kicker">Profile</span><h1 id="profile-name">کاربر ققنوس</h1><p id="profile-subtitle">هویت شخصی · در حال خواندن context</p></div>' +
        '<button class="button button-primary" type="button" data-profile-refresh>بروزرسانی</button>' +
      '</div>' +
    '</section>' +
    '<section class="phoenix-profile-grid">' +
      '<article class="glass-card phoenix-profile-card phoenix-profile-trust"><div class="card-section-heading"><div><span class="section-kicker">Identity & Trust</span><h2>هویت و اعتماد</h2></div><span id="profile-trust-status" class="pill">—</span></div><div class="phoenix-profile-facts" id="profile-facts"><div><span>Actor</span><strong>—</strong></div><div><span>Tenant</span><strong>—</strong></div><div><span>Workspace</span><strong>—</strong></div></div></article>' +
      '<article class="glass-card phoenix-profile-card"><div class="card-section-heading"><div><span class="section-kicker">Progress</span><h2>رشد و رتبه</h2></div><span class="pill warning">داده کافی نیست</span></div><div class="phoenix-profile-progress"><div class="phoenix-progress-ring"><span>—</span></div><div><strong>امتیاز و رتبه</strong><p>این مقادیر فقط پس از اتصال به منبع canonical نمایش داده می‌شوند.</p></div></div></article>' +
      '<article class="glass-card phoenix-profile-card"><div class="card-section-heading"><div><span class="section-kicker">Activity</span><h2>فعالیت من</h2></div><a class="text-link" href="/notifications" data-nav>اعلان‌ها ←</a></div><div class="phoenix-profile-activity" id="profile-activity"><div class="phoenix-profile-activity-row"><span>اعلان‌های خوانده‌نشده</span><strong>—</strong></div><div class="phoenix-profile-activity-row"><span>رویدادهای اجتماعی</span><strong>—</strong></div><div class="phoenix-profile-activity-row"><span>معاملات</span><strong>—</strong></div></div></article>' +
      '<article class="glass-card phoenix-profile-card phoenix-profile-credit"><div class="card-section-heading"><div><span class="section-kicker">Internal Credit</span><h2>اعتبار داخلی</h2></div><span class="pill">محافظت‌شده</span></div><div class="phoenix-credit-lock"><span>◈</span><div><strong>اطلاعات اعتباری</strong><p>فقط داده‌ای نمایش داده می‌شود که از منبع مالی canonical و با مجوز لازم برگردد.</p></div></div></article>' +
    '</section>' +
  '</div>';
}

async function loadProfilePage(): Promise<void> {
  const name = document.querySelector<HTMLElement>("#profile-name");
  const subtitle = document.querySelector<HTMLElement>("#profile-subtitle");
  const trust = document.querySelector<HTMLElement>("#profile-trust-status");
  const facts = document.querySelector<HTMLElement>("#profile-facts");
  const activity = document.querySelector<HTMLElement>("#profile-activity");
  const refresh = document.querySelector<HTMLButtonElement>("[data-profile-refresh]");
  if (refresh) refresh.onclick = () => { void loadProfilePage(); };
  if (!name || !subtitle || !trust || !facts || !activity) return;
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    trust.textContent = "ورود لازم است";
    trust.className = "pill warning";
    subtitle.textContent = "برای نمایش هویت و فعالیت، ابتدا وارد شوید.";
    return;
  }
  try {
    const [context, notifications] = await Promise.all([
      apiJson<{ authenticated: boolean; actorId?: string; tenantId?: string; workspaceId?: string }>("/api/v1/context"),
      apiJson<{ data: NotificationView[] }>("/api/v1/notifications?limit=30"),
    ]);
    const items = Array.isArray(notifications.data) ? notifications.data : [];
    const unread = items.filter((item) => !getReadNotificationIds().has(item.id)).length;
    name.textContent = "کاربر ققنوس";
    subtitle.textContent = context.workspaceId ? "عضو فضای کاری · " + compactId(context.workspaceId) : "حساب شخصی ققنوس";
    trust.textContent = context.authenticated ? "متصل" : "احراز نشده";
    trust.className = context.authenticated ? "pill success" : "pill warning";
    facts.innerHTML = '<div><span>Actor</span><strong>' + escapeHtml(context.actorId ?? "—") + '</strong></div>' +
      '<div><span>Tenant</span><strong>' + escapeHtml(context.tenantId ?? "—") + '</strong></div>' +
      '<div><span>Workspace</span><strong>' + escapeHtml(context.workspaceId ?? "—") + '</strong></div>';
    activity.innerHTML = '<div class="phoenix-profile-activity-row"><span>اعلان‌های خوانده‌نشده</span><strong>' + String(unread) + '</strong></div>' +
      '<div class="phoenix-profile-activity-row"><span>رویدادهای اجتماعی</span><strong>از فعالیت canonical خوانده می‌شود</strong></div>' +
      '<div class="phoenix-profile-activity-row"><span>معاملات</span><strong>از Commerce canonical خوانده می‌شود</strong></div>';
  } catch (error) {
    trust.textContent = "خطا";
    trust.className = "pill warning";
    subtitle.textContent = error instanceof Error ? error.message : "خواندن پروفایل ناموفق بود.";
  }
}

function renderNotifications(): string {
  return '<div class="phoenix-notifications-page">' +
    '<section class="page-heading"><div><span class="eyebrow"><i></i> Notification Center</span><h1>چیزهایی که لازم است <em>بدانی.</em></h1><p>پیام‌ها، پیشنهادهای ققنوس و تغییر وضعیت معامله را در یک فضای آرام و قابل‌فهم ببین.</p></div><button class="button button-primary" type="button" data-refresh-notifications>بروزرسانی</button></section>' +
    '<section class="phoenix-notification-tabs" aria-label="دسته اعلان‌ها"><button class="active" type="button">همه</button><button type="button">مهم</button><button type="button">پیام‌ها</button><button type="button">معاملات</button></section>' +
    '<section class="glass-card phoenix-notifications-card"><div class="phoenix-notifications-heading"><div><span class="section-kicker">Live</span><h2>${canonicalUi("canonical.communication.notification")}‌های شما</h2></div><span id="notifications-page-count" class="pill">—</span></div><div id="notifications-page-list" class="notification-list"><div class="slot-loading">در حال بارگذاری…</div></div></section>' +
  '</div>';
}

async function loadNotificationsPage(): Promise<void> {
  const host = document.querySelector<HTMLElement>("#notifications-page-list");
  const count = document.querySelector<HTMLElement>("#notifications-page-count");
  const refresh = document.querySelector<HTMLButtonElement>("[data-refresh-notifications]");
  if (refresh) refresh.onclick = () => { void loadNotificationsPage(); };
  if (!host || !count) return;
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    host.innerHTML = '<div class="slot-empty"><span>♢</span><p>برای دیدن اعلان‌ها باید وارد شوید.</p></div>';
    count.textContent = "ورود";
    return;
  }
  try {
    const response = await apiJson<{ data: NotificationView[] }>("/api/v1/notifications?limit=50");
    const items = Array.isArray(response.data) ? response.data : [];
    const readIds = getReadNotificationIds();
    const renderRows = () => {
      const currentRead = getReadNotificationIds();
      host.innerHTML = items.length ? items.map((item) => '<article class="notification-item ' + (currentRead.has(item.id) ? "read" : "unread") + '">' +
        '<div class="notification-item-icon">' + (item.channel === "in_app" ? "♢" : "◌") + '</div>' +
        '<div class="notification-item-copy"><div class="notification-item-top"><strong>' + escapeHtml(item.intent ?? "notification") + '</strong><span>' + escapeHtml(item.priority ?? "normal") + '</span></div><p>' + escapeHtml(notificationSummary(item)) + '</p><small>' + escapeHtml(formatDate(item.createdAt)) + ' · ' + escapeHtml(item.status ?? "created") + '</small></div>' +
        '<button class="notification-read" type="button" data-page-mark-read="' + escapeAttr(item.id) + '">' + (currentRead.has(item.id) ? "خوانده شد" : "خواندم") + '</button>' +
      '</article>').join("") : '<div class="slot-empty"><span>♢</span><p>اعلان جدیدی برای این حساب ثبت نشده است.</p></div>';
      count.textContent = items.filter((item) => !currentRead.has(item.id)).length + " خوانده‌نشده";
      host.querySelectorAll<HTMLButtonElement>("[data-page-mark-read]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.pageMarkRead;
        if (!id) return;
        markNotificationReadLocally(id);
        renderRows();
      }));
    };
    void readIds;
    renderRows();
  } catch (error) {
    host.innerHTML = '<div class="slot-empty"><span>!</span><p>' + escapeHtml(error instanceof Error ? error.message : "خواندن اعلان‌ها ناموفق بود.") + '</p></div>';
    count.textContent = "خطا";
  }
}

function renderTransactions(): string {
  return '<div class="phoenix-transactions-page">' +
    '<section class="page-heading"><div><span class="eyebrow"><i></i> Transactions</span><h1>هر معامله، یک <em>مسیر روشن.</em></h1><p>خرید، فروش، اجاره، معاوضه، مزایده و مناقصه در یک زبان واحد؛ جزئیات هر جریان از قابلیت canonical همان حوزه می‌آید.</p></div></section>' +
    '<section class="phoenix-transaction-types">' +
      '<a class="glass-card phoenix-transaction-type" href="/discover?q=' + encodeURIComponent("خرید") + '" data-nav><span>🛒</span><strong>خرید</strong><small>نیاز → جستجو → مقایسه → پرداخت</small></a>' +
      '<a class="glass-card phoenix-transaction-type" href="/product-studio" data-nav><span>↗</span><strong>فروش</strong><small>عرضه → معرفی → مذاکره → تکمیل</small></a>' +
      '<a class="glass-card phoenix-transaction-type" href="/discover?q=' + encodeURIComponent("اجاره") + '" data-nav><span>⌂</span><strong>اجاره</strong><small>درخواست → بررسی شرایط → انتخاب</small></a>' +
      '<a class="glass-card phoenix-transaction-type" href="/discover?q=' + encodeURIComponent("معاوضه") + '" data-nav><span>⇄</span><strong>معاوضه</strong><small>دارایی A + دارایی B → توافق</small></a>' +
      '<button class="glass-card phoenix-transaction-type" type="button" data-toast="جریان مزایده هنوز UI اجرایی مستقل ندارد؛ این قابلیت بعد از فعال شدن canonical workflow نمایش داده می‌شود."><span>⌁</span><strong>مزایده</strong><small>تعریف مورد → پیشنهادها → انتخاب برنده</small></button>' +
      '<button class="glass-card phoenix-transaction-type" type="button" data-toast="جریان مناقصه هنوز UI اجرایی مستقل ندارد؛ این قابلیت بعد از فعال شدن canonical workflow نمایش داده می‌شود."><span>▥</span><strong>مناقصه</strong><small>تعریف نیاز → پیشنهادها → ارزیابی</small></button>' +
    '</section>' +
    '<section class="phoenix-order-lookup"><article class="glass-card phoenix-order-lookup-card"><div class="card-section-heading"><div><span class="section-kicker">Commerce</span><h2>پیگیری یک سفارش / معامله</h2></div><span id="transaction-status" class="pill">آماده</span></div><div class="phoenix-order-lookup-form"><input id="transaction-order-id" class="studio-input-line" placeholder="Order ID" /><button class="button button-primary" type="button" data-transaction-load>مشاهده وضعیت <span>←</span></button></div><div id="transaction-order-result" class="phoenix-transaction-result"><div class="slot-empty"><span>↔</span><p>Order ID را وارد کنید تا وضعیت canonical Commerce نمایش داده شود.</p></div></div></article></section>' +
  '</div>';
}

async function loadTransactionsPage(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>("[data-transaction-load]");
  const input = document.querySelector<HTMLInputElement>("#transaction-order-id");
  const host = document.querySelector<HTMLElement>("#transaction-order-result");
  const status = document.querySelector<HTMLElement>("#transaction-status");
  if (!button || !input || !host || !status) return;
  const queryOrder = new URLSearchParams(location.search).get("order") ?? "";
  if (queryOrder) input.value = queryOrder;
  button.addEventListener("click", async () => {
    const orderId = input.value.trim();
    if (!orderId) { showToast("Order ID لازم است."); return; }
    if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
    status.textContent = "در حال خواندن";
    status.className = "pill";
    host.innerHTML = '<div class="slot-loading">در حال خواندن Commerce…</div>';
    try {
      const response = await apiJson<{ data: { order: Record<string, unknown>; lines: Array<Record<string, unknown>> } }>("/api/v1/commerce/orders/" + encodeURIComponent(orderId));
      const order = response.data.order;
      const lines = response.data.lines ?? [];
      status.textContent = String(order.status ?? "unknown");
      status.className = order.status === "completed" ? "pill success" : "pill warning";
      host.innerHTML = '<div class="phoenix-order-head"><div><span>Order</span><strong>' + escapeHtml(String(order.id ?? orderId)) + '</strong></div><span class="pill">' + escapeHtml(String(order.status ?? "unknown")) + '</span></div>' +
        '<div class="phoenix-order-facts"><div><span>Currency</span><strong>' + escapeHtml(String(order.currency ?? "—")) + '</strong></div><div><span>Subtotal</span><strong>' + escapeHtml(String(order.subtotalMinor ?? "—")) + '</strong></div><div><span>Total</span><strong>' + escapeHtml(String(order.grandTotalMinor ?? "—")) + '</strong></div><div><span>Created</span><strong>' + escapeHtml(formatDate(String(order.createdAt ?? ""))) + '</strong></div></div>' +
        '<div class="phoenix-order-lines">' + (lines.length ? lines.map((line) => '<div><strong>' + escapeHtml(String(line.descriptionSnapshot ?? line.resourceId ?? "آیتم سفارش")) + '</strong><span>' + escapeHtml(String(line.quantity ?? "—")) + ' × ' + escapeHtml(String(line.unitPriceMinorSnapshot ?? "—")) + '</span></div>').join("") : '<div class="slot-empty"><span>◌</span><p>خطی برای این سفارش ثبت نشده است.</p></div>') + '</div>';
    } catch (error) {
      status.textContent = "یافت نشد";
      status.className = "pill warning";
      host.innerHTML = '<div class="slot-empty"><span>!</span><p>' + escapeHtml(error instanceof Error ? error.message : "خواندن سفارش ناموفق بود.") + '</p></div>';
    }
  });
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


function renderSocialHeader(active: "feed" | "following" | "explore" | "activity"): string {
  return '<header class="phoenix-social-header"><div class="phoenix-social-header-inner">' +
    '<a class="phoenix-public-brand" href="/" data-nav aria-label="ققنوس"><span class="brand-mark phoenix-brand-mark"><img src="/phoenix-mark.svg?v=1" alt="" /></span><span><strong>ققنوس</strong><small>Phoenix Social Commerce</small></span></a>' +
    '<nav class="phoenix-social-tabs" aria-label="ناوبری اجتماعی">' +
    '<a href="/discover" data-nav class="' + (active === "feed" ? "active" : "") + '">برای تو</a>' +
    '<a href="/discover?tab=following" data-nav class="' + (active === "following" ? "active" : "") + '">دنبال‌شده‌ها</a>' +
    '<a href="/discover?tab=explore" data-nav class="' + (active === "explore" ? "active" : "") + '">اکسپلور</a>' +
    '<a href="/activity" data-nav class="' + (active === "activity" ? "active" : "") + '">فعالیت</a></nav>' +
    '<div class="phoenix-social-actions"><button class="icon-button" type="button" data-open-create-post aria-label="' + uiText("پست جدید") + '">＋</button>' + renderLanguageSwitcher() + '<button class="icon-button" type="button" data-theme-toggle aria-label="' + uiText("تغییر پوسته") + '">◐</button></div>' +
    '</div></header>';
}

function renderSocialMobileNav(): string {
  return '<nav class="phoenix-social-mobile-nav" aria-label="ناوبری اجتماعی موبایل">' +
    '<a href="/discover" data-nav>⌂<small>خانه</small></a><a href="/discover?tab=explore" data-nav>⌕<small>اکسپلور</small></a>' +
    '<button type="button" data-open-create-post aria-label="ایجاد">＋</button><a href="/activity" data-nav>✦<small>فعالیت</small></a><a href="/profile" data-nav>◉<small>پروفایل</small></a></nav>';
}

function renderSocialPosts(items: DiscoveryResult[]): string {
  activeDiscoveryItems = items;
  if (!items.length) return '<div class="glass-card social-empty-state"><div class="draft-orb">⌕</div><h3>هنوز نتیجه‌ای برای این مسیر پیدا نشده است.</h3><p>نیازت را دقیق‌تر بنویس یا از اکسپلور برای مرور عرضه‌های واقعی استفاده کن.</p><a class="button button-primary" href="/discover?tab=explore" data-nav>رفتن به اکسپلور</a></div>';
  return items.map((item, index) => {
    const titleRaw = item.title ?? item.displayName ?? item.name ?? "محصول یا خدمت";
    const title = escapeHtml(titleRaw);
    const description = escapeHtml(item.description ?? item.body ?? "اطلاعات این عرضه در ققنوس ثبت شده است.");
    const locality = escapeHtml(item.locality ?? item.city ?? "در شبکه ققنوس");
    const key = item.id ?? item.sourceId ?? "";
    const sourceType = item.sourceType ?? String(item.metadata?.offeringType ?? "product");
    const compared = getCompareItems().some((entry) => (entry.id ?? entry.sourceId) === key && Boolean(key));
    const followed = isSocialActive("follow", item);
    const liked = isSocialActive("like", item);
    const saved = isSocialActive("save", item);
    const rawPrice = item.price;
    const price = rawPrice !== undefined && rawPrice !== null
      ? Number(rawPrice).toLocaleString("fa-IR") + " " + escapeHtml(item.currency ?? "")
      : "قیمت را بپرس";
    const typeLabel = sourceType === "service" ? "خدمت" : sourceType === "business" ? "کسب‌وکار" : "محصول";
    const authorName = item.metadata && typeof item.metadata.businessName === "string" ? item.metadata.businessName : sourceType === "business" ? titleRaw : "فروشنده ققنوس";
    const canFollow = Boolean(item.metadata && typeof item.metadata.businessId === "string") || sourceType === "business";
    const followLabel = followed ? "دنبال می‌کنی" : "دنبال کردن";
    const businessId = item.metadata && typeof item.metadata.businessId === "string" ? item.metadata.businessId : "";
    const publicAction = sourceType === "business"
      ? '<a class="button button-primary post-buy" href="/businesses/' + encodeURIComponent(item.sourceId ?? item.id ?? "") + '" data-nav>مشاهده کسب‌وکار <span>←</span></a>'
      : sourceType === "service"
        ? '<a class="button button-primary post-buy" href="/booking?offering=' + encodeURIComponent(item.sourceId ?? item.id ?? "") + (businessId ? '&businessId=' + encodeURIComponent(businessId) : '') + '" data-nav>بررسی رزرو <span>←</span></a>'
        : '<a class="button button-primary post-buy" href="/checkout?product=' + encodeURIComponent(item.sourceId ?? item.id ?? "") + '" data-nav>خرید آنی <span>←</span></a>';
    const followButton = canFollow
      ? '<button type="button" class="post-follow' + (followed ? ' selected' : '') + '" data-follow="' + escapeAttr(key) + '">' + followLabel + '</button>'
      : '<span class="post-follow post-follow-disabled">فروشنده</span>';
    return '<article class="phoenix-post-card">' +
      '<header class="phoenix-post-author"><span class="phoenix-avatar phoenix-avatar-image">' + (index % 2 ? "س" : "ق") + '</span><div><strong>' + escapeHtml(authorName) + '</strong><small>' + locality + ' · ' + escapeHtml(typeLabel) + '</small></div>' + followButton + '</header>' +
      '<button type="button" class="phoenix-post-media media-'+(index%3)+'" data-discovery-index="' + index + '" aria-label="' + title + '"><span class="post-media-badge">' + typeLabel + '</span><strong>' + title + '</strong><small>مشاهده جزئیات و تصمیم</small></button>' +
      '<div class="phoenix-post-body"><div class="phoenix-post-meta"><span class="phoenix-post-type">' + typeLabel + '</span><span>⌖ ' + locality + '</span></div><h2>' + title + '</h2><p>' + description + '</p><div class="phoenix-post-price">' + price + '</div>' +
      '<div class="phoenix-post-actions">' +
      '<button type="button" class="social-action' + (liked ? ' selected' : '') + '" data-like="' + escapeAttr(key) + '">♡ <span>' + (liked ? "پسندیده شد" : "پسندیدن") + '</span></button>' +
      '<button type="button" class="social-action" data-comment="' + escapeAttr(key) + '">◌ <span>نظر</span></button>' +
      '<button type="button" class="social-action' + (saved ? ' selected' : '') + '" data-save="' + escapeAttr(key) + '">⌑ <span>' + (saved ? "ذخیره شد" : "ذخیره") + '</span></button>' +
      '<button type="button" class="social-action" data-share="' + escapeAttr(key) + '">↗ <span>اشتراک</span></button>' +
      (sourceType === "product" ? '<button type="button" class="social-action ' + (compared ? "selected" : "") + '" data-compare="' + escapeAttr(key) + '">⚖ <span>' + (compared ? "انتخاب شد" : "مقایسه") + '</span></button>' : '') +
      (sourceType === "service" ? '<button type="button" class="social-action" data-open-view="' + escapeAttr(key) + '">◉ <span>مشاهده</span></button>' : '') +
      publicAction + '</div></div></article>';
  }).join("");
}
function isComparableProduct(item: DiscoveryResult): boolean {
  return (item.sourceType ?? "product") === "product" && Boolean(item.sourceId ?? item.id);
}

function getCompareItems(): DiscoveryResult[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("phoenix-compare-items") ?? "[]");
    const items = Array.isArray(parsed) ? parsed.filter((item): item is DiscoveryResult => Boolean(item) && typeof item === "object") : [];
    return items.filter(isComparableProduct).slice(0, 4);
  } catch { return []; }
}

function saveCompareItems(items: DiscoveryResult[]): void {
  localStorage.setItem("phoenix-compare-items", JSON.stringify(items.filter(isComparableProduct).slice(-4)));
}

function toggleCompare(item: DiscoveryResult): void {
  if (!isComparableProduct(item)) { showToast("فقط محصولات قابل مقایسه هستند."); return; }
  const key = item.id ?? item.sourceId ?? "";
  const current = getCompareItems();
  const exists = current.some((entry) => (entry.id ?? entry.sourceId) === key);
  if (exists) saveCompareItems(current.filter((entry) => (entry.id ?? entry.sourceId) !== key));
  else if (current.length < 4) saveCompareItems([...current, item]);
  else showToast("مقایسه حداکثر ۴ محصول را پشتیبانی می‌کند.");
}

function toggleCompareByKey(key: string): void {
  const item = activeDiscoveryItems.find((entry) => (entry.id ?? entry.sourceId) === key);
  if (item) toggleCompare(item);
}

async function shareSocialItem(item: DiscoveryResult): Promise<void> {
  const title = item.title ?? item.displayName ?? item.name ?? "مورد ققنوس";
  const type = item.sourceType ?? String(item.metadata?.offeringType ?? "product");
  const id = item.sourceId ?? item.id ?? "";
  const businessId = item.metadata && typeof item.metadata.businessId === "string" ? item.metadata.businessId : "";
  const url = type === "business" && id
    ? new URL("/businesses/" + encodeURIComponent(id), location.origin).toString()
    : type === "service" && id
      ? new URL("/booking?offering=" + encodeURIComponent(id) + (businessId ? "&businessId=" + encodeURIComponent(businessId) : ""), location.origin).toString()
      : id
        ? new URL("/checkout?product=" + encodeURIComponent(id), location.origin).toString()
        : location.href;
  const payload = { title, text: "این گزینه را در ققنوس ببین.", url };
  try {
    if (navigator.share) {
      await navigator.share(payload);
      showToast("صفحه برای اشتراک‌گذاری آماده شد.");
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showToast("لینک ققنوس کپی شد.");
    } else {
      window.prompt("لینک ققنوس را کپی کنید:", url);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast("لینک ققنوس کپی شد.");
      } else {
        window.prompt("لینک ققنوس را کپی کنید:", url);
      }
    } catch {
      showToast("اشتراک‌گذاری این مورد در مرورگر فعلی ممکن نیست.");
    }
  }
}

function renderCompareTray(): void {
  const host = document.querySelector<HTMLElement>("#phoenix-compare-tray");
  if (!host) return;
  const items = getCompareItems();
  if (items.length < 2) {
    host.innerHTML = items.length === 1
      ? '<div class="phoenix-compare-tray glass-card"><div class="phoenix-compare-items"><span>' + escapeHtml(items[0]?.title ?? items[0]?.name ?? "محصول") + '</span></div><span class="compare-tray-hint">یک محصول دیگر انتخاب کن.</span></div>'
      : "";
    return;
  }
  host.innerHTML = '<div class="phoenix-compare-tray glass-card"><div class="phoenix-compare-items">' +
    items.map((item) => '<span>' + escapeHtml(item.title ?? item.displayName ?? item.name ?? "محصول") + '<button type="button" data-remove-compare="' + escapeAttr(item.id ?? item.sourceId ?? "") + '" aria-label="حذف از مقایسه">×</button></span>').join("") +
    '</div><button class="button button-primary" type="button" data-open-compare>⚖ مقایسه ' + items.length + ' محصول</button></div>';
  host.querySelectorAll<HTMLButtonElement>("[data-remove-compare]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleCompareByKey(button.dataset.removeCompare ?? "");
    renderCompareTray();
    refreshSocialFeed();
  }));
  host.querySelector<HTMLButtonElement>("[data-open-compare]")?.addEventListener("click", () => navigate("/compare"));
}


function renderActivity(): string {
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    return '<div class="phoenix-activity-page"><section class="phoenix-section-heading"><span class="phoenix-kicker">Activity</span><h1>فعالیت‌های ققنوس</h1><p>برای دیدن Follow، Like، Save و Commentهای ثبت‌شده، ابتدا به حساب متصل شوید.</p></section><div class="glass-card phoenix-activity-gate"><div class="draft-orb">✦</div><h2>فعالیت شخصی شما</h2><p>این سطح فقط رویدادهای واقعی Social Engagement را نمایش می‌دهد.</p><button class="button button-primary" type="button" data-activity-connect>اتصال حساب</button></div></div>';
  }
  return '<div class="phoenix-activity-page"><section class="phoenix-section-heading"><div><span class="phoenix-kicker">Activity</span><h1>ردپای اجتماعی تو در ققنوس</h1><p>رویدادها مستقیماً از Social Engagement خوانده می‌شوند؛ این صفحه timeline جداگانه‌ای در مرورگر نمی‌سازد.</p></div><div class="heading-actions"><button class="button button-ghost" type="button" data-activity-refresh>↻ بروزرسانی</button><a class="button button-primary" href="/discover" data-nav>ادامه کشف ←</a></div></section><section class="phoenix-activity-layout"><article class="glass-card phoenix-activity-card"><div class="card-section-heading"><div><span class="section-kicker">Canonical Social Events</span><h2>آخرین فعالیت‌ها</h2></div><span id="activity-status" class="pill" aria-live="polite">در حال آماده‌سازی</span></div><div id="activity-list" class="phoenix-activity-list" aria-live="polite" aria-busy="true"><div class="slot-loading">در حال خواندن فعالیت‌های واقعی…</div></div></article><aside class="glass-card phoenix-activity-side"><span class="section-kicker">Your loop</span><h2>دنبال کن، ذخیره کن، مقایسه کن.</h2><p>فعالیت‌های اجتماعی در کنار Discovery و Compare برای تصمیم‌گیری پیوسته استفاده می‌شوند؛ ranking و recommendation همچنان در backend canonical باقی می‌مانند.</p><a class="button button-ghost" href="/compare" data-nav>مقایسه‌های انتخاب‌شده</a></aside></section></div>';
}

async function loadActivityPage(): Promise<void> {
  const connect = document.querySelector<HTMLButtonElement>("[data-activity-connect]");
  if (connect) {
    connect.addEventListener("click", () => openConnectionPanel());
    return;
  }
  const host = document.querySelector<HTMLElement>("#activity-list");
  const status = document.querySelector<HTMLElement>("#activity-status");
  const refresh = document.querySelector<HTMLButtonElement>("[data-activity-refresh]");
  if (!host || !status) return;

  const renderRows = (items: unknown[]): void => {
    host.setAttribute("aria-busy", "false");
    if (!items.length) {
      host.innerHTML = '<div class="social-empty-state"><div class="draft-orb">✦</div><h3>هنوز فعالیتی ثبت نشده است.</h3><p>از Discover یک کسب‌وکار را دنبال کن یا یک محصول را Like/Save کن تا رویداد واقعی اینجا دیده شود.</p><a class="button button-ghost" href="/discover?tab=explore" data-nav>رفتن به اکسپلور</a></div>';
      status.textContent = "خالی";
      status.className = "pill";
      return;
    }
    host.innerHTML = items.map((item) => {
      const event = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const eventType = String(event.eventType ?? "social.event");
      let payload: Record<string, unknown> = {};
      const rawPayload = event.payloadJson ?? event.payload;
      if (typeof rawPayload === "string") {
        try { const parsed = JSON.parse(rawPayload); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>; } catch { /* ignore */ }
      } else if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
        payload = rawPayload as Record<string, unknown>;
      }
      const targetType = String(payload.targetType ?? event.aggregateType ?? "");
      const targetId = String(payload.targetId ?? event.aggregateId ?? "");
      const occurredAt = String(event.occurredAt ?? event.createdAt ?? "");
      const targetLabel = targetType && targetId ? targetType + " · " + targetId : "رویداد اجتماعی ققنوس";
      const businessId = String(payload.businessId ?? "");
      const targetHref = targetType === "business" && targetId
        ? "/businesses/" + encodeURIComponent(targetId)
        : targetType === "service" && targetId
          ? "/booking?offering=" + encodeURIComponent(targetId) + (businessId ? "&businessId=" + encodeURIComponent(businessId) : "")
          : targetType === "product" && targetId
            ? "/checkout?product=" + encodeURIComponent(targetId)
            : "";
      return '<article class="phoenix-activity-row"><div class="phoenix-activity-icon">✦</div><div class="phoenix-activity-copy"><strong>' + escapeHtml(socialActivityLabel(eventType)) + '</strong><p>' + escapeHtml(targetLabel) + '</p><small>' + escapeHtml(formatDate(occurredAt)) + '</small></div>' + (targetHref ? '<a class="button button-ghost" href="' + escapeAttr(targetHref) + '" data-nav>باز کردن</a>' : '') + '</article>';
    }).join("");
    status.textContent = String(items.length) + " رویداد";
    status.className = "pill success";
  };

  const load = async (): Promise<void> => {
    host.setAttribute("aria-busy", "true");
    host.innerHTML = '<div class="slot-loading">در حال همگام‌سازی Social Activity…</div>';
    status.textContent = "در حال خواندن";
    status.className = "pill";
    try {
      const items = await loadSocialActivity();
      renderRows(items);
    } catch (error) {
      status.textContent = "خطا";
      status.className = "pill warning";
      host.innerHTML = '<div class="social-error-state"><div class="draft-orb">!</div><h3>Activity در دسترس نیست.</h3><p>' + escapeHtml(error instanceof Error ? error.message : "خواندن Activity ناموفق بود.") + '</p><button class="button button-ghost" type="button" data-activity-retry>تلاش دوباره</button></div>';
      host.querySelector<HTMLButtonElement>("[data-activity-retry]")?.addEventListener("click", () => void load());
    }
  };

  refresh?.addEventListener("click", () => void load());
  await load();
}

function renderCompare(): string {
  const items = getCompareItems();
  if (items.length < 2) return '<div class="phoenix-compare-page"><div class="phoenix-section-heading"><span class="phoenix-kicker">Compare</span><h1>مقایسه محصولات</h1><p>حداقل دو محصول واقعی را از فید انتخاب کن.</p></div><div class="glass-card phoenix-compare-empty"><strong>هنوز محصول کافی برای مقایسه انتخاب نشده است.</strong><p>به اکسپلور برگرد و روی «مقایسه» محصولات موردنظر بزن.</p><a class="button button-primary" href="/discover?tab=explore" data-nav>بازگشت به اکسپلور</a></div></div>';
  const metadataKeys = Array.from(new Set(items.flatMap((item) => Object.keys(item.metadata ?? {})))).filter((key) => !["businessId","businessName","offeringType"].includes(key)).slice(0, 8);
  const rows: Array<[string, (item: DiscoveryResult) => unknown]> = [
    ["نوع", (item) => item.sourceType ?? "product"],
    ["قیمت", (item) => item.price !== undefined && item.price !== null ? Number(item.price).toLocaleString("fa-IR") + " " + (item.currency ?? "") : "استعلام قیمت"],
    ["امتیاز", (item) => item.rating !== undefined && item.rating !== null ? Number(item.rating).toFixed(1) : "—"],
    ["موقعیت", (item) => item.locality ?? item.city ?? "—"],
    ["توضیح", (item) => item.description ?? item.body ?? "—"],
    ...metadataKeys.map((key) => [key, (item: DiscoveryResult) => item.metadata?.[key] ?? "—"] as [string, (item: DiscoveryResult) => unknown]),
  ];
  return '<div class="phoenix-compare-page">' +
    '<div class="phoenix-section-heading"><span class="phoenix-kicker">Compare · 2–4</span><h1>مقایسه شفاف محصولات</h1><p>فقط داده‌ای را می‌بینی که در Discovery/Catalog آمده است؛ ققنوس ویژگی نامشخص را حدس نمی‌زند.</p></div>' +
    '<div class="phoenix-compare-table"><div class="compare-row compare-head"><span>ویژگی</span>' + items.map((item) => '<strong>' + escapeHtml(item.title ?? item.displayName ?? item.name ?? "محصول") + '</strong>').join("") + '</div>' +
    rows.map(([label, getter]) => '<div class="compare-row"><span>' + escapeHtml(label) + '</span>' + items.map((item) => '<span>' + escapeHtml(String(getter(item))) + '</span>').join("") + '</div>').join("") +
    '</div><div class="phoenix-compare-actions">' +
    items.map((item) => '<a class="button button-primary" href="/checkout?product=' + encodeURIComponent(item.sourceId ?? item.id ?? "") + '" data-nav>خرید «' + escapeHtml(item.title ?? item.name ?? "محصول") + '»</a>').join("") +
    '<a class="button button-ghost" href="/discover" data-nav>ادامه کشف</a><button class="button button-ghost" type="button" data-clear-compare>پاک کردن مقایسه</button></div></div>';
}
function renderDiscover(): string {
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q") ?? "";
  const tab = params.get("tab") ?? "for-you";
  const title = tab === "following" ? "چیزهایی که دنبال می‌کنی." : tab === "explore" ? "چیزهایی که در اکسپلور تازه‌اند." : "برای تو، بر اساس نیازت.";
  const intro = tab === "following"
    ? "عرضه‌های منتشرشده از کسب‌وکارهایی که خودت دنبال کرده‌ای."
    : tab === "explore"
      ? "مرور عرضه‌های واقعی و قابل کشف در شبکه ققنوس."
      : "هر چی می‌خوای بگو، تا ققنوس برات پیداش کنه";
  return '<div class="phoenix-social-page">' +
    '<section class="phoenix-social-hero">' +
      '<div class="phoenix-social-intro"><span class="phoenix-kicker">Phoenix ' + (tab === "explore" ? "Explore" : tab === "following" ? "Following" : "For You") + '</span><h1>' + title + '</h1><p>' + intro + '</p></div>' +
      '<div class="phoenix-social-hero-card"><img src="/phoenix-mark.svg?v=1" alt="" aria-hidden="true" /><div><strong>تصمیم را از نیاز شروع کن</strong><small>محصول، خدمت یا کسب‌وکار را پیدا کن و همان‌جا مقایسه یا اقدام کن.</small></div><button class="button button-primary" type="button" data-open-create-post>＋ ایجاد عرضه</button></div>' +
    '</section>' +
    '<section class="phoenix-social-search glass-card"><span class="phoenix-search-icon">⌕</span><input id="discover-query" type="search" autocomplete="off" value="' + escapeAttr(initialQuery) + '" placeholder="مثلاً «کفش دویدن تا ۵ میلیون»" /><button class="button button-primary" type="button" data-run-discovery>کشف کن <span>←</span></button></section>' +
    '<div class="phoenix-feed-heading"><div><span class="phoenix-kicker">Discovery</span><strong id="results-title">' + escapeHtml(initialQuery ? "نتایج جست‌وجو" : tab === "following" ? "دنبال‌شده‌ها" : tab === "explore" ? "اکسپلور" : "پیشنهادهای قابل کشف") + '</strong><small id="results-meta">آماده</small></div><div class="phoenix-feed-actions"><a href="/compare" data-nav>مقایسه <span>→</span></a><button type="button" class="button button-ghost" data-social-state-refresh>↻ همگام‌سازی</button></div></div>' +
    '<div id="discovery-results" class="phoenix-social-feed">' + (initialQuery ? '<div class="slot-loading">در حال آماده‌سازی Discovery…</div>' : '<div class="social-empty-state glass-card"><div class="draft-orb">✦</div><h3>از یک نیاز شروع کن</h3><p>یک جمله بنویس، یا وارد اکسپلور شو و کالاها و خدمات ققنوس رو ببین.</p><div class="connection-actions"><button class="button button-primary" type="button" data-focus-discover>شروع جست‌وجو</button><a class="button button-ghost" href="/discover?tab=explore" data-nav>اکسپلور</a></div></div>') + '</div>' +
    '<div id="phoenix-compare-tray"></div><div id="discovery-pagination"></div></div>';
}
function getShortlist(): DiscoveryResult[] {
  try {
    const raw = localStorage.getItem("phoenix-shortlist");
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is DiscoveryResult => Boolean(item) && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function saveShortlist(items: DiscoveryResult[]): void {
  localStorage.setItem("phoenix-shortlist", JSON.stringify(items.slice(-20)));
}

function toggleShortlist(item: DiscoveryResult): void {
  const key = item.id ?? item.sourceId ?? "";
  if (!key) {
    showToast("این نتیجه شناسه قابل نگهداری ندارد.");
    return;
  }
  const current = getShortlist();
  const exists = current.some((entry) => (entry.id ?? entry.sourceId) === key);
  saveShortlist(exists ? current.filter((entry) => (entry.id ?? entry.sourceId) !== key) : [...current, item]);
}

function renderShortlist(): void {
  const count = getShortlist().length;
  document.querySelectorAll<HTMLElement>("#shortlist-count").forEach((node) => {
    node.textContent = String(count);
  });
  document.querySelectorAll<HTMLElement>("[data-shortlist-count]").forEach((node) => {
    node.textContent = String(count);
  });
  if (activeDiscoveryItems.length) {
    const host = document.querySelector<HTMLElement>("#discovery-results");
    if (host) host.innerHTML = renderResultCards(activeDiscoveryItems);
    bindDiscoveryResultEvents();
  }
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
const BUSINESS_ROLE_ACTIONS: Record<string, readonly { readonly label: string; readonly path: string; readonly description: string }[]> = {
  management: [
    { label: "Business Profile", path: "/business/profile", description: "هویت، Trust و Publication" },
    { label: "Team & Access", path: "/business?module=تیم", description: "Role و Permissionهای Workspace" },
    { label: "Billing", path: "/billing", description: "Entitlement و مالی" },
  ],
  sales: [
    { label: "Catalog", path: "/catalog", description: "محصول و خدمت" },
    { label: "Customers", path: "/customer", description: "مشتری و رابطه" },
    { label: "Transactions", path: "/transactions", description: "سفارش و معامله" },
  ],
  specialist: [
    { label: "Booking", path: "/booking", description: "Schedule و رزرو" },
    { label: "Customers", path: "/customer", description: "مراجعان / مشتریان" },
    { label: "Services", path: "/catalog", description: "خدمات تخصصی" },
  ],
  finance: [
    { label: "Billing", path: "/billing", description: "صورتحساب و Entitlement" },
    { label: "Transactions", path: "/transactions", description: "جریان‌های تجاری" },
  ],
  generic: [
    { label: "Business Profile", path: "/business/profile", description: "هویت و وضعیت انتشار" },
    { label: "Catalog", path: "/catalog", description: "عرضه" },
  ],
};

const BUSINESS_QUICK_ACTION_LINKS: Record<string, Record<string, string>> = {
  default: { "ایجاد محتوا": "/product-studio", "مدیریت عرضه": "/catalog", "بررسی معاملات": "/transactions" },
  clinic: { "افزودن خدمت": "/catalog", "تنظیم زمان‌بندی": "/booking", "مدیریت نوبت‌ها": "/booking" },
  retail: { "افزودن محصول": "/product-studio", "ثبت موجودی": "/catalog", "ساخت محتوای محصول": "/product-studio" },
  restaurant: { "مدیریت منو": "/catalog", "تنظیم میزها": "/business?module=میزها", "بررسی رزروها": "/booking" },
  salon: { "افزودن خدمت": "/catalog", "تنظیم برنامه": "/booking", "افزودن متخصص": "/business?module=متخصصان" },
};

const BUSINESS_VERTICAL_BOARD: Record<string, readonly { readonly eyebrow: string; readonly title: string; readonly description: string; readonly path?: string }[]> = {
  default: [
    { eyebrow: "Today", title: "عمل اصلی Workspace", description: "ماژول‌های فعال را بر اساس Capability این Business دنبال کن.", path: "/business?module=محصولات" },
    { eyebrow: "Supply", title: "عرضه را آماده کن", description: "از Product Studio یا Catalog شروع کن.", path: "/product-studio" },
    { eyebrow: "Connect", title: "مشتری و ارتباط", description: "Customer و Communication را از منابع canonical باز کن.", path: "/customer" },
  ],
  clinic: [
    { eyebrow: "Today", title: "نوبت‌های امروز", description: "Availability و رزرو را از Booking canonical بررسی کن.", path: "/booking" },
    { eyebrow: "Care", title: "خدمات و پزشکان", description: "خدمات از Catalog و Provider access از Team کنترل می‌شود.", path: "/business?module=پزشکان" },
    { eyebrow: "Relationship", title: "مراجعان", description: "Customer profile و تاریخچه رابطه را از Customer باز کن.", path: "/customer" },
    { eyebrow: "Trust", title: "احراز کسب‌وکار", description: "Verification و Publication قبل از نمایش عمومی.", path: "/business/profile" },
  ],
  retail: [
    { eyebrow: "Today", title: "فروش و سفارش", description: "وضعیت transaction و order از Commerce خوانده می‌شود.", path: "/transactions" },
    { eyebrow: "Supply", title: "محصولات و تنوع", description: "Product، Variant و listing در Catalog/Studio مدیریت می‌شوند.", path: "/catalog" },
    { eyebrow: "Stock", title: "موجودی", description: "موجودی فقط از Inventory/Catalog canonical نمایش داده می‌شود.", path: "/business?module=موجودی" },
    { eyebrow: "Growth", title: "تخفیف و محتوا", description: "Promotion و Seller AI برای رشد عرضه.", path: "/promotion" },
  ],
  restaurant: [
    { eyebrow: "Today", title: "سفارش‌های امروز", description: "جریان سفارش از Commerce/Transactions دنبال می‌شود.", path: "/transactions" },
    { eyebrow: "Reservation", title: "رزرو میز", description: "Availability و رزرو تحت Booking قرار دارد.", path: "/booking" },
    { eyebrow: "Supply", title: "منو", description: "عرضه‌های منو در Catalog نگهداری می‌شوند.", path: "/catalog" },
    { eyebrow: "Fulfillment", title: "آشپزخانه و تحویل", description: "عملیات و fulfillment از Operations پیگیری می‌شود.", path: "/operations" },
  ],
  salon: [
    { eyebrow: "Today", title: "نوبت‌های امروز", description: "Availability و appointment workflow از Booking می‌آید.", path: "/booking" },
    { eyebrow: "People", title: "متخصصان", description: "Provider access از Team/Workspace کنترل می‌شود.", path: "/business?module=متخصصان" },
    { eyebrow: "Supply", title: "خدمات", description: "Service supply از Catalog مدیریت می‌شود.", path: "/catalog" },
    { eyebrow: "Growth", title: "پیشنهادها", description: "Promotion policy در دامنه Promotion قرار دارد.", path: "/promotion" },
  ],
};
function businessWorkflowStageHref(
  vertical: string,
  stage: string,
  businessId: string,
  originatingModule: string,
): { href?: string; module?: string } {
  const resolvedVertical = resolveBusinessVerticalKey(vertical);
  const candidate = getVerticalWorkflowStageModule(resolvedVertical, stage);
  if (!candidate) return {};
  const modules: readonly string[] = getBusinessVerticalUi(resolvedVertical).modules;
  if (!modules.includes(candidate)) return {};
  return {
    module: candidate,
    href: businessModuleContextHref(businessModulePath(resolvedVertical, candidate), resolvedVertical, originatingModule, businessId),
  };
}

const BUSINESS_MODULE_LINKS: Record<string, Record<string, { readonly label: string; readonly path?: string; readonly status?: string; readonly description: string }>> = {
  default: { "پروفایل": { label: "پروفایل کسب‌وکار", path: "/business/profile", description: "هویت و وضعیت انتشار Business." }, "محتوا": { label: "Product Studio", path: "/product-studio", description: "ساخت عرضه و محتوای marketplace-ready." }, "محصولات": { label: "کاتالوگ", path: "/catalog", description: "مدیریت عرضه‌های Catalog." }, "خدمات": { label: "کاتالوگ", path: "/catalog", description: "مدیریت خدمات و offeringها." }, "مشتریان": { label: "مشتریان", path: "/customer", description: "رابط Customer و تاریخچه رابطه." }, "پیام‌ها": { label: "ارتباطات", path: "/communication", description: "پیام‌ها و ارتباط با مشتری." }, "معاملات": { label: "معاملات", path: "/transactions", description: "خرید، فروش، اجاره و جریان‌های تجاری." }, "تیم": { label: "تیم", status: "read-only", description: "اعضا، Role و Permissionهای Workspace." } },
  clinic: { "امروز": { label: "رزرو", path: "/booking", description: "نمای امروز و جریان رزرو canonical." }, "نوبت‌ها": { label: "رزرو", path: "/booking", description: "Availability و رزرو نوبت." }, "تقویم": { label: "رزرو", path: "/booking", description: "Availability و زمان‌بندی." }, "پزشکان": { label: "تیم", status: "capability", description: "Provider/Specialist در Team و Access." }, "خدمات": { label: "کاتالوگ", path: "/catalog", description: "خدمات قابل ارائه توسط کلینیک." }, "مراجعان": { label: "مشتریان", path: "/customer", description: "Customer relationship و سابقه تعامل." }, "ساعات کاری": { label: "Business", path: "/business", description: "Location و Hours canonical." }, "پیام‌ها": { label: "ارتباطات", path: "/communication", description: "ارتباط با مراجعان." }, "پرداخت": { label: "مالی", path: "/billing", description: "Billing و entitlement." }, "محتوا": { label: "Product Studio", path: "/product-studio", description: "محتوا و معرفی خدمات." }, "تیم": { label: "تیم", status: "read-only", description: "Role/Access تیم درمان و پشتیبانی." } },
  retail: { "فروش امروز": { label: "معاملات", path: "/transactions", description: "جریان سفارش و معامله." }, "محصولات": { label: "کاتالوگ", path: "/catalog", description: "Product و Offering canonical." }, "مدل‌ها و تنوع": { label: "کاتالوگ", path: "/catalog", description: "Product/Variant در Catalog." }, "سایز و رنگ": { label: "کاتالوگ", path: "/catalog", description: "Variant attributes canonical." }, "موجودی": { label: "کاتالوگ", path: "/catalog", description: "موجودی از Inventory canonical خوانده می‌شود." }, "سفارش‌ها": { label: "معاملات", path: "/transactions", description: "Order و Commerce." }, "مرجوعی": { label: "معاملات", path: "/transactions", description: "چرخه transaction/return در boundary تجاری." }, "مشتریان": { label: "مشتریان", path: "/customer", description: "Customer relationship." }, "تخفیف‌ها": { label: "Promotion", path: "/promotion", description: "Promotion policy و eligibility." }, "محتوا": { label: "Product Studio", path: "/product-studio", description: "Seller AI برای listing." }, "گزارش فروش": { label: "معاملات", path: "/transactions", description: "وضعیت transactionها." } },
  restaurant: { "سفارش‌های امروز": { label: "معاملات", path: "/transactions", description: "جریان سفارش و transaction." }, "منو": { label: "کاتالوگ", path: "/catalog", description: "Menu/service supply در Catalog." }, "میزها": { label: "Business", path: "/business", description: "Location و عملیات پایه." }, "رزرو": { label: "رزرو", path: "/booking", description: "Availability و رزرو." }, "آشپزخانه": { label: "عملیات", path: "/operations", description: "Case/fulfillment operations." }, "تحویل": { label: "عملیات", path: "/operations", description: "Fulfillment و delivery." }, "مشتریان": { label: "مشتریان", path: "/customer", description: "Customer relationship." }, "تخفیف": { label: "Promotion", path: "/promotion", description: "Promotion policy و eligibility." }, "پرداخت": { label: "مالی", path: "/billing", description: "Billing و پرداخت‌های canonical." }, "گزارش": { label: "معاملات", path: "/transactions", description: "گزارش بر مبنای transaction/commerce canonical." } },
  salon: { "وقت‌های امروز": { label: "رزرو", path: "/booking", description: "نمای رزرو و availability." }, "خدمات": { label: "کاتالوگ", path: "/catalog", description: "Service catalog." }, "متخصصان": { label: "تیم", status: "read-only", description: "Specialist role و access." }, "تقویم": { label: "رزرو", path: "/booking", description: "Calendar و availability." }, "مشتریان": { label: "مشتریان", path: "/customer", description: "Customer relationship." }, "ظرفیت": { label: "رزرو", path: "/booking", description: "Availability و ظرفیت متخصص/خدمت." }, "پرداخت": { label: "مالی", path: "/billing", description: "Billing و commercial entitlements." }, "پیشنهادها": { label: "Promotion", path: "/promotion", description: "Promotion policy." }, "محتوا": { label: "Product Studio", path: "/product-studio", description: "محتوا و Seller AI." }, "تیم": { label: "تیم", status: "read-only", description: "Role و Permissionهای Workspace." } },
};

function businessModuleInfo(vertical: string, module: string): { readonly label: string; readonly path?: string; readonly status?: string; readonly description: string } {
  return BUSINESS_MODULE_LINKS[vertical]?.[module] ?? BUSINESS_MODULE_LINKS.default?.[module] ?? { label: module, status: "capability", description: "این ماژول در ترکیب Capabilityهای Workspace قرار می‌گیرد." };
}

function businessModulePath(vertical: string, module: string): string {
  return getVerticalModuleRoute(resolveBusinessVerticalKey(vertical), module);
}

function parseBusinessModulePath(path: string): { vertical: string; module: string } | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "business" || parts[1] !== "workspace") return null;
  let slug = "";
  try { slug = decodeURIComponent(parts[3] ?? ""); } catch { return null; }
  const vertical = resolveBusinessVerticalKey(parts[2]);
  const modules = getBusinessVerticalUi(vertical).modules;
  const module = getVerticalModuleForSlug(vertical, slug, modules);
  return module ? { vertical, module } : null;
}

function parseBusinessModuleAliasPath(path: string, search = location.search): { vertical: string; module: string } | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "business") return null;
  const alias = parts[1];
  if (!alias || alias === "profile") return null;

  const params = new URLSearchParams(search);
  const requestedVertical = params.get("vertical")?.trim()
    ?? localStorage.getItem(STORAGE.businessVertical)
    ?? "default";
  const vertical = resolveBusinessVerticalKey(requestedVertical);
  const module = resolveVerticalModuleAlias(vertical, alias);
  return module ? { vertical, module } : null;
}

function parseBusinessModuleRequest(path: string): { vertical: string; module: string } | null {
  const semantic = parseBusinessModulePath(path);
  if (semantic) return semantic;
  if (path !== "/business") return null;

  const params = new URLSearchParams(location.search);
  const requestedModule = params.get("module")?.trim();
  if (!requestedModule) return null;

  const requestedVertical = params.get("vertical")?.trim()
    ?? localStorage.getItem(STORAGE.businessVertical)
    ?? "default";
  const vertical = resolveBusinessVerticalKey(requestedVertical);
  const modules: readonly string[] = getBusinessVerticalUi(vertical).modules;
  const module = modules.includes(requestedModule)
    ? requestedModule
    : getVerticalModuleForSlug(vertical, requestedModule, modules);

  return module ? { vertical, module } : null;
}

function businessModuleContextHref(path: string, vertical: string, module: string, businessId?: string): string {
  const target = new URL(path, window.location.origin);
  const resolvedVertical = resolveBusinessVerticalKey(vertical);
  const modules: readonly string[] = getBusinessVerticalUi(resolvedVertical).modules;

  // The Workspace routing contract prefers stable semantic module URLs.
  // Older blueprint entries may still point to /business?module=...; normalize
  // those links here so no new navigation leaks the legacy query-only form.
  if (target.pathname === "/business" && target.searchParams.get("module")) {
    const requestedModule = target.searchParams.get("module")?.trim();
    if (requestedModule && modules.includes(requestedModule)) {
      target.pathname = businessModulePath(resolvedVertical, requestedModule);
      target.search = "";
    }
  }

  if (businessId) target.searchParams.set("business", businessId);
  target.searchParams.set("vertical", resolvedVertical);
  target.searchParams.set("fromModule", module);
  return target.pathname + target.search + target.hash;
}

/**
 * Preserve Business/Vertical context when a link originates from the Workspace shell
 * rather than from a specific module. This intentionally does not add fromModule.
 */
function businessWorkspaceContextHref(path: string, vertical: string, businessId?: string): string {
  const target = new URL(path, window.location.origin);
  const resolvedVertical = resolveBusinessVerticalKey(vertical);
  const modules: readonly string[] = getBusinessVerticalUi(resolvedVertical).modules;

  if (target.pathname === "/business" && target.searchParams.get("module")) {
    const requestedModule = target.searchParams.get("module")?.trim();
    if (requestedModule && modules.includes(requestedModule)) {
      target.pathname = businessModulePath(resolvedVertical, requestedModule);
      target.search = "";
    }
  }

  if (businessId) target.searchParams.set("business", businessId);
  target.searchParams.set("vertical", resolvedVertical);
  return target.pathname + target.search + target.hash;
}

type BusinessModulePresentation = {
  readonly eyebrow: string;
  readonly stateLabel: string;
  readonly stateDescription: string;
  readonly surfaces: readonly { readonly label: string; readonly path?: string; readonly description: string }[];
};

const BUSINESS_MODULE_PRESENTATIONS: Record<string, Record<string, BusinessModulePresentation>> = {
  clinic: {
    "امروز": { eyebrow: "Today Command Center", stateLabel: "Today surface", stateDescription: "نمای نقطه شروع روز برای نوبت‌ها و کارهای جاری؛ داده واقعی از Booking می‌آید.", surfaces: [{ label: "رزرو", path: "/booking", description: "Availability و appointment workflow" }, { label: "مراجعان", path: "/customer", description: "Customer relationship" }, { label: "پیام‌ها", path: "/communication", description: "ارتباطات" }] },
    "نوبت‌ها": { eyebrow: "Appointments", stateLabel: "Booking canonical", stateDescription: "این صفحه UI orchestration نوبت است و وضعیت نهایی را از Booking می‌خواند.", surfaces: [{ label: "Booking", path: "/booking", description: "مشاهده availability و رزرو" }, { label: "Customers", path: "/customer", description: "مراجعان" }, { label: "Services", path: "/catalog", description: "خدمات قابل رزرو" }] },
    "تقویم": { eyebrow: "Schedule", stateLabel: "Availability canonical", stateDescription: "تقویم این Workspace نمایی از ظرفیت و زمان‌بندی canonical است؛ state محلی ساخته نمی‌شود.", surfaces: [{ label: "Availability", path: "/booking", description: "Slotهای قابل استفاده" }, { label: "Business Hours", path: "/business", description: "ساعات و مکان" }] },
    "پزشکان": { eyebrow: "Providers", stateLabel: "Capability / Team", stateDescription: "پزشکان و متخصصان موجودیت مستقل UI نیستند؛ عضویت، Role و دسترسی از Workspace/Team کنترل می‌شود.", surfaces: [{ label: "Team", path: "/business?module=تیم", description: "Role و Access" }, { label: "Services", path: "/catalog", description: "خدمات" }] },
    "خدمات": { eyebrow: "Clinical Services", stateLabel: "Catalog canonical", stateDescription: "Service supply در Catalog نگهداری می‌شود و این صفحه فقط context تخصصی را حفظ می‌کند.", surfaces: [{ label: "Catalog", path: "/catalog", description: "مدیریت offeringهای خدمت" }, { label: "Booking", path: "/booking", description: "مسیر رزرو" }] },
    "مراجعان": { eyebrow: "Patients / Customers", stateLabel: "Customer canonical", stateDescription: "این Workspace از Customer boundary برای رابطه با مراجع استفاده می‌کند؛ پرونده درمانی جداگانه ایجاد نمی‌کنیم.", surfaces: [{ label: "Customer", path: "/customer", description: "رابط مشتری" }, { label: "Communication", path: "/communication", description: "ارتباط" }] },
    "ساعات کاری": { eyebrow: "Business Availability", stateLabel: "Business canonical", stateDescription: "مکان و ساعت کاری از Business canonical می‌آید.", surfaces: [{ label: "Business", path: "/business", description: "مدیریت Workspace" }, { label: "Booking", path: "/booking", description: "اثر ساعات بر رزرو" }] },
    "پیام‌ها": { eyebrow: "Care Communication", stateLabel: "Communication canonical", stateDescription: "پیام‌ها و notificationها از Communication boundary می‌آیند.", surfaces: [{ label: "Communication", path: "/communication", description: "ارسال و دریافت" }, { label: "Customers", path: "/customer", description: "زمینه مشتری" }] },
    "پرداخت": { eyebrow: "Payments", stateLabel: "Billing canonical", stateDescription: "داده مالی از Billing/Commerce خوانده می‌شود و این UI دفتر مالی دوم نمی‌سازد.", surfaces: [{ label: "Billing", path: "/billing", description: "صورتحساب و entitlement" }, { label: "Transactions", path: "/transactions", description: "معامله و سفارش" }] },
    "تیم": { eyebrow: "Team & Access", stateLabel: "Backend authoritative", stateDescription: "لیست اعضا و دسترسی‌ها از Workspace/Context می‌آید؛ mutationهای نقش هنوز در همین سطح ساخته نمی‌شوند.", surfaces: [{ label: "Team Management", path: "/business", description: "مدیریت تیم فعلی" }, { label: "Account Context", path: "/account", description: "context و permissionها" }] },
  },
  retail: {
    "فروش امروز": { eyebrow: "Sales Command Center", stateLabel: "Commerce canonical", stateDescription: "وضعیت فروش و سفارش از Commerce/Transactions خوانده می‌شود.", surfaces: [{ label: "Transactions", path: "/transactions", description: "پیگیری سفارش" }, { label: "Customers", path: "/customer", description: "رابط مشتری" }] },
    "محصولات": { eyebrow: "Product Workspace", stateLabel: "Catalog canonical", stateDescription: "محصول و offering از Catalog نگهداری می‌شود؛ Product Studio برای ساخت عرضه در دسترس است.", surfaces: [{ label: "Catalog", path: "/catalog", description: "محصول و offering" }, { label: "Product Studio", path: "/product-studio", description: "Seller AI" }] },
    "مدل‌ها و تنوع": { eyebrow: "Variants", stateLabel: "Catalog canonical", stateDescription: "مدل و تنوع در همان مدل canonical محصول مدیریت می‌شوند.", surfaces: [{ label: "Catalog", path: "/catalog", description: "Variant context" }, { label: "Product Studio", path: "/product-studio", description: "تولید listing" }] },
    "سایز و رنگ": { eyebrow: "Variant Attributes", stateLabel: "Catalog canonical", stateDescription: "سایز، رنگ و attributeها بخشی از variant model هستند؛ UI موازی ساخته نمی‌شود.", surfaces: [{ label: "Catalog", path: "/catalog", description: "مدیریت variant" }] },
    "موجودی": { eyebrow: "Inventory", stateLabel: "Inventory / Catalog boundary", stateDescription: "موجودی فقط وقتی مقدار واقعی نشان می‌دهد که endpoint canonical آن فعال باشد.", surfaces: [{ label: "Catalog", path: "/catalog", description: "منبع عرضه" }, { label: "Transactions", path: "/transactions", description: "اثر موجودی در سفارش" }] },
    "سفارش‌ها": { eyebrow: "Orders", stateLabel: "Commerce canonical", stateDescription: "Order state از Commerce می‌آید و transaction در Workspace کپی نمی‌شود.", surfaces: [{ label: "Transactions", path: "/transactions", description: "Order lookup" }, { label: "Operations", path: "/operations", description: "Fulfillment" }] },
    "مرجوعی": { eyebrow: "Returns", stateLabel: "Commerce boundary", stateDescription: "چرخه مرجوعی زیر transaction/fulfillment قرار می‌گیرد؛ UI دوم برای order state ایجاد نمی‌شود.", surfaces: [{ label: "Transactions", path: "/transactions", description: "Order context" }, { label: "Operations", path: "/operations", description: "Fulfillment cases" }] },
    "مشتریان": { eyebrow: "Customers", stateLabel: "Customer canonical", stateDescription: "رابط مشتری از Customer domain می‌آید.", surfaces: [{ label: "Customers", path: "/customer", description: "مدیریت رابطه" }, { label: "Communication", path: "/communication", description: "ارتباط" }] },
    "تخفیف‌ها": { eyebrow: "Promotions", stateLabel: "Promotion canonical", stateDescription: "قواعد promotion و eligibility در دامنه Promotion باقی می‌ماند.", surfaces: [{ label: "Promotion", path: "/promotion", description: "ساخت و ارزیابی promotion" }] },
    "محتوا": { eyebrow: "Seller AI", stateLabel: "Studio canonical", stateDescription: "محتوای محصول از Product Studio/Seller AI ساخته می‌شود.", surfaces: [{ label: "Product Studio", path: "/product-studio", description: "تولید listing" }, { label: "Catalog", path: "/catalog", description: "عرضه canonical" }] },
    "گزارش فروش": { eyebrow: "Sales Reporting", stateLabel: "Transaction source", stateDescription: "گزارش این سطح باید از داده transaction/commerce تغذیه شود؛ عدد ساختگی نمایش نمی‌دهیم.", surfaces: [{ label: "Transactions", path: "/transactions", description: "داده سفارش" }] },
  },
  restaurant: {
    "سفارش‌های امروز": { eyebrow: "Restaurant Command Center", stateLabel: "Commerce canonical", stateDescription: "جریان سفارش از Commerce/Transactions دنبال می‌شود.", surfaces: [{ label: "Transactions", path: "/transactions", description: "وضعیت سفارش" }, { label: "Operations", path: "/operations", description: "پیگیری fulfillment" }] },
    "منو": { eyebrow: "Menu", stateLabel: "Catalog canonical", stateDescription: "منو به‌عنوان supply در Catalog مدیریت می‌شود.", surfaces: [{ label: "Catalog", path: "/catalog", description: "عرضه منو" }, { label: "Promotion", path: "/promotion", description: "پیشنهادها" }] },
    "میزها": { eyebrow: "Tables", stateLabel: "Business capability", stateDescription: "میز و مکان از Business capability می‌آید؛ endpoint مستقل میز در این UI ادعا نمی‌شود.", surfaces: [{ label: "Business", path: "/business", description: "Workspace و مکان" }, { label: "Booking", path: "/booking", description: "رزرو" }] },
    "رزرو": { eyebrow: "Reservations", stateLabel: "Booking canonical", stateDescription: "رزرو تحت Availability/Booking قرار دارد.", surfaces: [{ label: "Booking", path: "/booking", description: "رزرو" }, { label: "Customers", path: "/customer", description: "رابط مهمان" }] },
    "آشپزخانه": { eyebrow: "Kitchen Operations", stateLabel: "Operations canonical", stateDescription: "عملیات و fulfillment از Operations پیگیری می‌شود.", surfaces: [{ label: "Operations", path: "/operations", description: "Cases و fulfillment" }, { label: "Transactions", path: "/transactions", description: "Order context" }] },
    "تحویل": { eyebrow: "Delivery", stateLabel: "Fulfillment canonical", stateDescription: "تحویل در boundary عملیات/fulfillment قرار دارد.", surfaces: [{ label: "Operations", path: "/operations", description: "Fulfillment" }, { label: "Transactions", path: "/transactions", description: "Order" }] },
    "مشتریان": { eyebrow: "Guests / Customers", stateLabel: "Customer canonical", stateDescription: "رابط با مشتری از Customer domain می‌آید.", surfaces: [{ label: "Customers", path: "/customer", description: "رابط" }, { label: "Communication", path: "/communication", description: "ارتباط" }] },
    "تخفیف": { eyebrow: "Restaurant Promotions", stateLabel: "Promotion canonical", stateDescription: "Promotion policy و eligibility از Promotion می‌آید.", surfaces: [{ label: "Promotion", path: "/promotion", description: "قواعد و ارزیابی پیشنهاد" }, { label: "Menu", path: "/catalog", description: "عرضه منو" }] },
    "پرداخت": { eyebrow: "Restaurant Payments", stateLabel: "Billing / Commerce canonical", stateDescription: "داده مالی از Billing و تراکنش از Commerce می‌آید.", surfaces: [{ label: "Billing", path: "/billing", description: "صورتحساب و entitlement" }, { label: "Transactions", path: "/transactions", description: "سفارش و تراکنش" }] },
    "گزارش": { eyebrow: "Restaurant Reporting", stateLabel: "Canonical reporting sources", stateDescription: "عددهای گزارش از Commerce، Booking و Operations تغذیه می‌شوند؛ UI عدد ساختگی ندارد.", surfaces: [{ label: "Transactions", path: "/transactions", description: "داده سفارش" }, { label: "Booking", path: "/booking", description: "رزرو" }, { label: "Operations", path: "/operations", description: "Fulfillment" }] },
  },
  salon: {
    "وقت‌های امروز": { eyebrow: "Today Command Center", stateLabel: "Booking canonical", stateDescription: "وقت‌های امروز از Booking/Availability تغذیه می‌شوند.", surfaces: [{ label: "Booking", path: "/booking", description: "وقت‌ها" }, { label: "Customers", path: "/customer", description: "مشتریان" }] },
    "خدمات": { eyebrow: "Services", stateLabel: "Catalog canonical", stateDescription: "خدمت در Catalog نگهداری می‌شود.", surfaces: [{ label: "Catalog", path: "/catalog", description: "Service supply" }, { label: "Booking", path: "/booking", description: "رزرو" }] },
    "متخصصان": { eyebrow: "Specialists", stateLabel: "Capability / Team", stateDescription: "متخصصان در سطح Team/Role تعریف می‌شوند؛ mutation جداگانه ساخته نمی‌شود.", surfaces: [{ label: "Team", path: "/business?module=تیم", description: "Role و Access" }, { label: "Booking", path: "/booking", description: "Schedule context" }] },
    "تقویم": { eyebrow: "Calendar", stateLabel: "Availability canonical", stateDescription: "تقویم باید از availability واقعی خوانده شود.", surfaces: [{ label: "Booking", path: "/booking", description: "Slotها" }, { label: "Business", path: "/business", description: "Workspace" }] },
    "مشتریان": { eyebrow: "Customers", stateLabel: "Customer canonical", stateDescription: "مشتریان از Customer boundary می‌آیند.", surfaces: [{ label: "Customers", path: "/customer", description: "رابط" }, { label: "Communication", path: "/communication", description: "ارتباط" }] },
    "ظرفیت": { eyebrow: "Capacity", stateLabel: "Availability boundary", stateDescription: "ظرفیت عددی ساختگی نیست؛ تا زمانی که source canonical فعال باشد، فقط state اتصال نمایش می‌دهیم.", surfaces: [{ label: "Booking", path: "/booking", description: "Availability" }] },
    "پرداخت": { eyebrow: "Payments", stateLabel: "Billing canonical", stateDescription: "پرداخت از Billing/Commerce پیگیری می‌شود.", surfaces: [{ label: "Billing", path: "/billing", description: "Billing" }, { label: "Transactions", path: "/transactions", description: "Transactions" }] },
    "پیشنهادها": { eyebrow: "Promotions", stateLabel: "Promotion canonical", stateDescription: "Promotion policy و eligibility از Promotion می‌آید.", surfaces: [{ label: "Promotion", path: "/promotion", description: "پیشنهادها" }] },
    "محتوا": { eyebrow: "Content", stateLabel: "Studio canonical", stateDescription: "معرفی خدمات و محتوا از Product Studio تغذیه می‌شود.", surfaces: [{ label: "Product Studio", path: "/product-studio", description: "Seller AI" }, { label: "Catalog", path: "/catalog", description: "Supply" }] },
    "تیم": { eyebrow: "Team & Access", stateLabel: "Backend authoritative", stateDescription: "Role/Permission از Workspace/Context می‌آید.", surfaces: [{ label: "Team", path: "/business?module=تیم", description: "Workspace team" }, { label: "Account", path: "/account", description: "Runtime context" }] },
  },
};

function renderBusinessModule(vertical: string, module: string): string {
  const ui = getBusinessVerticalUi(vertical);
  const info = businessModuleInfo(vertical, module);
  const presentation = BUSINESS_MODULE_PRESENTATIONS[ui.key]?.[module];
  const businessId = new URLSearchParams(location.search).get("business")?.trim() || localStorage.getItem(STORAGE.business) || "";
  const moduleIndex = (ui.modules as readonly string[]).indexOf(module);
  const moduleContract = getVerticalModuleUiContract(ui.key, module);
  const canonicalPath = info.path
    ? businessModuleContextHref(info.path, ui.key, module, businessId)
    : businessModuleContextHref(moduleContract.route, ui.key, module, businessId);
  const relatedModules = ui.modules.filter((item) => item !== module).slice(0, 5);
  const surfaces = presentation?.surfaces ?? (info.path ? [{ label: info.label, path: info.path, description: info.description }] : []);
  const actions = ui.actions.slice(0, 3);
  const workflow = getVerticalWorkflowSteps(ui.key);
  const blueprint: VerticalModuleBlueprint = moduleContract.blueprint;
  const capabilityContract = moduleContract.capabilityContract;
  const workflowCanvas = renderVerticalWorkflowCanvas({
    vertical: ui.key,
    module,
    blueprint,
    businessId,
    contextualHref: (path) => businessModuleContextHref(path, ui.key, module, businessId),
  });
  const blueprintLayoutLabels: Record<VerticalModuleBlueprint["layout"], string> = { command: "Command Center", calendar: "Timeline / Capacity", catalog: "Supply Canvas", people: "People / Relationship", commerce: "Commerce Control", operations: "Operations Board", communication: "Communication Workspace" };
  const contextRows = [
    { label: "Business", value: businessId ? compactId(businessId) : "هنوز انتخاب نشده" },
    { label: "Vertical", value: ui.label },
    { label: "Source of truth", value: presentation?.stateLabel ?? info.label },
    { label: "Access", value: "Backend authoritative" },
  ];
  return '<div class="phoenix-business-module-page">' +
    '<section class="phoenix-business-module-hero">' +
      '<div><a class="button button-ghost" href="/business" data-nav>← Workspace</a><span class="phoenix-kicker">' + escapeHtml(ui.label) + ' · Module</span><h1>' + escapeHtml(module) + '</h1><p>' + escapeHtml(info.description) + '</p><div class="phoenix-business-module-meta"><span>' + escapeHtml(presentation?.eyebrow ?? info.label) + '</span><span>' + (moduleIndex >= 0 ? "ماژول " + String(moduleIndex + 1) : "Capability") + '</span><span>' + escapeHtml(info.status ?? presentation?.stateLabel ?? "connected") + '</span></div></div>' +
      '<div class="phoenix-business-module-symbol">' + escapeHtml(ui.icon) + '</div>' +
    '</section>' +
    '<nav class="phoenix-business-module-nav" aria-label="ماژول‌های Workspace">' +
      ui.modules.map((item) => { const href = businessModuleContextHref(businessModulePath(ui.key, item), ui.key, module, businessId); return '<a class="' + (item === module ? "active" : "") + '" href="' + escapeAttr(href) + '" data-nav data-module-role-fit="' + escapeAttr(item) + '" data-module-key="' + escapeAttr(item) + '"><span>' + escapeHtml(item) + '</span><small data-module-role-marker aria-hidden="true"></small></a>'; }).join("") +
    '</nav>' +
    '<section class="phoenix-module-context-strip">' +
      contextRows.map((row, index) => '<div><span>' + escapeHtml(row.label) + '</span><strong id="module-context-' + String(index) + '">' + escapeHtml(row.value) + '</strong></div>').join("") +
    '</section>' +
    '<section class="glass-card phoenix-module-capability-contract">' +
      '<div class="card-section-heading"><div><span class="section-kicker">Capability Contract</span><h2>وابستگی‌های این ماژول</h2><p>این فقط metadata رابط است؛ فعال/غیرفعال بودن Capability از Runtime/module registry و مجوز نهایی از Backend می‌آید.</p></div><span class="pill">registry-owned</span></div>' +
      '<div class="phoenix-module-capability-grid">' +
        '<div><span>Capabilities</span><div class="metadata-cloud">' + (capabilityContract.requiredCapabilities.length ? capabilityContract.requiredCapabilities.map((item) => '<span>' + escapeHtml(item) + '</span>').join("") : '<span>—</span>') + '</div></div>' +
        '<div><span>Required permissions</span><div class="metadata-cloud">' + (capabilityContract.requiredPermissions.length ? capabilityContract.requiredPermissions.map((item) => '<span>' + escapeHtml(item) + '</span>').join("") : '<span>Backend policy</span>') + '</div></div>' +
      '</div>' +
    '</section>' +
    '<section class="glass-card phoenix-module-role-contract">' +
      '<div class="card-section-heading"><div><span class="section-kicker">Role-aware Composition</span><h2>تمرکز این ماژول برای نقش فعلی</h2></div><span id="module-role-fit-badge" class="pill">در انتظار Context</span></div>' +
      '<div class="phoenix-module-role-contract-grid">' +
        '<div><span>Role lens</span><strong id="module-role-title">در انتظار احراز</strong><small id="module-role-description">این فقط لایهٔ emphasis رابط است؛ مجوز همچنان توسط backend تعیین می‌شود.</small></div>' +
        '<div><span>Module fit</span><strong id="module-role-fit">در انتظار Context</strong><small id="module-role-fit-detail">Blueprint بر اساس Business Type و Role lens ترکیب می‌شود.</small></div>' +
        '<div><span>Backend rule</span><strong>Authorization authoritative</strong><small>UI visibility هیچ مجوز جدیدی ایجاد نمی‌کند.</small></div>' +
      '</div>' +
    '</section>' +
    '<section class="glass-card phoenix-module-blueprint">' +
      '<div class="card-section-heading"><div><span class="section-kicker">' + escapeHtml(blueprint.eyebrow) + '</span><h2>' + escapeHtml(blueprintLayoutLabels[blueprint.layout]) + '</h2></div><span class="pill">UI foundation</span></div>' +
      '<div class="phoenix-module-blueprint-grid">' +
        blueprint.blocks.map((block) => {
          const href = block.path ? businessModuleContextHref(block.path, ui.key, module, businessId) : "";
          return '<article class="phoenix-module-blueprint-card"><span class="phoenix-module-blueprint-index">' + escapeHtml(block.label) + '</span><div><strong>' + escapeHtml(block.title) + '</strong><p>' + escapeHtml(block.description) + '</p></div>' + (href ? '<a href="' + escapeAttr(href) + '" data-nav>باز کردن منبع ←</a>' : '<span class="pill">Backend / endpoint لازم است</span>') + '</article>';
        }).join("") +
      '</div>' +
      '<div class="phoenix-module-blueprint-footer"><span>Vertical: ' + escapeHtml(ui.key) + '</span><span>Module: ' + escapeHtml(module) + '</span><span>' + String(blueprint.blocks.length) + ' foundation blocks</span><span>' + String(blueprint.capabilityContract.requiredCapabilities.length) + ' capability dependencies</span></div>' +
      '<div class="phoenix-module-state-contract">' +
        '<div><span>Interaction mode</span><strong>' + escapeHtml(blueprint.interaction) + '</strong></div>' +
        '<div><span>Primary action</span><strong>' + escapeHtml(blueprint.primaryAction?.label ?? "منبع canonical") + '</strong></div>' +
        '<div><span>State contract</span><strong>' + String(blueprint.states.length) + ' حالت استاندارد</strong></div>' +
      '</div>' +
    '</section>' +
    '<section class="glass-card phoenix-module-state-contract-card">' +
      '<div class="card-section-heading"><div><span class="section-kicker">UI State Contract</span><h2>رفتار استاندارد همه ماژول‌ها</h2></div><span class="pill">Shared Framework</span></div>' +
      '<div class="phoenix-module-state-grid">' +
        blueprint.states.map((item) => '<article class="phoenix-module-state-item state-' + escapeAttr(item.key) + '"><span class="phoenix-module-state-dot"></span><div><strong>' + escapeHtml(item.label) + '</strong><p>' + escapeHtml(item.description) + '</p></div></article>').join("") +
      '</div>' +
      (blueprint.primaryAction ? '<a class="button button-primary" href="' + escapeAttr(businessModuleContextHref(blueprint.primaryAction.path, ui.key, module, businessId)) + '" data-nav>' + escapeHtml(blueprint.primaryAction.label) + ' <span>→</span></a>' : '') +
    '</section>' +
    workflowCanvas +
    '<section class="phoenix-business-module-grid-page">' +
      '<article class="glass-card phoenix-module-command-card"><span class="section-kicker">Canonical Workflow</span><h2>' + escapeHtml(info.label) + '</h2><p>این سطح یک UI تخصصی برای Workspace است؛ source of truth، permission و mutation همچنان در دامنه canonical باقی می‌مانند.</p>' +
        (canonicalPath ? '<a class="button button-primary" href="' + escapeAttr(canonicalPath) + '" data-nav>باز کردن ' + escapeHtml(info.label) + ' <span>→</span></a>' : '<span class="pill">endpoint مستقل این قابلیت هنوز ثبت نشده</span>') +
      '</article>' +
      '<article class="glass-card phoenix-module-state-card"><span class="section-kicker">Capability State</span><h2>' + escapeHtml(presentation?.stateLabel ?? "Workspace boundary") + '</h2><p class="phoenix-module-state-description">' + escapeHtml(presentation?.stateDescription ?? "وضعیت این قابلیت از backend authoritative تعیین می‌شود.") + '</p><div class="phoenix-module-state-row"><span>Vertical</span><strong>' + escapeHtml(ui.key) + '</strong></div><div class="phoenix-module-state-row"><span>Module</span><strong>' + escapeHtml(module) + '</strong></div><div class="phoenix-module-state-row"><span>Access</span><strong>Backend authoritative</strong></div></article>' +
    '</section>' +
    '<section class="glass-card phoenix-module-surfaces-card"><div class="card-section-heading"><div><span class="section-kicker">Connected Surfaces</span><h2>سطوح مرتبط این ماژول</h2></div><span class="pill">' + String(surfaces.length) + ' مسیر</span></div><div class="phoenix-module-surface-grid">' +
      (surfaces.length ? surfaces.map((surface) => {
        const href = surface.path ? businessModuleContextHref(surface.path, ui.key, module, businessId) : "";
        return surface.path
          ? '<a class="phoenix-module-surface" href="' + escapeAttr(href) + '" data-nav><strong>' + escapeHtml(surface.label) + '</strong><span>' + escapeHtml(surface.description) + '</span><b>→</b></a>'
          : '<div class="phoenix-module-surface disabled"><strong>' + escapeHtml(surface.label) + '</strong><span>' + escapeHtml(surface.description) + '</span><b>—</b></div>';
      }).join("") : '<div class="slot-empty"><span>◈</span><p>سطح canonical متصل برای این Capability ثبت نشده است.</p></div>') +
    '</div></section>' +
    '<section class="glass-card phoenix-module-workbench-card">' +
      '<div class="card-section-heading"><div><span class="section-kicker">Workspace Canvas</span><h2>ساختار عملیاتی این صفحه</h2></div><span class="pill">' + escapeHtml(ui.label) + '</span></div>' +
      '<div class="phoenix-module-workbench-grid">' +
        '<article><span class="section-kicker">01 · Context</span><strong>هویت و دسترسی</strong><p>Business، نقش و Capability قبل از هر اقدام مشخص می‌شوند.</p><a href="' + escapeAttr(businessWorkspaceContextHref("/business/profile", ui.key, businessId || undefined)) + '" data-nav>مشاهده Context ←</a></article>' +
        '<article><span class="section-kicker">02 · Canonical</span><strong>' + escapeHtml(info.label) + '</strong><p>' + escapeHtml(info.description) + '</p>' +
          (canonicalPath ? '<a href="' + escapeAttr(canonicalPath) + '" data-nav>ورود به منبع اصلی ←</a>' : '<span class="pill">منبع مستقل هنوز ثبت نشده</span>') +
        '</article>' +
        '<article><span class="section-kicker">03 · Connected</span><strong>سطوح متصل</strong><p>این صفحه داده را دوباره ذخیره نمی‌کند؛ فقط مسیرهای canonical را در کانتکست شغلی نمایش می‌دهد.</p><div class="phoenix-module-compact-links">' +
          surfaces.slice(0, 4).map((surface) => surface.path ? '<a href="' + escapeAttr(businessModuleContextHref(surface.path, ui.key, module, businessId)) + '" data-nav>' + escapeHtml(surface.label) + '</a>' : '<span>' + escapeHtml(surface.label) + '</span>').join("") +
        '</div></article>' +
      '</div>' +
    '</section>' +
    '<section class="glass-card phoenix-business-workflow-card"><div class="card-section-heading"><div><span class="section-kicker">Vertical Workflow</span><h2>جریان کاری این نوع کسب‌وکار</h2></div><span class="pill">' + escapeHtml(ui.label) + '</span></div><div class="phoenix-workflow-rail">' +
      workflow.map((step, index) => {
        const stage = businessWorkflowStageHref(ui.key, step, businessId, module);
        const current = stage.module === module ? " current" : "";
        const content = '<span>' + String(index + 1).padStart(2, "0") + '</span><strong>' + escapeHtml(step) + '</strong>';
        return stage.href
          ? '<a class="phoenix-workflow-step' + current + '" href="' + escapeAttr(stage.href) + '" data-nav>' + content + '<small>باز کردن ماژول ←</small></a>'
          : '<div class="phoenix-workflow-step' + current + '">' + content + '</div>';
      }).join("") +
    '</div><p>این rail اکنون به ماژول‌های canonical Workspace متصل است؛ جابه‌جایی بین مراحل state موازی ایجاد نمی‌کند.</p></section>' +
    '<section class="glass-card phoenix-module-actions-card"><div class="card-section-heading"><div><span class="section-kicker">Quick Actions</span><h2>کارهای مرتبط</h2></div></div><div class="phoenix-business-quick-actions">' +
      actions.map((action) => {
        const quickActionLinks = BUSINESS_QUICK_ACTION_LINKS[ui.key] ?? BUSINESS_QUICK_ACTION_LINKS.default ?? {};
        const target = quickActionLinks[action];
        return target
          ? '<a class="button button-secondary" href="' + escapeAttr(businessModuleContextHref(target, ui.key, module, businessId)) + '" data-nav>' + escapeHtml(action) + ' <span>←</span></a>'
          : '<span class="pill">' + escapeHtml(action) + '</span>';
      }).join("") +
    '</div></section>' +
    '<section class="glass-card phoenix-module-related-card"><div class="card-section-heading"><div><span class="section-kicker">Workspace Map</span><h2>ماژول‌های اطراف</h2></div></div><div class="phoenix-module-related-list">' +
      relatedModules.map((item) => { const href = businessModuleContextHref(businessModulePath(ui.key, item), ui.key, module, businessId); return '<a href="' + escapeAttr(href) + '" data-nav><span>' + escapeHtml(item) + '</span><b>→</b></a>'; }).join("") +
    '</div></section>' +
  '</div>';
}
function renderBusiness(): string {
  const businessId = localStorage.getItem(STORAGE.business) ?? "";
  const params = new URLSearchParams(location.search);
  const vertical = params.get("vertical")?.trim() || localStorage.getItem(STORAGE.businessVertical) || "default";
  const requestedModule = params.get("module")?.trim();
  if (requestedModule) {
    const ui = getBusinessVerticalUi(vertical);
    const resolvedModule = (ui.modules as readonly string[]).includes(requestedModule) ? requestedModule : undefined;
    if (resolvedModule) return renderBusinessModule(vertical, resolvedModule);
  }
  const ui = getBusinessVerticalUi(vertical);
  return '<div class="phoenix-business-page" data-business-vertical="' + ui.key + '">' +
    '<section class="phoenix-business-hero">' +
      '<div class="phoenix-business-hero-copy">' +
        '<span class="phoenix-kicker">Business Workspace</span>' +
        '<div class="phoenix-business-title-row"><span id="business-vertical-icon" class="phoenix-business-vertical-icon">' + ui.icon + '</span><div><h1 id="business-vertical-title">' + ui.label + '</h1><p id="business-vertical-subtitle">' + ui.subtitle + '</p></div></div>' +
        '<div class="phoenix-business-identity-line"><span id="business-header-name">فضای کاری شما</span><span id="business-header-status" class="pill">در حال بررسی</span><span id="business-header-role" class="pill">نقش: —</span></div>' +
      '</div>' +
      '<div class="phoenix-business-hero-actions"><button class="button button-ghost" type="button" data-business-create>ساخت کسب‌وکار</button><button class="button button-ghost" type="button" data-business-refresh>بروزرسانی</button><a class="button button-primary" href="/product-studio" data-nav>✦ Seller AI</a></div>' +
    '</section>' +

    '<section class="phoenix-business-attention">' +
      '<article class="glass-card phoenix-business-assistant"><div class="phoenix-business-assistant-mark"><img src="/phoenix-mark.svg?v=1" alt="" /></div><div><span class="section-kicker">Phoenix پیشنهاد می‌دهد</span><strong id="business-next-action">اولین کار مهم امروزت را مشخص کن.</strong><p id="business-next-detail">ماژول‌های این Workspace بر اساس نوع کسب‌وکار ترکیب می‌شوند؛ مجوزها همچنان توسط backend تعیین می‌شوند.</p></div><button class="button button-primary" type="button" data-business-primary-action>شروع کن <span>←</span></button></article>' +
      '<article class="glass-card phoenix-business-mini-status"><span class="section-kicker">Workspace</span><strong id="business-workspace-status">—</strong><small id="business-workspace-status-detail">—</small></article>' +
    '</section>' +

    '<section class="phoenix-business-board">' +
      (BUSINESS_VERTICAL_BOARD[ui.key] ?? BUSINESS_VERTICAL_BOARD.default ?? []).map((card) => {
        const href = card.path ? businessWorkspaceContextHref(card.path, ui.key, businessId || undefined) : "/business";
        return '<a class="glass-card phoenix-business-board-card" href="' + escapeAttr(href) + '" data-nav><span class="section-kicker">' + escapeHtml(card.eyebrow) + '</span><h3>' + escapeHtml(card.title) + '</h3><p>' + escapeHtml(card.description) + '</p><span class="phoenix-board-arrow">→</span></a>';
      }).join("") +
    '</section>' +

    renderVerticalWorkflowOverview({
      vertical: ui.key,
      ...(businessId ? { businessId } : {}),
      contextualHref: (path) => businessWorkspaceContextHref(path, ui.key, businessId || undefined),
    }) +
    '<section class="phoenix-business-role-actions glass-card">' +
      '<div class="card-section-heading"><div><span class="section-kicker">Role Focus</span><h2 id="business-role-focus-title">مسیر نقش شما</h2></div><span id="business-role-focus-badge" class="pill">—</span></div>' +
      '<div id="business-role-actions-grid" class="phoenix-business-role-actions-grid"><div class="slot-loading">در حال خواندن Role Lens…</div></div>' +
    '</section>' +

    '<section class="phoenix-business-metrics" id="business-vertical-metrics">' +
      ui.metrics.map((label, index) => '<article class="glass-card phoenix-business-metric"><span>' + label + '</span><strong id="business-metric-' + index + '">—</strong><small>اطلاعات canonical پس از اتصال</small></article>').join("") +
    '</section>' +

    '<section class="phoenix-business-layout">' +
      '<article class="glass-card phoenix-business-modules-card"><div class="card-section-heading"><div><span class="section-kicker">Workspace Modules</span><h2>ابزارهای مخصوص این کسب‌وکار</h2></div><span id="business-module-count" class="pill">—</span></div><div id="business-module-grid" class="phoenix-business-module-grid">' + ui.modules.map((module) => '<button class="phoenix-business-module" type="button" data-business-module="' + escapeAttr(module) + '"><span>◈</span><strong>' + module + '</strong><small>باز کردن</small></button>').join("") + '</div></article>' +

      '<aside class="phoenix-business-side">' +
        '<article class="glass-card phoenix-business-actions-card"><div class="card-section-heading"><div><span class="section-kicker">Quick Actions</span><h2>اقدام‌های سریع</h2></div></div><div id="business-quick-actions" class="phoenix-business-quick-actions">' + ui.actions.map((action) => '<button type="button" class="button button-secondary" data-business-quick-action data-business-quick-action-value="' + escapeAttr(action) + '">' + action + ' <span>←</span></button>').join("") + '</div></article>' +
        '<article class="glass-card ai-action-card"><span class="ai-badge">AI COPILOT</span><h2>عرضه را سریع‌تر آماده کن.</h2><p>از تصویر یا متن خام شروع کن؛ Seller AI پیش‌نویس می‌سازد و پذیرش نهایی همچنان دست کسب‌وکار می‌ماند.</p><a class="button button-primary" href="/product-studio" data-nav>باز کردن Product Studio <span>→</span></a></article>' +
      '</aside>' +
    '</section>' +

    '<section class="phoenix-business-brand-preview">' +
      '<article class="glass-card phoenix-brand-preview-card">' +
        '<div class="phoenix-brand-preview-cover"><div class="phoenix-brand-preview-mark"><img src="/phoenix-mark.svg?v=1" alt="" /></div></div>' +
        '<div class="phoenix-brand-preview-body"><div><span class="section-kicker">Public Brand</span><h2 id="business-brand-preview-name">نام کسب‌وکار</h2><p id="business-brand-preview-type">نوع کسب‌وکار</p></div><span id="business-brand-preview-status" class="pill">—</span></div>' +
        '<div class="phoenix-brand-preview-cta"><a class="button button-secondary" href="/business/profile" data-nav>مدیریت و Preview ↗</a>' + (businessId ? '<a class="button button-primary" href="/businesses/' + encodeURIComponent(businessId) + '" data-nav>نمای مشتری ↗</a>' : '') + '</div>' +
        '<div class="phoenix-brand-preview-facts"><span>Profile</span><span>Catalog</span><span>Contact</span><span>Trust</span></div>' +
      '</article>' +
      '<article class="glass-card phoenix-brand-preview-copy"><span class="section-kicker">Public Profile</span><h2>کسب‌وکار تو باید برای مشتری هم به همان اندازه واضح باشد.</h2><p>این پیش‌نمایش فقط بر اساس داده‌های canonical Business ساخته می‌شود؛ اطلاعات خصوصی Workspace در سطح عمومی نمایش داده نمی‌شود.</p><div class="phoenix-public-capability-list"><span>هویت کسب‌وکار</span><span>محصول و خدمت</span><span>اعتماد</span><span>ارتباط</span></div></article>' +
    '</section>' +

    '<section class="phoenix-business-public-preview glass-card">' +
      '<div class="card-section-heading"><div><span class="section-kicker">Customer Experience</span><h2>کاربر این کسب‌وکار را چگونه می‌بیند؟</h2></div><span class="pill success">Capability-driven</span></div>' +
      '<div id="business-customer-actions" class="phoenix-business-customer-actions">' + ui.customerActions.map((action) => '<span>' + action + '</span>').join("") + '</div>' +
      '<p>این Actionها باید فقط وقتی نمایش داده شوند که Capability متناظر در منبع canonical فعال باشد.</p>' +
    '</section>' +

    '<section class="phoenix-business-team-section">' +
      '<article class="glass-card phoenix-team-card">' +
        '<div class="card-section-heading"><div><span class="section-kicker">Team & Access</span><h2>تیم و نقش‌ها</h2></div><span id="business-team-count" class="pill">—</span></div>' +
        '<div class="phoenix-role-lens" id="business-role-lens"><span class="section-kicker">Role Lens</span><strong id="business-role-title">—</strong><p id="business-role-description">نقش و مجوزهای فعلی از context canonical خوانده می‌شوند.</p></div>' +
        '<div class="phoenix-permission-cloud" id="business-permissions"><span>در حال خواندن مجوزها…</span></div>' +
        '<div class="phoenix-team-list" id="business-team-list"><div class="slot-loading">در حال خواندن اعضای Workspace…</div></div>' +
        '<div class="phoenix-team-actions"><button class="button button-ghost" type="button" data-workspace-toggle>تغییر Workspace</button><button class="button button-primary" type="button" data-team-management>مدیریت تیم</button></div>' +
      '</article>' +
      '<article class="glass-card phoenix-role-guide">' +
        '<span class="section-kicker">Role-based Workspace</span><h2>هر نقش، مسیر خودش را دارد.</h2>' +
        '<div class="phoenix-role-guide-list">' +
          '<div><b>Owner / Admin</b><span>مدیریت، مالی، تیم، گزارش و تنظیمات</span></div>' +
          '<div><b>Sales</b><span>مشتریان، محصولات، پیام‌ها و معاملات</span></div>' +
          '<div><b>Specialist</b><span>خدمات، برنامه، رزرو و پروفایل تخصصی</span></div>' +
          '<div><b>Finance</b><span>پرداخت‌ها، تراکنش‌ها و گزارش مالی</span></div>' +
        '</div>' +
        '<p>این راهنما صرفاً composition رابط است؛ مجوز واقعی را backend تعیین می‌کند.</p>' +
      '</article>' +
    '</section>' +

    '<section class="business-grid phoenix-business-management-grid">' +
      '<article class="glass-card business-main"><div class="card-section-heading"><div><span class="section-kicker">Profile</span><h2>پروفایل کسب‌وکار</h2></div><span id="business-management-status" class="pill">در حال بررسی</span></div><div id="business-profile-content" class="business-profile-content"><div class="slot-empty"><span>▦</span><p>' + (businessId ? "در حال خواندن پروفایل…" : "یک Business ID برای مدیریت این فضای کاری ثبت کنید.") + '</p></div></div><div class="business-management-form"><input id="business-name-input" class="studio-input-line" placeholder="نام canonical" /><input id="business-display-name-input" class="studio-input-line" placeholder="نام نمایشی" /><div class="phoenix-business-type-picker"><input id="business-type-input" class="studio-input-line" placeholder="نوع کسب‌وکار" /><div class="phoenix-business-type-chips"><button type="button" data-business-type-choice="clinic">مطب / کلینیک</button><button type="button" data-business-type-choice="retail">فروشگاه</button><button type="button" data-business-type-choice="restaurant">رستوران</button><button type="button" data-business-type-choice="salon">سالن</button></div></div><input id="business-timezone-input" class="studio-input-line" placeholder="Timezone" /><input id="business-currency-input" class="studio-input-line" placeholder="Currency" /><button class="button button-primary" type="button" data-business-save>' + (businessId ? "ذخیره پروفایل" : "ابتدا Business بسازید") + '</button></div></article>' +
      '<article class="glass-card business-detail-card"><div class="card-section-heading"><div><span class="section-kicker">Locations</span><h2>مکان‌ها</h2></div><button class="button button-ghost" type="button" data-business-add-location>افزودن مکان</button></div><div id="business-locations" class="business-location-list"><div class="slot-empty"><span>⌖</span><p>داده مکان بعد از اتصال نمایش داده می‌شود.</p></div></div></article>' +
      '<article class="glass-card business-detail-card"><div class="card-section-heading"><div><span class="section-kicker">Availability</span><h2>ساعات فعال</h2></div></div><div id="business-hours" class="business-hours-list"><div class="slot-empty"><span>◷</span><p>ساعات بعد از اتصال نمایش داده می‌شوند.</p></div></div></article>' +
      '<article class="glass-card business-detail-card"><div class="card-section-heading"><div><span class="section-kicker">Contacts</span><h2>راه‌های تماس</h2></div></div><div id="business-contacts" class="metadata-cloud"><span>—</span></div></article>' +
      '<article class="glass-card business-detail-card"><div class="card-section-heading"><div><span class="section-kicker">Publication</span><h2>وضعیت انتشار</h2></div><span id="business-publication-status" class="pill">—</span></div><div id="business-publication-detail" class="connection-state">—</div></article>' +
      '<article class="glass-card business-detail-card"><div class="card-section-heading"><div><span class="section-kicker">Verification</span><h2>وضعیت احراز</h2></div><span id="business-verification-status" class="pill">—</span></div><div id="business-verification-detail" class="connection-state">در حال خواندن Verification…</div></article>' +
    '</section>' +
  '</div>';
}



function renderBusinessPublic(): string {
  return '<div class="phoenix-public-business-page">' +
    '<section class="phoenix-public-business-hero">' +
      '<div class="phoenix-public-business-hero-copy"><span class="phoenix-kicker">Phoenix Business</span><h1 id="public-business-page-name">کسب‌وکار</h1><p id="public-business-page-summary">در حال بارگذاری اطلاعات عمومی…</p><div id="public-business-page-meta" class="phoenix-public-business-meta"></div><div class="phoenix-public-business-hero-actions"><button class="button button-primary" type="button" id="public-business-follow">دنبال کردن</button><button class="button button-ghost" type="button" id="public-business-review">ثبت نظر</button><button class="button button-ghost" type="button" id="public-business-share">اشتراک‌گذاری</button></div></div>' +
      '<div class="phoenix-public-business-mark"><img src="/phoenix-mark.svg?v=1" alt="" /></div>' +
    '</section>' +
    '<section class="phoenix-public-business-content">' +
      '<article class="glass-card phoenix-public-business-identity"><div class="card-section-heading"><div><span class="section-kicker">Supply Identity</span><h2>هویت و عرضه</h2></div><span id="public-business-page-publication" class="pill success">published</span></div><div id="public-business-page-facts" class="phoenix-public-fact-grid"><div class="slot-loading">در حال بارگذاری…</div></div></article>' +
      '<article class="glass-card phoenix-public-business-offers"><div class="card-section-heading"><div><span class="section-kicker">Products & Services</span><h2>محصولات و خدمات منتشرشده</h2></div><span id="public-business-page-offer-count" class="pill">—</span></div><div id="public-business-page-offers" class="phoenix-public-offer-grid"><div class="slot-loading">در حال خواندن عرضه‌ها…</div></div></article>' +
      '<article class="glass-card phoenix-public-business-contact"><div class="card-section-heading"><div><span class="section-kicker">Contact</span><h2>راه‌های ارتباط</h2></div></div><div id="public-business-page-contacts" class="metadata-cloud"><span>—</span></div></article>' +
      '<article class="glass-card phoenix-public-business-location"><div class="card-section-heading"><div><span class="section-kicker">Locations</span><h2>مکان‌ها</h2></div></div><div id="public-business-page-locations" class="business-location-list"><div class="slot-loading">—</div></div></article>' +
      '<article class="glass-card phoenix-public-business-reviews"><div class="card-section-heading"><div><span class="section-kicker">Trust / Reviews</span><h2>تجربه‌های منتشرشده مشتریان</h2></div><span id="public-business-page-review-count" class="pill">—</span></div><div id="public-business-page-reviews" class="phoenix-public-review-list"><div class="slot-loading">در حال خواندن تجربه‌ها…</div></div></article>' +
    '</section>' +
    '<section class="glass-card phoenix-public-business-bridge"><span class="section-kicker">Phoenix Connection Layer</span><h2>از شناخت کسب‌وکار تا اقدام، یک مسیر واحد.</h2><p>این صفحه فقط عرضه‌های منتشرشده را نشان می‌دهد؛ اقدام بعدی دوباره به مسیرهای canonical خرید یا رزرو واگذار می‌شود.</p><div class="phoenix-public-capability-list"><span>Published Supply</span><span>Decision</span><span>Connect</span><span>Act</span></div></section>' +
  '</div>';
}
function renderBusinessProfile(): string {
  return '<div class="phoenix-business-profile-page">' +
    '<section class="phoenix-business-profile-hero">' +
      '<div><a class="button button-ghost" href="/business" data-nav>← Workspace</a><span class="phoenix-kicker">Public Business Profile</span><h1 id="public-business-name">پروفایل کسب‌وکار</h1><p id="public-business-summary">پروفایل عمومی از داده‌های canonical Business ساخته می‌شود.</p><div class="phoenix-business-profile-status-row"><span id="public-business-publication" class="pill">—</span><span id="public-business-type" class="pill">—</span></div></div>' +
      '<div class="phoenix-public-profile-mark"><img src="/phoenix-mark.svg?v=1" alt="" /></div>' +
    '</section>' +
    '<section class="phoenix-public-profile-grid">' +
      '<article class="glass-card phoenix-public-profile-main"><div class="card-section-heading"><div><span class="section-kicker">Identity</span><h2>هویت کسب‌وکار</h2></div></div><div id="public-business-identity" class="phoenix-public-fact-grid"><div class="slot-loading">در حال بارگذاری…</div></div></article>' +
      '<aside class="glass-card phoenix-public-trust-card"><span class="section-kicker">Trust & Publication</span><h2>اعتماد، قبل از نمایش عمومی</h2><p id="public-business-trust-copy">وضعیت انتشار و اعتماد از منبع canonical خوانده می‌شود.</p><div id="public-business-trust-facts" class="phoenix-public-capability-list"></div><div id="public-business-trust-signals" class="phoenix-public-trust-signals"></div><div id="public-business-publication-action" class="phoenix-public-publication-action"></div><a class="button button-ghost" href="/trust" data-nav>مشاهده Trust</a></aside>' +
    '</section>' +
    '<section class="phoenix-public-profile-grid">' +
      '<article class="glass-card"><div class="card-section-heading"><div><span class="section-kicker">Contact</span><h2>راه‌های ارتباط</h2></div></div><div id="public-business-contacts" class="metadata-cloud"><span>—</span></div></article>' +
      '<article class="glass-card"><div class="card-section-heading"><div><span class="section-kicker">Locations</span><h2>مکان‌ها</h2></div></div><div id="public-business-locations" class="business-location-list"><div class="slot-empty"><span>⌖</span><p>—</p></div></div></article>' +
    '</section>' +
    '<section class="glass-card phoenix-public-profile-footer"><span class="section-kicker">Canonical Boundary</span><strong>این صفحه Preview/management-facing است؛ انتشار واقعی فقط از مسیرهای canonical انجام می‌شود.</strong><p>تا وقتی mutation انتشار به این UI متصل نشده، وضعیت «منتشر» یا «در انتظار انتشار» جعل نمی‌شود.</p></section>' +
  '</div>';
}
async function loadBusinessModuleContext(): Promise<void> {
  const businessId = new URLSearchParams(location.search).get("business")?.trim() || localStorage.getItem(STORAGE.business);
  const businessNode = document.querySelector<HTMLElement>("#module-context-0");
  const verticalNode = document.querySelector<HTMLElement>("#module-context-1");
  const sourceNode = document.querySelector<HTMLElement>("#module-context-2");
  const accessNode = document.querySelector<HTMLElement>("#module-context-3");
  const roleTitleNode = document.querySelector<HTMLElement>("#module-role-title");
  const roleDescriptionNode = document.querySelector<HTMLElement>("#module-role-description");
  const roleFitNode = document.querySelector<HTMLElement>("#module-role-fit");
  const roleFitBadgeNode = document.querySelector<HTMLElement>("#module-role-fit-badge");
  const roleFitDetailNode = document.querySelector<HTMLElement>("#module-role-fit-detail");
  if (!businessNode || !verticalNode || !sourceNode || !accessNode) return;
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    accessNode.textContent = "بدون session";
    return;
  }
  if (!businessId) {
    businessNode.textContent = "Business لازم است";
    accessNode.textContent = "نیازمند Workspace context";
    return;
  }
  try {
    const [businessResponse, context] = await Promise.all([
      apiJson<{ data: { business: Record<string, unknown> } }>("/api/v1/businesses/" + encodeURIComponent(businessId) + "/management"),
      apiJson<{ roles?: string[]; permissions?: string[]; workspaceId?: string; authenticated?: boolean }>("/api/v1/context"),
    ]);
    const business = businessResponse.data.business;
    const canonicalVertical = getBusinessVerticalUi(getRecordString(business, ["businessType"]));
    const dynamicModule = parseBusinessModulePath(location.pathname);
    const selectedVertical = getBusinessVerticalUi(new URLSearchParams(location.search).get("vertical") ?? dynamicModule?.vertical ?? canonicalVertical.key);
    businessNode.textContent = getRecordString(business, ["displayName", "name"]) ?? compactId(businessId);
    verticalNode.textContent = canonicalVertical.key === selectedVertical.key ? canonicalVertical.label : canonicalVertical.label + " · URL context: " + selectedVertical.label;
    sourceNode.textContent = "Business / " + (getRecordString(business, ["publicationStatus"]) ?? "unpublished");
    accessNode.textContent = Array.isArray(context.permissions) && context.permissions.length ? "Context permissions loaded" : "Backend authoritative";
    const roles = Array.isArray(context.roles) ? context.roles : [];
    const roleLens = resolveVerticalRoleLens(roles);
    const navModules = document.querySelectorAll<HTMLElement>("[data-module-role-fit][data-module-key]");
    navModules.forEach((link) => {
      const moduleKey = link.dataset.moduleKey ?? "";
      if (!moduleKey) return;
      const blueprint = getVerticalModuleBlueprint(selectedVertical.key, moduleKey);
      const fit = getVerticalModuleRoleFit(blueprint, roleLens.key);
      link.dataset.roleFit = fit;
      link.classList.toggle("role-primary", fit === "primary");
      link.classList.toggle("role-shared", fit === "shared");
      const marker = link.querySelector<HTMLElement>("[data-module-role-marker]");
      if (marker) {
        marker.textContent = fit === "primary" ? "●" : "○";
        marker.title = fit === "primary" ? "تمرکز این نقش" : "سطح مشترک";
      }
      link.setAttribute("aria-label", moduleKey + " — " + (fit === "primary" ? "تمرکز این نقش" : "سطح مشترک"));
    });
    const moduleBlueprint = getVerticalModuleBlueprint(selectedVertical.key, dynamicModule?.module ?? new URLSearchParams(location.search).get("module") ?? "");
    const roleFit = getVerticalModuleRoleFit(moduleBlueprint, roleLens.key);
    if (roleTitleNode) roleTitleNode.textContent = roleLens.title;
    if (roleDescriptionNode) roleDescriptionNode.textContent = roleLens.description;
    if (roleFitNode) roleFitNode.textContent = roleFit === "primary" ? "Primary emphasis" : "Shared surface";
    if (roleFitBadgeNode) {
      roleFitBadgeNode.textContent = roleFit === "primary" ? "Focus aligned" : "Shared";
      roleFitBadgeNode.className = roleFit === "primary" ? "pill success" : "pill";
    }
    if (roleFitDetailNode) {
      const lenses = moduleBlueprint.roleLenses ?? ["generic"];
      roleFitDetailNode.textContent = "Blueprint roles: " + lenses.join(" · ");
    }
  } catch (error) {
    accessNode.textContent = error instanceof Error ? error.message : "Context خوانده نشد";
  }
}
async function loadBusinessAccess(): Promise<void> {
  const status = document.querySelector<HTMLElement>("#business-management-status");
  const profile = document.querySelector<HTMLElement>("#business-profile-content");
  const locations = document.querySelector<HTMLElement>("#business-locations");
  const hours = document.querySelector<HTMLElement>("#business-hours");
  const contacts = document.querySelector<HTMLElement>("#business-contacts");
  const publication = document.querySelector<HTMLElement>("#business-publication-status");
  const publicationDetail = document.querySelector<HTMLElement>("#business-publication-detail");
  const verificationStatus = document.querySelector<HTMLElement>("#business-verification-status");
  const verificationDetail = document.querySelector<HTMLElement>("#business-verification-detail");
  if (!status || !profile || !locations || !hours || !contacts || !publication || !publicationDetail || !verificationStatus || !verificationDetail) return;
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
    const [response, context, membersResponse, verificationResponse] = await Promise.all([
      apiJson<{ data: { business: Record<string, unknown>; locations: Array<Record<string, unknown>>; hours: Array<Record<string, unknown>>; contacts: Array<Record<string, unknown>>; socialLinks: Array<Record<string, unknown>> } }>(
        `/api/v1/businesses/${encodeURIComponent(businessId)}/management`,
      ),
      apiJson<{ authenticated?: boolean; actorId?: string; roles?: string[]; permissions?: string[]; workspaceId?: string }>("/api/v1/context").catch(() => ({ authenticated: false, actorId: undefined, roles: [] as string[], permissions: [] as string[], workspaceId: undefined })),
      shellContext.workspaceId
        ? apiJson<{ data: Array<{ id: string; userId: string; status: string }> }>(`/api/v1/workspaces/${encodeURIComponent(shellContext.workspaceId)}/members`).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
      apiJson<{ data: Array<{ id: string; status: string; policyId: string; policyVersion: string }> }>(
        `/api/v1/trust/verification-cases?subjectType=business&subjectId=${encodeURIComponent(businessId)}&limit=10`,
      ).catch(() => ({ data: [] })),
    ]);
    const business = response.data.business;
    const verificationCases = Array.isArray(verificationResponse.data) ? verificationResponse.data : [];
    const latestVerification = verificationCases[0];
    const vertical = getBusinessVerticalUi(business.businessType);
    const requestedModule = new URLSearchParams(location.search).get("module")?.trim();
    const previousVertical = localStorage.getItem(STORAGE.businessVertical);
    localStorage.setItem(STORAGE.businessVertical, vertical.key);
    if (requestedModule && previousVertical && previousVertical !== vertical.key) {
      render();
      return;
    }
    const verticalRoot = document.querySelector<HTMLElement>(".phoenix-business-page");
    if (verticalRoot) verticalRoot.dataset.businessVertical = vertical.key;
    const verticalIcon = document.querySelector<HTMLElement>("#business-vertical-icon");
    const verticalTitle = document.querySelector<HTMLElement>("#business-vertical-title");
    const verticalSubtitle = document.querySelector<HTMLElement>("#business-vertical-subtitle");
    const headerName = document.querySelector<HTMLElement>("#business-header-name");
    const headerStatus = document.querySelector<HTMLElement>("#business-header-status");
    const nextAction = document.querySelector<HTMLElement>("#business-next-action");
    const nextDetail = document.querySelector<HTMLElement>("#business-next-detail");
    const moduleCount = document.querySelector<HTMLElement>("#business-module-count");
    const moduleGrid = document.querySelector<HTMLElement>("#business-module-grid");
    const quickActions = document.querySelector<HTMLElement>("#business-quick-actions");
    const customerActions = document.querySelector<HTMLElement>("#business-customer-actions");
    const brandPreviewName = document.querySelector<HTMLElement>("#business-brand-preview-name");
    const brandPreviewType = document.querySelector<HTMLElement>("#business-brand-preview-type");
    const brandPreviewStatus = document.querySelector<HTMLElement>("#business-brand-preview-status");
    const headerRole = document.querySelector<HTMLElement>("#business-header-role");
    const roleTitle = document.querySelector<HTMLElement>("#business-role-title");
    const roleDescription = document.querySelector<HTMLElement>("#business-role-description");
    const roleFocusTitle = document.querySelector<HTMLElement>("#business-role-focus-title");
    const roleFocusBadge = document.querySelector<HTMLElement>("#business-role-focus-badge");
    const roleActionsGrid = document.querySelector<HTMLElement>("#business-role-actions-grid");
    const permissionsHost = document.querySelector<HTMLElement>("#business-permissions");
    const teamList = document.querySelector<HTMLElement>("#business-team-list");
    const teamCount = document.querySelector<HTMLElement>("#business-team-count");
    if (verticalIcon) verticalIcon.textContent = vertical.icon;
    if (verticalTitle) verticalTitle.textContent = vertical.label;
    if (verticalSubtitle) verticalSubtitle.textContent = vertical.subtitle;
    if (headerName) headerName.textContent = getRecordString(business, ["displayName","name"]) ?? "فضای کاری شما";
    if (brandPreviewName) brandPreviewName.textContent = getRecordString(business, ["displayName","name"]) ?? "نام کسب‌وکار";
    if (brandPreviewType) brandPreviewType.textContent = vertical.label;
    if (brandPreviewStatus) { const publicationPreview = getRecordString(business, ["publicationStatus"]) ?? "unpublished"; brandPreviewStatus.textContent = publicationPreview === "published" ? "منتشر" : "پیش‌نویس"; brandPreviewStatus.className = publicationPreview === "published" ? "pill success" : "pill warning"; }
    if (headerStatus) { headerStatus.textContent = getRecordString(business, ["status"]) ?? "—"; headerStatus.className = getRecordString(business, ["status"]) === "active" ? "pill success" : "pill warning"; }
    if (nextAction) nextAction.textContent = vertical.actions[0] ?? "اقدام بعدی را شروع کن.";
    if (nextDetail) nextDetail.textContent = vertical.subtitle;
    if (moduleCount) moduleCount.textContent = String(vertical.modules.length) + " ماژول";
    if (moduleGrid) moduleGrid.innerHTML = vertical.modules.map((module) => '<button class="phoenix-business-module" type="button" data-business-module="' + escapeAttr(module) + '"><span>◈</span><strong>' + escapeHtml(module) + '</strong><small>باز کردن</small></button>').join("");
    if (quickActions) quickActions.innerHTML = vertical.actions.map((action) => '<button type="button" class="button button-secondary" data-business-quick-action data-business-quick-action-value="' + escapeAttr(action) + '">' + escapeHtml(action) + ' <span>←</span></button>').join("");
    if (customerActions) customerActions.innerHTML = vertical.customerActions.map((action) => '<span>' + escapeHtml(action) + '</span>').join("");
    bindBusinessWorkspaceDynamicEvents();
    const roles = Array.isArray(context.roles) ? context.roles : [];
    const permissions = Array.isArray(context.permissions) ? context.permissions : [];
    const roleText = roles.length ? roles.join(" · ") : "نقش مشخص نشده";
    const lowerRoles = roles.map((role) => role.toLowerCase());
    const roleLens = lowerRoles.some((role) => /owner|admin|manager/.test(role))
      ? { title: "مدیریت Workspace", description: "نمای کلی، تیم، مالی، گزارش و تنظیمات برای نقش مدیریتی در اولویت قرار می‌گیرند." }
      : lowerRoles.some((role) => /sales|seller/.test(role))
        ? { title: "عملیات فروش", description: "مشتریان، محصولات، پیام‌ها و معاملات در اولویت این نقش هستند." }
        : lowerRoles.some((role) => /doctor|specialist|provider/.test(role))
          ? { title: "عملیات تخصصی", description: "خدمات، برنامه، رزرو و پروفایل تخصصی در اولویت این نقش هستند." }
          : lowerRoles.some((role) => /finance|account/.test(role))
            ? { title: "عملیات مالی", description: "پرداخت‌ها، تراکنش‌ها و گزارش‌های مالی در اولویت این نقش هستند." }
            : { title: "Workspace عمومی", description: "ماژول‌ها براساس Business Type و Capabilityهای فعال ترکیب می‌شوند." };
    if (headerRole) headerRole.textContent = "نقش: " + roleText;
    if (roleTitle) roleTitle.textContent = roleLens.title;
    if (roleDescription) roleDescription.textContent = roleLens.description;
    const roleKey = roleLens.title === "مدیریت Workspace" ? "management" : roleLens.title === "عملیات فروش" ? "sales" : roleLens.title === "عملیات تخصصی" ? "specialist" : roleLens.title === "عملیات مالی" ? "finance" : "generic";
    const roleActions = BUSINESS_ROLE_ACTIONS[roleKey] ?? BUSINESS_ROLE_ACTIONS.generic ?? [];
    if (roleFocusTitle) roleFocusTitle.textContent = roleLens.title;
    if (roleFocusBadge) roleFocusBadge.textContent = roleText;
    if (roleActionsGrid) roleActionsGrid.innerHTML = roleActions.map((item) => {
      const href = businessWorkspaceContextHref(item.path, vertical.key, businessId || undefined);
      return '<a class="phoenix-business-role-action" href="' + escapeAttr(href) + '" data-nav><strong>' + escapeHtml(item.label) + '</strong><span>' + escapeHtml(item.description) + '</span><b>→</b></a>';
    }).join("");
    if (permissionsHost) permissionsHost.innerHTML = permissions.length
      ? permissions.slice(0, 24).map((permission) => '<span class="phoenix-permission-chip">' + escapeHtml(permission) + '</span>').join("")
      : '<span class="permission-empty">Permission فعلی در context برنگشت.</span>';
    const teamItems = Array.isArray(membersResponse.data) ? membersResponse.data : [];
    if (teamCount) teamCount.textContent = String(teamItems.length) + " عضو";
    if (teamList) teamList.innerHTML = teamItems.length
      ? teamItems.map((member) => '<div class="phoenix-team-row"><span class="phoenix-team-avatar">' + escapeHtml((member.userId || "U").slice(0,1).toUpperCase()) + '</span><div><strong>' + escapeHtml(member.userId) + '</strong><small>' + escapeHtml(member.status) + (member.userId === context.actorId ? " · شما" : "") + '</small></div><span class="pill ' + (member.status === "active" ? "success" : "warning") + '">' + escapeHtml(member.status) + '</span></div>').join("")
      : '<div class="slot-empty"><span>◎</span><p>عضو دیگری در Workspace پیدا نشد یا دسترسی خواندن اعضا فراهم نیست.</p></div>';
    for (let i = 0; i < vertical.metrics.length; i += 1) {
      const metric = document.querySelector<HTMLElement>("#business-metric-" + i);
      if (metric) metric.textContent = "—";
    }
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
    if (latestVerification) {
      verificationStatus.textContent=latestVerification.status;
      verificationStatus.className=latestVerification.status==="approved"?"pill success":latestVerification.status==="rejected"||latestVerification.status==="expired"?"pill warning":"pill";
      verificationDetail.textContent=latestVerification.policyId+" · v"+latestVerification.policyVersion;
    } else {
      verificationStatus.textContent="شروع نشده";
      verificationStatus.className="pill warning";
      verificationDetail.textContent="Verification Case برای این Business پیدا نشد یا Permission خواندن در دسترس نیست.";
    }
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

async function loadBusinessProfile(): Promise<void> {
  const businessId = localStorage.getItem(STORAGE.business);
  const identity = document.querySelector<HTMLElement>("#public-business-identity");
  const contacts = document.querySelector<HTMLElement>("#public-business-contacts");
  const locations = document.querySelector<HTMLElement>("#public-business-locations");
  const publication = document.querySelector<HTMLElement>("#public-business-publication");
  const type = document.querySelector<HTMLElement>("#public-business-type");
  const name = document.querySelector<HTMLElement>("#public-business-name");
  const summary = document.querySelector<HTMLElement>("#public-business-summary");
  const trustCopy = document.querySelector<HTMLElement>("#public-business-trust-copy");
  const trustFacts = document.querySelector<HTMLElement>("#public-business-trust-facts");
  const trustSignals = document.querySelector<HTMLElement>("#public-business-trust-signals");
  const publicationAction = document.querySelector<HTMLElement>("#public-business-publication-action");
  if (!identity || !contacts || !locations || !publication || !type || !name || !summary || !trustCopy || !trustFacts || !trustSignals || !publicationAction) return;
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    identity.innerHTML='<div class="slot-empty"><span>↪</span><p>برای مشاهده Preview به session Workspace نیاز است.</p></div>';
    return;
  }
  if (!businessId) {
    identity.innerHTML='<div class="slot-empty"><span>▦</span><p>Business ID ثبت نشده است.</p></div>';
    return;
  }
  try {
    const [response, context, trustResponse] = await Promise.all([
      apiJson<{ data: { business: Record<string, unknown>; locations: Array<Record<string, unknown>>; hours: Array<Record<string, unknown>>; contacts: Array<Record<string, unknown>>; socialLinks: Array<Record<string, unknown>> } }>(
        "/api/v1/businesses/" + encodeURIComponent(businessId) + "/management",
      ),
      apiJson<{ authenticated?: boolean; actorId?: string; roles?: string[]; permissions?: string[]; workspaceId?: string }>("/api/v1/context").catch(() => ({ authenticated: false, actorId: undefined, roles: [] as string[], permissions: [] as string[], workspaceId: undefined })),
      apiJson<{ data: Array<{ signalType?: string; severity?: string; confidence?: number | null; status?: string }> }>(
        "/api/v1/trust/signals?subjectType=business&subjectId=" + encodeURIComponent(businessId) + "&status=active&limit=20",
      ).catch(() => ({ data: [] })),
    ]);
    const business=response.data.business;
    const trustSignalItems = Array.isArray(trustResponse.data) ? trustResponse.data : [];
    const displayName=getRecordString(business,["displayName","name"])??"کسب‌وکار";
    const businessType=getRecordString(business,["businessType"])??"Business";
    const publicationValue=getRecordString(business,["publicationStatus"])??"unpublished";
    name.textContent=displayName;
    summary.textContent=getRecordString(business,["description","summary"])??"پروفایل عمومی بر اساس داده‌های canonical Business.";
    type.textContent=businessType;
    publication.textContent=publicationValue;
    publication.className=publicationValue==="published"?"pill success":"pill warning";
    const canPublish = Array.isArray(context.permissions) && context.permissions.includes("business.publish");
    if (publicationValue === "published") {
      publicationAction.innerHTML = '<span class="pill success">انتشار عمومی فعال است</span>';
    } else if (publicationValue === "pending") {
      publicationAction.innerHTML = '<span class="pill warning">در انتظار بررسی / سیاست انتشار</span>';
    } else if (publicationValue === "blocked") {
      publicationAction.innerHTML = (canPublish ? '<span class="pill warning">انتشار مسدود است</span>' : '<span class="pill warning">انتشار مسدود است</span>');
    } else if (canPublish) {
      publicationAction.innerHTML = '<button class="button button-primary" type="button" data-request-business-publication>درخواست انتشار</button>';
      publicationAction.querySelector<HTMLButtonElement>("[data-request-business-publication]")?.addEventListener("click", () => void requestBusinessPublication());
    } else {
      publicationAction.innerHTML = '<span class="pill">مجوز درخواست انتشار در context فعلی موجود نیست</span>';
    }
    identity.innerHTML=
      '<div><span>نام رسمی</span><strong>'+escapeHtml(getRecordString(business,["name"])??"—")+'</strong></div>' +
      '<div><span>نام نمایشی</span><strong>'+escapeHtml(displayName)+'</strong></div>' +
      '<div><span>وضعیت</span><strong>'+escapeHtml(getRecordString(business,["status"])??"—")+'</strong></div>' +
      '<div><span>Locale</span><strong>'+escapeHtml(getRecordString(business,["defaultLocale"])??"—")+'</strong></div>' +
      '<div><span>Timezone</span><strong>'+escapeHtml(getRecordString(business,["timezone"])??"—")+'</strong></div>' +
      '<div><span>Currency</span><strong>'+escapeHtml(getRecordString(business,["defaultCurrency"])??"—")+'</strong></div>';
    contacts.innerHTML=response.data.contacts.length
      ? response.data.contacts.map((item)=>'<span><b>'+escapeHtml(getRecordString(item,["contactType"])??"contact")+'</b> '+escapeHtml(getRecordString(item,["value"])??"—")+'</span>').join("")
      : '<span>راه ارتباط عمومی ثبت نشده است.</span>';
    locations.innerHTML=response.data.locations.length
      ? response.data.locations.map((item)=>'<div class="business-location-item"><div><strong>'+escapeHtml(getRecordString(item,["name"])??"Location")+'</strong><small>'+escapeHtml(getRecordString(item,["locationType"])??"—")+' · '+escapeHtml(getRecordString(item,["timezone"])??"—")+'</small></div><span class="pill '+(getRecordString(item,["status"])==="active"?"success":"warning")+'">'+escapeHtml(getRecordString(item,["status"])??"—")+'</span></div>').join("")
      : '<div class="slot-empty"><span>⌖</span><p>مکان عمومی ثبت نشده است.</p></div>';
    if(publicationValue==="published"){
      trustCopy.textContent="Business در وضعیت انتشار عمومی قرار دارد؛ جزئیات حساس Workspace در این Preview نمایش داده نمی‌شود.";
      trustFacts.innerHTML='<span>Published</span><span>Public identity</span><span>Canonical Business</span>';
    } else {
      trustCopy.textContent="Business هنوز published نیست؛ این صفحه فقط Preview امن و داخلی از اطلاعاتی است که canonical management برمی‌گرداند.";
      trustFacts.innerHTML='<span>Preview</span><span>Publication gate</span><span>Canonical status</span>';
    }
    trustSignals.innerHTML = trustSignalItems.length
      ? trustSignalItems.slice(0, 8).map((signal) => '<div class="phoenix-trust-signal-row"><span class="pill ' + (signal.severity === "high" || signal.severity === "critical" ? "warning" : "success") + '">' + escapeHtml(signal.severity ?? "info") + '</span><div><strong>' + escapeHtml(signal.signalType ?? "trust signal") + '</strong><small>' + escapeHtml(signal.status ?? "active") + (signal.confidence !== null && signal.confidence !== undefined ? " · " + Math.round(signal.confidence * 100) + "%" : "") + '</small></div></div>').join("")
      : '<div class="phoenix-trust-signal-empty">در context فعلی Trust Signal عمومی فعالی برای این Business برنگشت.</div>';
  } catch(error) {
    identity.innerHTML='<div class="slot-empty"><span>!</span><p>'+escapeHtml(error instanceof Error ? error.message : "خواندن پروفایل ناموفق بود.")+'</p></div>';
    contacts.innerHTML='<span>راه‌های تماس در دسترس نیست.</span>';
    locations.innerHTML='<div class="slot-empty"><span>!</span><p>Locations در دسترس نیست.</p></div>';
  }
}
function openPublicBusinessReview(routePath: string): void {
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  const customerId = localStorage.getItem(STORAGE.customer);
  const businessId = routePath.split("/").filter(Boolean)[1] ?? "";
  if (!businessId) return;
  if (!customerId) {
    showToast("برای ثبت نظر، Customer context این حساب هنوز آماده نیست.");
    return;
  }
  openSimpleFormDialog("نظر درباره کسب‌وکار", "Trust / Review", [
    { id: "public-review-rating", label: "امتیاز (۱ تا ۵)", placeholder: "5", value: "5" },
    { id: "public-review-content", label: "نظر", placeholder: "تجربه شما…", value: "" },
  ], async (dialog) => {
    const rating = Number(dialog.querySelector<HTMLInputElement>("#public-review-rating")?.value ?? "0");
    const content = dialog.querySelector<HTMLInputElement>("#public-review-content")?.value.trim() ?? "";
    if (!Number.isSafeInteger(rating) || rating < 1 || rating > 5) { showToast("امتیاز باید بین ۱ تا ۵ باشد."); return false; }
    try {
      await apiJson("/api/v1/trust/reviews", { method: "POST", body: { customerId, ratingValue: rating, ...(content ? { content } : {}), businessId } });
      showToast("نظر برای بررسی Trust ثبت شد.");
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "ثبت نظر ناموفق بود.");
      return false;
    }
  });
}
async function togglePublicBusinessFollow(routePath: string): Promise<void> {
  if (!sessionStorage.getItem(STORAGE.accessToken)) { openConnectionPanel(); return; }
  const businessId = routePath.split("/").filter(Boolean)[1] ?? "";
  if (!businessId) return;
  const button = document.querySelector<HTMLButtonElement>("#public-business-follow");
  if (button) { button.disabled = true; button.textContent = "در حال ثبت…"; }
  try {
    const followed = await persistSocialFollow({
      id: businessId,
      sourceType: "business",
      sourceId: businessId,
      title: document.querySelector<HTMLElement>("#public-business-page-name")?.textContent ?? "Business",
      metadata: { businessId },
    });
    if (button) { button.disabled = false; button.textContent = followed ? "دنبال شد ✓" : "دنبال کردن"; }
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = "دنبال کردن"; }
    showToast(error instanceof Error ? error.message : "ثبت Follow ناموفق بود.");
  }
}

async function sharePublicBusiness(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("لینک پروفایل کپی شد.");
  } catch {
    showToast(window.location.href);
  }
}
async function loadBusinessPublicPage(routePath: string): Promise<void> {
  const businessId = routePath.split("/").filter(Boolean)[1] ?? "";
  const name = document.querySelector<HTMLElement>("#public-business-page-name");
  const summary = document.querySelector<HTMLElement>("#public-business-page-summary");
  const meta = document.querySelector<HTMLElement>("#public-business-page-meta");
  const publication = document.querySelector<HTMLElement>("#public-business-page-publication");
  const facts = document.querySelector<HTMLElement>("#public-business-page-facts");
  const offersHost = document.querySelector<HTMLElement>("#public-business-page-offers");
  const offerCount = document.querySelector<HTMLElement>("#public-business-page-offer-count");
  const contactsHost = document.querySelector<HTMLElement>("#public-business-page-contacts");
  const locationsHost = document.querySelector<HTMLElement>("#public-business-page-locations");
  const reviewsHost = document.querySelector<HTMLElement>("#public-business-page-reviews");
  const reviewCount = document.querySelector<HTMLElement>("#public-business-page-review-count");
  if (!businessId || !name || !summary || !meta || !publication || !facts || !offersHost || !offerCount || !contactsHost || !locationsHost || !reviewsHost || !reviewCount) return;
  try {
    const response = await apiJson<{ data: { profile: { id: string; name: string; displayName: string; status: string; publicationStatus: string; businessType: string | null; primaryCategoryId: string | null; defaultLocale: string | null; timezone: string | null; defaultCurrency: string | null; updatedAt: string }; contacts: Array<{ contactType?: string; value?: string; isPrimary?: boolean }>; locations: Array<{ name?: string; locationType?: string; timezone?: string | null; address?: Record<string, unknown> | null }>; reviews: Array<{ id: string; customerId: string; ratingValue: number; content: string | null; publishedAt: string | null; createdAt: string }>; offers: Array<{ id: string; businessId: string; offeringType: "product" | "service"; title: string; description: string | null; productId: string | null; serviceId: string | null; priceAmountMinor: number | null; currency: string | null; pricingType: string | null }> } }>(
      "/api/v1/public/businesses/" + encodeURIComponent(businessId) + "?limit=50",
    );
    const profile = response.data.profile;
    name.textContent = profile.displayName || profile.name;
    summary.textContent = "اطلاعات منتشرشده و عرضه‌های فعال " + (profile.businessType ? "در حوزه " + profile.businessType : "این کسب‌وکار") + ".";
    publication.textContent = profile.publicationStatus;
    meta.innerHTML = [profile.businessType, profile.defaultLocale, profile.timezone, profile.defaultCurrency].filter(Boolean).map((value) => '<span>' + escapeHtml(String(value)) + '</span>').join("");
    facts.innerHTML = '<div><span>نام رسمی</span><strong>' + escapeHtml(profile.name) + '</strong></div>' +
      '<div><span>نوع کسب‌وکار</span><strong>' + escapeHtml(profile.businessType ?? "—") + '</strong></div>' +
      '<div><span>Locale</span><strong>' + escapeHtml(profile.defaultLocale ?? "—") + '</strong></div>' +
      '<div><span>ارز</span><strong>' + escapeHtml(profile.defaultCurrency ?? "—") + '</strong></div>';
    contactsHost.innerHTML = response.data.contacts.length
      ? response.data.contacts.map((contact) => {
          const type = contact.contactType ?? "contact";
          const value = contact.value ?? "—";
          const href = type === "phone" ? "tel:" + encodeURIComponent(value) : type === "email" ? "mailto:" + encodeURIComponent(value) : type === "website" ? (value.startsWith("http://") || value.startsWith("https://") ? value : "https://" + value) : "";
          const content = href ? '<a href="' + escapeAttr(href) + '" target="_blank" rel="noopener noreferrer"><b>' + escapeHtml(type) + '</b> ' + escapeHtml(value) + '</a>' : '<span><b>' + escapeHtml(type) + '</b> ' + escapeHtml(value) + '</span>';
          return content;
        }).join("")
      : '<span>راه ارتباط عمومی ثبت نشده است.</span>';
    locationsHost.innerHTML = response.data.locations.length
      ? response.data.locations.map((location) => '<div class="business-location-item"><div><strong>' + escapeHtml(location.name ?? "Location") + '</strong><small>' + escapeHtml(location.locationType ?? "—") + (location.timezone ? " · " + escapeHtml(location.timezone) : "") + '</small></div></div>').join("")
      : '<div class="slot-empty"><span>⌖</span><p>مکان عمومی ثبت نشده است.</p></div>';
    reviewCount.textContent = response.data.reviews.length + " نظر";
    reviewsHost.innerHTML = response.data.reviews.length
      ? response.data.reviews.map((review) => '<article class="phoenix-public-review-card"><div class="phoenix-public-review-rating">' + "★".repeat(Math.max(0, Math.min(5, Math.trunc(review.ratingValue)))) + '</div><p>' + escapeHtml(review.content ?? "") + '</p><small>تجربه منتشرشده · ' + escapeHtml(review.publishedAt ?? review.createdAt) + '</small></article>').join("")
      : '<div class="slot-empty"><span>◌</span><p>هنوز نظر منتشرشده‌ای برای این کسب‌وکار موجود نیست.</p></div>';
    offerCount.textContent = response.data.offers.length + " عرضه";
    if (!response.data.offers.length) {
      offersHost.innerHTML = '<div class="slot-empty"><span>◇</span><p>هنوز عرضه منتشرشده‌ای برای این کسب‌وکار در دسترس نیست.</p></div>';
      return;
    }
    offersHost.innerHTML = response.data.offers.map((offer) => {
      const price = offer.priceAmountMinor !== null && offer.currency ? formatPublicMoney(offer.priceAmountMinor, offer.currency) : "قیمت پس از انتخاب";
      const action = offer.offeringType === "product"
        ? '<a class="button button-primary" href="/checkout?entity=' + encodeURIComponent(offer.id) + '&type=offering" data-nav>خرید فوری ↗</a>'
        : '<a class="button button-secondary" href="/booking?offering=' + encodeURIComponent(offer.id) + '" data-nav>رزرو ↗</a>';
      return '<article class="phoenix-public-offer-card"><div class="phoenix-public-offer-icon">' + (offer.offeringType === "product" ? "▦" : "◷") + '</div><div class="phoenix-public-offer-body"><span class="section-kicker">' + escapeHtml(offer.offeringType === "product" ? "Product" : "Service") + '</span><h3>' + escapeHtml(offer.title) + '</h3><p>' + escapeHtml(offer.description ?? "توضیح تکمیلی برای این عرضه ثبت نشده است.") + '</p><strong>' + escapeHtml(price) + '</strong></div><div class="phoenix-public-offer-action">' + action + '</div></article>';
    }).join("");
  } catch (error) {
    summary.textContent = error instanceof Error ? error.message : "پروفایل عمومی در دسترس نیست.";
    facts.innerHTML = '<div class="slot-empty"><span>!</span><p>خواندن Business عمومی ناموفق بود.</p></div>';
    offersHost.innerHTML = "";
    reviewsHost.innerHTML = "";
  }
}

function formatPublicMoney(amountMinor: number, currency: string): string {
  try {
    const formatter = new Intl.NumberFormat("fa-IR", { style: "currency", currency });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
    return formatter.format(amountMinor / (10 ** fractionDigits));
  } catch {
    return String(amountMinor) + " " + currency;
  }
}
function compactId(value?: string): string {
  if (!value) return "—";
  return value.length > 12 ? value.slice(0, 6) + "…" + value.slice(-4) : value;
}

async function requestBusinessPublication(): Promise<void> {
  const businessId = localStorage.getItem(STORAGE.business);
  if (!businessId) {
    showToast("Business ID لازم است.");
    return;
  }
  const button = document.querySelector<HTMLButtonElement>("[data-request-business-publication]");
  if (button) {
    button.disabled = true;
    button.textContent = "در حال ارسال…";
  }
  try {
    await apiJson("/api/v1/businesses/" + encodeURIComponent(businessId) + "/submit", { method: "POST" });
    showToast("درخواست انتشار ثبت شد و وارد وضعیت canonical شد.");
    await loadBusinessProfile();
    const businessPage = location.pathname === "/business";
    if (businessPage) await loadBusinessAccess();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "درخواست انتشار ناموفق بود.");
    if (button) {
      button.disabled = false;
      button.textContent = "درخواست انتشار";
    }
  }
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

function openCreatePostPanel(): void {
  const overlay = document.createElement("div");
  overlay.className = "connection-overlay";
  overlay.innerHTML = '<div class="connection-backdrop" data-close-create-post></div><section class="connection-modal glass-card phoenix-create-post-modal" role="dialog" aria-modal="true"><button class="connection-close" type="button" data-close-create-post aria-label="بستن">×</button><span class="eyebrow"><i></i> افزودن</span><h2>نوشتن کالا یا خدمت</h2><p>کالا یا خدمتت رو بنویس؛ هوش مصنوعی اون رو به فروشگاهت اضافه می‌کنه.</p><label class="field-label" for="social-post-text">توضیح</label><textarea id="social-post-text" class="studio-input-line" rows="5" placeholder="مثلاً: میز کار چوبی دست‌ساز، مناسب اتاق کوچک..."></textarea><div class="connection-actions"><button class="button button-ghost" type="button" data-close-create-post>انصراف</button><button class="button button-primary" type="button" data-create-post-submit>ادامه</button></div></section>';
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLElement>("[data-close-create-post]").forEach((node) => node.addEventListener("click", () => overlay.remove()));
  overlay.querySelector<HTMLButtonElement>("[data-create-post-submit]")?.addEventListener("click", () => {
    const value = overlay.querySelector<HTMLTextAreaElement>("#social-post-text")?.value.trim() ?? "";
    if (!value) { showToast("توضیح محصول یا خدمت را وارد کن."); return; }
    sessionStorage.setItem("phoenix-social-create-draft", value);
    overlay.remove();
    navigate("/product-studio");
  });
}

function bindDiscoveryResultEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-discovery-index]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if ((event.target as Element | null)?.closest("button[data-compare],button[data-like],button[data-save],button[data-follow],button[data-comment],button[data-share],button[data-open-view]")) return;
      const index = Number(button.dataset.discoveryIndex);
      const item = Number.isInteger(index) ? activeDiscoveryItems[index] : undefined;
      if (item) openDiscoveryResultPanel(item);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-compare]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCompareByKey(button.dataset.compare ?? "");
      refreshSocialFeed();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-follow],[data-like],[data-save],[data-comment],[data-share],[data-open-view]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const card = button.closest<HTMLElement>(".phoenix-post-card");
      const index = Number(card?.querySelector<HTMLElement>("[data-discovery-index]")?.dataset.discoveryIndex ?? "-1");
      const item = Number.isInteger(index) ? activeDiscoveryItems[index] : undefined;
      if (!item) return;
      const original = button.innerHTML;
      button.disabled = true;
      try {
        let active = false;
        if (button.dataset.follow !== undefined) active = await persistSocialFollow(item);
        else if (button.dataset.like !== undefined) active = await persistSocialAction("like", item);
        else if (button.dataset.save !== undefined) active = await persistSocialAction("save", item);
        else if (button.dataset.share !== undefined) {
          await shareSocialItem(item);
          active = true;
        } else if (button.dataset.openView !== undefined) {
          const type = item.sourceType ?? String(item.metadata?.offeringType ?? "product");
          const id = item.sourceId ?? item.id ?? "";
          const businessId = item.metadata && typeof item.metadata.businessId === "string" ? item.metadata.businessId : "";
          if (type === "service") navigate("/booking?offering=" + encodeURIComponent(id) + (businessId ? "&businessId=" + encodeURIComponent(businessId) : ""));
          else if (type === "business") navigate("/businesses/" + encodeURIComponent(id));
          else navigate("/checkout?product=" + encodeURIComponent(id));
          active = true;
        } else {
          await persistSocialComment(item);
          active = true;
        }
        if (button.dataset.comment !== undefined) {
          if (active) showToast("نظر برای moderation ثبت شد.");
        } else if (button.dataset.share === undefined && button.dataset.openView === undefined) {
          showToast(active ? "تعامل اجتماعی ثبت شد." : "تعامل اجتماعی برداشته شد.");
          refreshSocialFeed();
        }
      } catch (error) {
        button.innerHTML = original;
        showToast(error instanceof Error ? error.message : "ثبت تعامل اجتماعی ممکن نشد.");
      } finally {
        button.disabled = false;
      }
    });
  });
}


function openCommandPalette(): void {
  const existing = document.querySelector(".command-overlay");
  if (existing) {
    existing.querySelector<HTMLInputElement>("#global-command-input")?.focus();
    return;
  }

  const baseItems = routes.map((route) => ({
    path: route.path,
    label: route.label,
    icon: route.icon,
  }));
  const vertical = resolveBusinessVerticalKey(
    localStorage.getItem(STORAGE.businessVertical) ?? "default",
  );
  const businessId = localStorage.getItem(STORAGE.business);
  const verticalModules = getBusinessVerticalUi(vertical).modules.map((module) => ({
    path: businessModuleContextHref(businessModulePath(vertical, module), vertical, module, businessId ?? undefined),
    label: getBusinessVerticalUi(vertical).label + " · " + module,
    icon: getBusinessVerticalUi(vertical).icon,
  }));
  const items = [
    ...baseItems,
    ...verticalModules.filter((item) => !baseItems.some((base) => base.path === item.path)),
  ];
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

function bindBusinessWorkspaceDynamicEvents(): void {
  const page = document.querySelector<HTMLElement>(".phoenix-business-page");
  const vertical = resolveBusinessVerticalKey(
    page?.dataset.businessVertical ?? localStorage.getItem(STORAGE.businessVertical) ?? "default",
  );
  const businessId = localStorage.getItem(STORAGE.business);

  document.querySelectorAll<HTMLButtonElement>(".phoenix-business-module").forEach((button) => {
    button.onclick = () => {
      const module = button.dataset.businessModule?.trim();
      if (!module) return;
      navigate(businessModuleContextHref(businessModulePath(vertical, module), vertical, module, businessId ?? undefined));
    };
  });

  const actionLinks = BUSINESS_QUICK_ACTION_LINKS[vertical] ?? BUSINESS_QUICK_ACTION_LINKS.default ?? {};
  document.querySelectorAll<HTMLButtonElement>("[data-business-quick-action]").forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.businessQuickActionValue ?? button.textContent?.replace("←", "").trim() ?? "";
      const target = actionLinks[action];
      if (target) {
        navigate(businessModuleContextHref(target, vertical, action, businessId ?? undefined));
      } else {
        showToast(action + " در حال اتصال به workflow canonical است.");
      }
    };
  });

  const primaryAction = document.querySelector<HTMLButtonElement>("[data-business-primary-action]");
  primaryAction?.addEventListener("click", () => {
    const ui = getBusinessVerticalUi(vertical);
    const module = ui.modules[0];
    if (!module) return;
    navigate(businessModuleContextHref(businessModulePath(vertical, module), vertical, module, businessId ?? undefined));
  });
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
  document.querySelectorAll<HTMLButtonElement>("[data-language-toggle]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); toggleLanguageMenu(); }));
  document.querySelectorAll<HTMLButtonElement>("[data-language-option]").forEach((button) => button.addEventListener("click", () => {
    const language = button.dataset.languageOption as Language | undefined;
    if (!language) return;
    setLanguage(language);
    const menu = document.querySelector<HTMLElement>("[data-language-menu]");
    const trigger = document.querySelector<HTMLButtonElement>("[data-language-toggle]");
    if (menu) menu.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
  }));

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
  document.querySelectorAll<HTMLButtonElement>("[data-business-type-choice]").forEach((button) => button.addEventListener("click", () => { const input = document.querySelector<HTMLInputElement>("#business-type-input"); const value = button.dataset.businessTypeChoice ?? ""; if (input) input.value = value; showToast("نوع کسب‌وکار «" + (button.textContent ?? value) + "» انتخاب شد."); }));
  bindBusinessWorkspaceDynamicEvents();
  document.querySelectorAll<HTMLButtonElement>("[data-business-module-action]").forEach((button) => button.addEventListener("click", () => showToast((button.dataset.businessModuleAction ?? "Action") + " از workflow canonical ادامه پیدا می‌کند.")));
  // Primary Business Workspace navigation is bound in bindBusinessWorkspaceDynamicEvents().
  document.querySelector<HTMLButtonElement>("[data-team-management]")?.addEventListener("click", openBusinessTeamPanel);
  document.querySelector<HTMLButtonElement>("[data-profile-refresh]")?.addEventListener("click", () => { void loadProfilePage(); });
  document.querySelectorAll<HTMLButtonElement>("[data-refresh-notifications]").forEach((button) => button.addEventListener("click", () => { void loadNotificationsPage(); }));
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

  document.querySelector<HTMLButtonElement>("[data-run-discovery]")?.addEventListener("click", () => void runDiscovery(true));
  document.querySelectorAll<HTMLButtonElement>("[data-open-create-post]").forEach((button) => button.addEventListener("click", openCreatePostPanel));
  document.querySelectorAll<HTMLButtonElement>("[data-social-state-refresh]").forEach((button) => button.addEventListener("click", () => void loadSocialState()));
  document.querySelectorAll<HTMLButtonElement>("[data-load-more-discovery]").forEach((button) => button.addEventListener("click", () => void runDiscovery(false)));
  document.querySelectorAll<HTMLButtonElement>("[data-focus-discover]").forEach((button) => button.addEventListener("click", () => document.querySelector<HTMLInputElement>("#discover-query")?.focus()));
  document.querySelector<HTMLInputElement>("#discover-query")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runDiscovery();
  });

  document.querySelector<HTMLButtonElement>("[data-load-slots]")?.addEventListener("click", loadBookingSlots);
  document.querySelector<HTMLButtonElement>("[data-load-business-schedules]")?.addEventListener("click", loadBusinessBookingSchedules);
  document.querySelector<HTMLButtonElement>("[data-start-checkout]")?.addEventListener("click", startCheckoutFlow);

  const socialDraft = sessionStorage.getItem("phoenix-social-create-draft");
  const studioText = document.querySelector<HTMLTextAreaElement>("#studio-text");
  if (socialDraft && studioText) {
    studioText.value = socialDraft;
    sessionStorage.removeItem("phoenix-social-create-draft");
  }
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

async function runDiscovery(reset = true): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#discover-query");
  const resultHost = document.querySelector<HTMLDivElement>("#discovery-results");
  const meta = document.querySelector<HTMLElement>("#results-meta");
  const title = document.querySelector<HTMLElement>("#results-title");
  const pagination = document.querySelector<HTMLElement>("#discovery-pagination");
  if (!input || !resultHost || !meta) return;
  if (discoveryBusy) return;

  const paramsUrl = new URLSearchParams(location.search);
  const tab = paramsUrl.get("tab") ?? "for-you";
  const query = input.value.trim();

  if (reset) discoveryOffset = 0;
  if (tab !== "following" && !query && tab === "for-you") {
    resultHost.innerHTML = '<div class="social-empty-state glass-card"><div class="draft-orb">✦</div><h3>نیازت را بنویس.</h3><p>Discovery با متن طبیعی، عرضه‌های canonical را پیدا می‌کند.</p></div>';
    meta.textContent = "منتظر نیاز";
    if (pagination) pagination.innerHTML = "";
    return;
  }

  if (title) title.textContent = query ? "نتایج برای «" + (query.length > 48 ? escapeHtml(query.slice(0, 48) + "…") : escapeHtml(query)) + "»" : tab === "following" ? "عرضه‌های دنبال‌شده" : "اکسپلور";
  if (reset) resultHost.innerHTML = renderSkeletonCards(3);
  meta.textContent = "در حال تحلیل…";
  discoveryBusy = true;

  try {
    const pageSize = 9;
    let data: DiscoveryResult[];
    if (tab === "following") {
      const response = await apiJson<{ data: DiscoveryResult[]; pagination?: { count?: number } }>("/api/v1/discovery/following?limit=" + pageSize + "&offset=" + discoveryOffset);
      data = Array.isArray(response.data) ? response.data : [];
    } else {
      const searchParams = new URLSearchParams({ limit: String(pageSize), offset: String(discoveryOffset) });
      if (query) searchParams.set("q", query);
      const response = await apiJson<{ data: DiscoveryResult[]; pagination?: { count?: number } }>("/api/v1/discovery/search?" + searchParams.toString());
      data = Array.isArray(response.data) ? response.data : [];
    }

    discoveryHasMore = data.length === pageSize;
    const nextItems = reset ? data : [...activeDiscoveryItems, ...data];
    resultHost.innerHTML = renderSocialPosts(nextItems);
    meta.textContent = nextItems.length + (discoveryHasMore ? "+" : "") + " نتیجه";
    discoveryOffset += data.length;
    if (pagination) pagination.innerHTML = discoveryHasMore ? '<button class="button button-ghost" type="button" data-load-more-discovery>نمایش موارد بیشتر <span>↓</span></button>' : "";
    bindDiscoveryResultEvents();
    renderCompareTray();
  } catch (error) {
    if (reset) {
      resultHost.innerHTML = '<div class="social-error-state glass-card"><div class="draft-orb">!</div><h3>Discovery در دسترس نیست.</h3><p>' + escapeHtml(error instanceof Error ? error.message : "خواندن Discovery ناموفق بود.") + '</p><button class="button button-ghost" type="button" data-run-discovery>تلاش دوباره</button></div>';
    }
    meta.textContent = "خطا";
    if (pagination) pagination.innerHTML = "";
  } finally {
    discoveryBusy = false;
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
        localStorage.setItem("phoenix-last-ai-usage", JSON.stringify({ units: String(result.data.usage?.providerUnits ?? (((result.data.usage?.inputTokens ?? 0) + (result.data.usage?.outputTokens ?? 0)) || "—")), at: new Date().toISOString() }));
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
            <span><b>مصرف</b> ${escapeHtml(String(result.usage?.providerUnits ?? (((result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0)) || "—")))}</span>
            <span><b>ورودی</b> ${escapeHtml(String(result.usage?.inputTokens ?? "—"))}</span>
            <span><b>خروجی</b> ${escapeHtml(String(result.usage?.outputTokens ?? "—"))}</span>
            <span><b>هزینه داخلی</b> ${result.cost?.estimatedProviderCost !== undefined ? escapeHtml(String(result.cost.estimatedProviderCost)) + " " + escapeHtml(result.cost.costCurrency ?? "USD") : "ثبت شد"}</span>
          </div>` : ""}
        <div class="draft-actions">
          <button class="button button-primary" type="button" data-confirm-seller-draft>بازبینی و ساخت محصول</button>
          <button class="button button-ghost" type="button" data-cancel-seller-draft>لغو session</button>
        </div>
        <div id="seller-confirm-state" class="connection-state">نسخه ${version} برای بازبینی آماده است.</div><div id="seller-publication-controls" class="seller-publication-controls"></div>
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

async function openWorkspaceSwitcher(): Promise<void> {
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "workspace-overlay";
  const currentId = localStorage.getItem(STORAGE.workspace) ?? shellContext.workspaceId ?? "";
  let roles: string[] = [];
  try {
    const context = await apiJson<{ roles?: string[]; permissions?: string[] }>("/api/v1/context");
    roles = Array.isArray(context.roles) ? context.roles : [];
  } catch {
    roles = [];
  }
  const current = shellWorkspaces.find((workspace) => workspace.id === currentId);
  const roleLabel = roles.length ? roles.join(" · ") : "نقش از context در دسترس نیست";
  const rows = shellWorkspaces.length
    ? shellWorkspaces.map((workspace) => {
        const active = workspace.id === currentId;
        return '<button class="workspace-option phoenix-workspace-option ' + (active ? "active" : "") + '" type="button" data-select-workspace="' + escapeAttr(workspace.id) + '">' +
          '<span class="workspace-option-icon">' + (active ? "✓" : "◆") + '</span>' +
          '<span><strong>' + escapeHtml(workspace.name) + '</strong><small>' + escapeHtml(workspace.status ?? "workspace") + '</small></span>' +
          '<b>' + (active ? "فعال" : "ورود") + '</b>' +
        '</button>';
      }).join("")
    : '<div class="slot-empty"><span>◆</span><p>Workspace مجاز دیگری برای این حساب پیدا نشد.</p></div>';

  overlay.innerHTML =
    '<div class="connection-backdrop" data-close-workspace></div>' +
    '<section class="connection-modal glass-card workspace-modal phoenix-workspace-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-title">' +
      '<button class="connection-close" type="button" data-close-workspace aria-label="بستن">×</button>' +
      '<div class="phoenix-workspace-modal-hero"><span class="phoenix-workspace-modal-mark"><img src="/phoenix-mark.svg?v=1" alt="" /></span><div><span class="section-kicker">Phoenix Workspace</span><h2 id="workspace-title">فضای کاری را انتخاب کنید</h2><p>' + escapeHtml(current?.name ?? "فضای کاری شما") + ' · ' + escapeHtml(roleLabel) + '</p></div></div>' +
      '<div class="phoenix-workspace-current"><span>Workspace فعلی</span><strong>' + escapeHtml(current?.name ?? "نامشخص") + '</strong><small>' + escapeHtml(currentId || "—") + '</small></div>' +
      '<div class="workspace-option-list">' + rows + '</div>' +
      '<div class="connection-actions"><button class="button button-ghost" type="button" data-close-workspace>بستن</button><button class="button button-primary" type="button" data-refresh-shell>بروزرسانی</button></div>' +
    '</section>';
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
        await loadShellContext();
        render();
        showToast("Workspace تغییر کرد.");
      } catch (error) {
        if (previous) localStorage.setItem(STORAGE.workspace, previous); else localStorage.removeItem(STORAGE.workspace);
        showToast(error instanceof Error ? error.message : "تغییر Workspace ناموفق بود.");
      }
    });
  });
}

function openBusinessTeamPanel(): void {
  if (!sessionStorage.getItem(STORAGE.accessToken)) {
    openConnectionPanel();
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "business-team-overlay";
  overlay.innerHTML = '<div class="connection-backdrop" data-close-team></div>' +
    '<section class="connection-modal glass-card phoenix-team-modal" role="dialog" aria-modal="true" aria-labelledby="team-management-title">' +
      '<button class="connection-close" type="button" data-close-team aria-label="بستن">×</button>' +
      '<div class="phoenix-team-modal-head"><span class="phoenix-workspace-modal-mark"><img src="/phoenix-mark.svg?v=1" alt="" /></span><div><span class="section-kicker">Team Management</span><h2 id="team-management-title">مدیریت تیم</h2><p>اعضا، نقش مؤثر و Permissionهای context فعلی را یکجا ببینید.</p></div></div>' +
      '<div id="team-management-body"><div class="slot-loading">در حال خواندن تیم…</div></div>' +
      '<div class="connection-actions"><button class="button button-ghost" type="button" data-close-team>بستن</button><button class="button button-primary" type="button" data-team-refresh>بروزرسانی</button></div>' +
    '</section>';
  document.body.appendChild(overlay);
  const body = overlay.querySelector<HTMLElement>("#team-management-body");
  const load = async () => {
    if (!body) return;
    body.innerHTML = '<div class="slot-loading">در حال خواندن Team / Access…</div>';
    try {
      const workspaceId = localStorage.getItem(STORAGE.workspace) ?? shellContext.workspaceId ?? "";
      const [context, members] = await Promise.all([
        apiJson<{ actorId?: string; roles?: string[]; permissions?: string[]; workspaceId?: string }>("/api/v1/context"),
        workspaceId ? apiJson<{ data: Array<{ id: string; userId: string; status: string }> }>("/api/v1/workspaces/" + encodeURIComponent(workspaceId) + "/members") : Promise.resolve({ data: [] }),
      ]);
      const items = Array.isArray(members.data) ? members.data : [];
      const roles = Array.isArray(context.roles) ? context.roles : [];
      const permissions = Array.isArray(context.permissions) ? context.permissions : [];
      body.innerHTML =
        '<div class="phoenix-team-management-summary"><div><span>Workspace</span><strong>' + escapeHtml(workspaceId || "—") + '</strong></div><div><span>نقش شما</span><strong>' + escapeHtml(roles.join(" · ") || "—") + '</strong></div><div><span>اعضا</span><strong>' + String(items.length) + '</strong></div></div>' +
        '<div class="phoenix-team-management-list">' + (items.length ? items.map((member) => '<div class="phoenix-team-management-row"><span class="phoenix-team-avatar">' + escapeHtml((member.userId || "U").slice(0,1).toUpperCase()) + '</span><div><strong>' + escapeHtml(member.userId) + '</strong><small>' + escapeHtml(member.status) + (member.userId === context.actorId ? " · شما" : "") + '</small></div><span class="pill ' + (member.status === "active" ? "success" : "warning") + '">' + escapeHtml(member.status) + '</span></div>').join("") : '<div class="slot-empty"><span>◎</span><p>عضوی برای این Workspace پیدا نشد.</p></div>') + '</div>' +
        '<div class="phoenix-team-permission-summary"><span class="section-kicker">Effective Permissions</span><div>' + (permissions.length ? permissions.slice(0,20).map((permission) => '<span class="phoenix-permission-chip">' + escapeHtml(permission) + '</span>').join("") : '<span class="permission-empty">Permissionی برنگشت.</span>') + '</div></div>' +
        '<div class="phoenix-team-readonly-note">تغییر نقش، دعوت و تعلیق عضو در این Slice عمداً read-only است؛ UI تا زمانی که mutationهای canonical متصل نشده‌اند، نتیجه جعلی نشان نمی‌دهد.</div>';
    } catch (error) {
      body.innerHTML = '<div class="slot-empty"><span>!</span><p>' + escapeHtml(error instanceof Error ? error.message : "خواندن تیم ناموفق بود.") + '</p></div>';
    }
  };
  overlay.querySelectorAll<HTMLElement>("[data-close-team]").forEach((node) => node.addEventListener("click", () => overlay.remove()));
  overlay.querySelector<HTMLButtonElement>("[data-team-refresh]")?.addEventListener("click", () => { void load(); });
  void load();
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
      const workspaceId = shellContext.workspaceId;
      tasks.push((async () => {
        try {
          const response = await apiJson<{ data: { id: string; userId: string; status: string }[] }>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members`);
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
  const isKnownRoute = routes.some((route) => route.path === target);
  const isBusinessModule = Boolean(parseBusinessModulePath(target));
  const isPublicBusiness = target.startsWith("/businesses/") && target.split("/").filter(Boolean).length === 2;
  if (!isKnownRoute && !isBusinessModule && !isPublicBusiness && !initialSeoHydration) {
    window.location.reload();
    return;
  }
  render();
});
window.addEventListener("keydown", handleGlobalShortcut);
render();
void hydrateSessionContext();
