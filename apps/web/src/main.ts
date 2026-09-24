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
  const value = path.replace(/\\/+$/, "");
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

  document.querySelector<HTMLElement>("[data-profile-toggle]")?.addEventListener("click", () => showToast("ورود و فضای کاربری در slice احراز هویت متصل می‌شود."));

  document.querySelector<HTMLButtonElement>("[data-run-discovery]")?.addEventListener("click", runDiscovery);
  document.querySelector<HTMLInputElement>("#discover-query")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runDiscovery();
  });

  document.querySelector<HTMLButtonElement>("[data-generate-draft]")?.addEventListener("click", generateDraft);

  document.addEventListener("keydown", handleShortcut, { once: true });
}

function handleShortcut(event: KeyboardEvent): void {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement | null)?.tagName ?? "")) {
    event.preventDefault();
    document.querySelector<HTMLElement>("[data-focus-search]")?.click();
  }
  window.setTimeout(() => document.addEventListener("keydown", handleShortcut, { once: true }), 0);
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
  if (!input || !draft || !status) return;

  const text = input.value.trim();
  if (!text) {
    showToast("یک توضیح کوتاه از محصول وارد کن.");
    input.focus();
    return;
  }

  status.textContent = "در حال آماده‌سازی";
  status.className = "pill warning";
  draft.innerHTML = renderDraftSkeleton();

  const preview = buildLocalDraft(text);
  await wait(420);

  draft.innerHTML = `
    <div class="draft-ready">
      <div class="draft-preview-art"><span>AI</span></div>
      <div class="draft-copy">
        <span class="section-kicker">پیشنهاد اولیه</span>
        <h2>${escapeHtml(preview.name)}</h2>
        <p>${escapeHtml(preview.description)}</p>
        <div class="draft-fields">
          <span><b>دسته</b> ${escapeHtml(preview.category)}</span>
          <span><b>وضعیت</b> نیازمند بازبینی</span>
          <span><b>منبع</b> ورودی فروشنده</span>
        </div>
        <div class="draft-actions"><button class="button button-primary" type="button" data-toast="بازبینی انسانی آماده است.">بازبینی و تأیید</button><button class="button button-ghost" type="button" data-toast="نسخه جایگزین به‌زودی اضافه می‌شود.">اصلاح با AI</button></div>
      </div>
    </div>
  `;
  status.textContent = "پیش‌نویس آماده";
  status.className = "pill success";
  bindGlobalEvents();
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

async function apiJson<T>(url: string): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  const token = localStorage.getItem(STORAGE.accessToken);
  const workspace = localStorage.getItem(STORAGE.workspace);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (workspace) headers.set("x-workspace-id", workspace);

  const response = await fetch(url, { headers });
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

window.addEventListener("popstate", render);
render();
