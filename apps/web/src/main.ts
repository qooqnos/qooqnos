type Theme = "dark" | "light";

type Route = {
  path: string;
  label: string;
  icon: string;
  render: () => string;
};

type DiscoveryResult = {
  id?: string;
  title?: string;
  name?: string;
  displayName?: string;
  description?: string | null;
  city?: string | null;
  locality?: string | null;
  rating?: number | null;
  score?: number | null;
};

const STORAGE = {
  theme: "phoenix-theme",
  workspace: "phoenix-workspace-id",
  accessToken: "phoenix-access-token",
  business: "phoenix-business-id",
};

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
};

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

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Phoenix web root is missing.");

const routes: Route[] = [
  { path: "/", label: "خانه", icon: "⌂", render: renderHome },
  { path: "/discover", label: "کشف", icon: "⌕", render: renderDiscover },
  { path: "/business", label: "کسب‌وکار", icon: "▦", render: renderBusiness },
  { path: "/product-studio", label: "استودیو محصول", icon: "✦", render: renderProductStudio },
];

const theme = getInitialTheme();
document.documentElement.dataset.theme = theme;

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
  return routes.find((route) => route.path === normalized) ?? routes[0]!;
}

function normalizePath(path: string): string {
  const value = path.replace(/\/+$/, "");
  return value || "/";
}

function navigate(path: string): void {
  if (normalizePath(location.pathname) === normalizePath(path)) {
    render();
    return;
  }
  history.pushState({}, "", path);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render(): void {
  const route = currentRoute();
  const page = route.render();
  app.innerHTML = `
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
          <div class="command-palette" role="button" tabindex="0" data-focus-search>
            <span class="command-icon">⌕</span>
            <span class="command-placeholder">کجا می‌خواهید بروید؟</span>
            <kbd>/</kbd>
          </div>
        </div>
        <div class="header-actions">
          <button class="icon-button" type="button" data-theme-toggle aria-label="تغییر پوسته">◐</button>
          <button class="profile-chip" type="button" data-profile-toggle>
            <span class="avatar">ق</span>
            <span class="profile-copy"><strong>فضای شما</strong><small>${route.label}</small></span>
            <span class="chevron">⌄</span>
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderSidebar(route: Route): string {
  return `
    <aside class="sidebar">
      <div class="sidebar-top">
        <div class="workspace-card">
          <div class="workspace-icon">◆</div>
          <div><strong>ققنوس</strong><span>فضای کاری من</span></div>
          <span class="status-live"></span>
        </div>
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
        <button class="nav-item disabled" type="button" data-coming-soon="رزروها"><span class="nav-icon">◷</span><span>رزروها</span><em>به‌زودی</em></button>
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
  return `
    <nav class="mobile-nav" aria-label="ناوبری موبایل">
      ${routes.map((item) => `<a href="${item.path}" data-nav class="${item.path === route.path ? "active" : ""}"><span>${item.icon}</span><small>${item.label}</small></a>`).join("")}
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
          <div class="core-head"><span>تصمیم زنده</span><span class="pill success">فعال</span></div>
          <div class="core-question">امروز چه کاری می‌تواند برای شما ارزشمندتر باشد؟</div>
          <div class="decision-item"><span class="decision-icon">⌕</span><div><strong>کشف نزدیک شما</strong><small>۸۲ گزینه تحلیل شد</small></div><b>94</b></div>
          <div class="decision-item"><span class="decision-icon purple">✦</span><div><strong>پیشنهاد شخصی‌سازی‌شده</strong><small>۳ گزینه برای شما آماده است</small></div><b>92</b></div>
          <div class="decision-foot"><span>بر اساس زمینه، اعتماد و دسترسی</span><span>۰٫۸۵ اطمینان</span></div>
        </div>
      </div>
    </section>

    <section class="section-block">
      <div class="section-topline"><div><span class="section-kicker">تصویر امروز</span><h2>یک نگاه، سه فرصت</h2></div><a href="/discover" data-nav class="text-link">مشاهده همه <span>←</span></a></div>
      <div class="metric-grid">
        <article class="metric-card feature">
          <div class="metric-symbol">⌕</div><span>کشف</span><strong>+۲۳٪</strong><small>پتانسیل کشف‌پذیری امروز</small><div class="sparkline"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </article>
        <article class="metric-card">
          <div class="metric-top"><span>فضای کسب‌وکار</span><span class="tiny-status">● آماده</span></div>
          <strong class="metric-value">۱۲</strong><small>فیلد مهم برای تکمیل پروفایل</small>
          <div class="progress-line"><span style="width:78%"></span></div><b>۷۸٪ تکمیل</b>
        </article>
        <article class="metric-card">
          <div class="metric-top"><span>استودیو محصول</span><span class="ai-badge">AI</span></div>
          <strong class="metric-value">۴</strong><small>محصول آماده بازبینی</small>
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

function renderDiscover(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Discovery</span><h1>چیزی را که می‌خواهید، <em>پیدا کنید.</em></h1><p>جست‌وجو بر اساس نیاز، زمینه و عرضه واقعی ققنوس.</p></div>
      <div class="heading-actions"><button class="button button-ghost" type="button" data-toast="فیلترها به‌زودی به Discovery اضافه می‌شوند.">فیلترها</button></div>
    </section>
    <section class="discover-search glass-card">
      <div class="search-main"><span>⌕</span><input id="discover-query" type="search" autocomplete="off" placeholder="مثلاً یک کافه آرام برای جلسه عصر..." /></div>
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
  return items.map((item,index) => {
    const title = escapeHtml(item.displayName ?? item.name ?? "کسب‌وکار");
    const description = escapeHtml(item.description ?? "یک پیشنهاد مناسب از شبکه ققنوس.");
    const locality = escapeHtml(item.locality ?? item.city ?? "نزدیک شما");
    const score = item.score ?? Math.round((item.rating ?? 4.7) * 20);
    const rating = item.rating ?? 4.7;
    return `
      <article class="result-card">
        <div class="result-art result-${index % 3}"><span>${["ک","س","ب"][index % 3]}</span></div>
        <div class="result-content">
          <div class="result-head"><span class="tiny-status">● فعال</span><span class="score-chip">${score} <small>تناسب</small></span></div>
          <h3>${title}</h3>
          <p>${description}</p>
          <div class="result-meta"><span>⌖ ${locality}</span><span>★ ${rating.toFixed(1)}</span></div>
        </div>
      </article>`;
  }).join("");
}

function renderBusiness(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Business Workspace</span><h1>کسب‌وکارتان را <em>قابل کشف</em> کنید.</h1><p>یک فضای کاری تمیز برای ساخت عرضه، رشد و کنترل عملیات.</p></div>
      <a class="button button-primary" href="/product-studio" data-nav>ساخت محصول با AI <span>✦</span></a>
    </section>

    <section class="business-grid">
      <article class="glass-card business-main">
        <div class="card-section-heading"><div><span class="section-kicker">نمای کلی</span><h2>وضعیت فضای کاری</h2></div><span class="pill success">همه‌چیز سالم</span></div>
        <div class="workspace-stats">
          <div><span>محصولات</span><strong>۱۲</strong><small>۳ مورد در انتظار تأیید</small></div>
          <div><span>کشف‌پذیری</span><strong>۸۶٪</strong><small>+۱۲٪ در ۳۰ روز</small></div>
          <div><span>اعتماد</span><strong>۹۲</strong><small>Verification کامل</small></div>
        </div>
        <div class="chart-shell"><div class="chart-label"><span>کشف‌پذیری</span><span>۳۰ روز اخیر</span></div><div class="chart"><div class="chart-bars">${[34,48,40,54,58,68,63,78,71,86,82,92].map((h)=>`<i style="height:${h}%"></i>`).join("")}</div></div></div>
      </article>

      <article class="glass-card ai-action-card">
        <div class="ai-card-glow"></div>
        <span class="ai-badge">AI COPILOT</span>
        <h2>چه چیزی می‌تواند بهتر شود؟</h2>
        <p>۳ پیشنهاد برای افزایش کیفیت عرضه و کشف‌پذیری شما آماده است.</p>
        <button class="button button-primary" type="button" data-nav-click="/product-studio">پیشنهادها را ببین <span>→</span></button>
      </article>
    </section>

    <section class="section-block compact">
      <div class="section-topline"><div><span class="section-kicker">کارهای پیشنهادی</span><h2>قدم بعدی</h2></div></div>
      <div class="task-grid">
        <button class="task-card" type="button" data-nav-click="/product-studio"><span class="task-icon purple">✦</span><div><strong>۲ محصول را با AI بساز</strong><small>زمان تقریبی ۴ دقیقه</small></div><span>→</span></button>
        <button class="task-card" type="button" data-toast="صفحه مدیریت پروفایل در حال آماده‌سازی است."><span class="task-icon green">✓</span><div><strong>پروفایل کسب‌وکار را کامل کن</strong><small>۱۲٪ تا تکمیل کامل</small></div><span>→</span></button>
        <button class="task-card" type="button" data-toast="گزارش کشف‌پذیری به‌زودی فعال می‌شود."><span class="task-icon blue">↗</span><div><strong>گزارش کشف را مرور کن</strong><small>آخرین بروزرسانی: امروز</small></div><span>→</span></button>
      </div>
    </section>
  `;
}

function renderProductStudio(): string {
  return `
    <section class="page-heading">
      <div><span class="eyebrow"><i></i> Seller AI Studio</span><h1>محصول را بده؛ <em>بقیه‌اش با ققنوس.</em></h1><p>متن خام، تصویر یا توضیح آزاد را به یک پیش‌نویس محصول قابل بازبینی تبدیل کن.</p></div>
      <span class="billing-note">هر اجرای AI مصرف‌محور است.</span>
    </section>

    <section class="studio-grid">
      <article class="glass-card studio-input">
        <div class="studio-tabs"><button class="studio-tab active" type="button">ورودی</button><button class="studio-tab" type="button" data-toast="آپلود تصویر در slice بعدی فعال می‌شود.">تصویر</button></div>
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
        <textarea id="studio-text" rows="9" placeholder="مثلاً: کفش چرمی دست‌دوز، رنگ قهوه‌ای، مناسب استفاده روزمره..."></textarea>
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
    const input = document.querySelector<HTMLInputElement>("#discover-query");
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      navigate("/discover");
      window.setTimeout(() => document.querySelector<HTMLInputElement>("#discover-query")?.focus(), 80);
    }
  });

  document.querySelector<HTMLElement>("[data-profile-toggle]")?.addEventListener("click", openConnectionPanel);

  document.querySelector<HTMLButtonElement>("[data-run-discovery]")?.addEventListener("click", runDiscovery);
  document.querySelector<HTMLInputElement>("#discover-query")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runDiscovery();
  });

  document.querySelector<HTMLButtonElement>("[data-generate-draft]")?.addEventListener("click", generateDraft);
  document.querySelectorAll<HTMLButtonElement>("[data-open-connection]").forEach((button) => button.addEventListener("click", openConnectionPanel));

  // Keyboard shortcut is registered once at module load.
}

function handleGlobalShortcut(event: KeyboardEvent): void {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement | null)?.tagName ?? "")) {
    event.preventDefault();
    document.querySelector<HTMLElement>("[data-focus-search]")?.click();
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
      return;
    }
    resultHost.innerHTML = renderResultCards(items);
    meta.textContent = `${items.length} نتیجه`;
  } catch (error) {
    resultHost.innerHTML = renderResultCards(demoBusinesses);
    meta.textContent = "Demo mode";
    showToast(error instanceof Error ? error.message : "اتصال به Discovery برقرار نشد؛ حالت نمایشی فعال شد.");
  }
}

function renderSkeletonCards(count: number): string {
  return Array.from({ length: count }, () => '<article class="result-card skeleton-card"><div class="skeleton skeleton-art"></div><div class="result-content"><div class="skeleton line short"></div><div class="skeleton line long"></div><div class="skeleton line medium"></div><div class="skeleton line short"></div></div></article>').join("");
}

async function generateDraft(): Promise<void> {
  const input = document.querySelector<HTMLTextAreaElement>("#studio-text");
  const draft = document.querySelector<HTMLDivElement>("#studio-draft");
  const status = document.querySelector<HTMLElement>("#studio-status");
  const businessInput = document.querySelector<HTMLInputElement>("#studio-business");
  const workspaceInput = document.querySelector<HTMLInputElement>("#studio-workspace");
  if (!input || !draft || !status || !businessInput || !workspaceInput) return;

  const text = input.value.trim();
  const businessId = businessInput.value.trim();
  const workspaceId = workspaceInput.value.trim();

  if (!text) {
    showToast("یک توضیح کوتاه از محصول وارد کن.");
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

    await apiJson<{ accepted: boolean }>(`/api/v1/ai/seller/product-creation-sessions/${encodeURIComponent(sessionId)}/inputs`, {
      method: "POST",
      body: { rawText: text },
    });

    const result = await apiJson<{ data: SellerRunResult }>(
      `/api/v1/ai/seller/product-creation-sessions/${encodeURIComponent(sessionId)}/run`,
      {
        method: "POST",
        body: {
          input: { rawText: text },
          dataClassification: "internal",
          promptVersion: "seller-product-v1",
          outputSchemaVersion: "seller-product-draft-v1",
          policyVersion: "seller-product-policy-v1",
        },
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    );

    if (result.data.status === "succeeded") {
      draft.innerHTML = renderRemoteDraft(result.data);
      status.textContent = "پیش‌نویس آماده";
      status.className = "pill success";
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
  output?: {
    product?: Record<string, unknown>;
  } | null;
};

function renderRemoteDraft(result: SellerRunResult): string {
  const product = result.output?.product ?? {};
  const name = stringField(product, "name") ?? stringField(product, "title") ?? "محصول پیشنهادی";
  const description = stringField(product, "description") ?? "پیش‌نویس توسط Seller AI تولید شد.";
  const category = stringField(product, "category") ?? "نیازمند بررسی";
  return `
    <div class="draft-ready">
      <div class="draft-preview-art"><span>AI</span></div>
      <div class="draft-copy">
        <span class="section-kicker">پیش‌نویس واقعی</span>
        <h2>${escapeHtml(name)}</h2>
        <p>${escapeHtml(description)}</p>
        <div class="draft-fields">
          <span><b>دسته</b> ${escapeHtml(category)}</span>
          <span><b>وضعیت</b> آماده بازبینی</span>
          <span><b>منبع</b> Seller AI runtime</span>
        </div>
        <div class="draft-actions">
          <button class="button button-primary" type="button" data-toast="بازبینی و تأیید به مرحله بعدی متصل می‌شود.">بازبینی و تأیید</button>
          <button class="button button-ghost" type="button" data-toast="نسخه جایگزین در slice بعدی اضافه می‌شود.">اصلاح با AI</button>
        </div>
      </div>
    </div>`;
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

function buildLocalDraft(text: string): { name: string; description: string; category: string } {
  const compact = text.replace(/\s+/g, " ").trim();
  const name = compact.length > 56 ? compact.slice(0, 56).replace(/[،,:؛.]+$/, "") : compact;
  return {
    name: name || "محصول جدید",
    description: `${name || "این محصول"} بر اساس ورودی خام فروشنده به‌عنوان پیش‌نویس اولیه برای بررسی آماده شده است.`,
    category: guessCategory(compact),
  };
}

function guessCategory(value: string): string {
  const lower = value.toLowerCase();
  if (/کفش|کیف|لباس|پارچه/.test(lower)) return "پوشاک و اکسسوری";
  if (/قهوه|نان|غذا|کیک|شیرینی/.test(lower)) return "خوراک و نوشیدنی";
  if (/دستگاه|لپ|موبایل|الکترون/.test(lower)) return "کالای دیجیتال";
  return "سایر محصولات";
}

function renderDraftSkeleton(): string {
  return '<div class="draft-loading"><div class="draft-loading-orb"></div><div class="skeleton line long"></div><div class="skeleton line medium"></div><div class="skeleton line short"></div><p>ققنوس در حال ساختن یک پیش‌نویس قابل بازبینی است…</p></div>';
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

window.addEventListener("popstate", render);
window.addEventListener("keydown", handleGlobalShortcut);
render();
