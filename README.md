# ققنوس | Phoenix Intelligence Platform

> **پلتفرم هوشمند تصمیم‌گیری، بازارگاه، عرضه و اتصال یکپارچه مشتریان و کسب‌وکارها**  
> A secure, modular, multilingual, multi-tenant intelligent decision & commerce platform connecting buyers, merchants, and enterprise organizations.

---

## فهرست مطالب / Table of Contents
- [معرفی پروژه / Overview](#معرفی-پروژه--overview)
- [معماری سه سطح حساب ققنوس / Three-Tier Account Architecture](#معماری-سه-سطح-حساب-ققنوس)
- [موتور قیمت‌گذاری و عرضه / Pricing & Commerce Engine](#موتور-قیمت‌گذاری-و-عرضه)
- [ساختار مونو‌ریپو / Monorepo Structure](#ساختار-مونوریپو--monorepo-structure)
- [پیش‌نیازها و راه‌اندازی سریع / Quick Start](#پیش‌نیازها-و-راه‌اندازی-سریع--quick-start)
- [دستورات گیت برای بارگذاری در گیت‌هاب / Push to GitHub](#دستورات-گیت-برای-بارگذاری-در-گیت‌هاب--push-to-github)
- [آزمون‌ها و اعتبارسنجی / Testing & Verification](#آزمون‌ها-و-اعتبارسنجی--testing--verification)
- [معماری پایگاه داده و استقرار / Production & Database Architecture](#معماری-پایگاه-داده-و-استقرار)

---

## معرفی پروژه / Overview

ققنوس یک پلتفرم جامع با چرخهٔ بسته تصمیم‌گیری و تبادل ارزش است:
```text
Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn
```
تمامی بخش‌های بازارگاه (Marketplace)، کاتالوگ، رزرو، ارتباط با مشتریان (CRM)، صدور فاکتور و هوش تجاری در خدمت این چرخه طراحی شده‌اند.

---

## معماری سه سطح حساب ققنوس

پروژه ققنوس بر مبنای اصل **«یک حساب، یک هویت»** استوار است که سطوح بالاتر به‌عنوان مجموعه‌ای از قابلیت‌ها به همان حساب افزوده می‌شوند و ارتقای سطح هیچ‌گاه اطلاعات قبلی را مخدوش نمی‌کند:

1. **سطح اول: حساب پایه («حساب من»)**
   - ورود/ثبت‌نام با شماره موبایل و کد یک‌بارمصرف یا ایمیل امن.
   - پروفایل، اعتبارسنجی الگوریتمی کد ملی، ثبت چند آدرس (خانه، محل کار، و...) با کدپستی.
   - سوابق فعالیت، علاقه‌مندی‌ها، پیگیری وضعیت سفارش‌ها و دریافت PDF فاکتورهای رسمی.
   - سبد خرید، محاسبه قیمت و تسویه‌حساب اختصاصی بدون دسترسی به داده‌های سایرین.

2. **سطح دوم: فعال‌سازی فروشندگی («فروشگاه من»)**
   - فعال‌سازی با حفظ کامل اطلاعات و بدون ایجاد حساب کاربری مجزا.
   - عرضه در ۴ دسته‌بندی: فیزیکی، دیجیتال/دانلودی (تحویل آنی فایل)، خدمت (زمان‌بندی‌شده)، و متغیر (رنگ، سایز، مدل).
   - مدیریت سفارش‌های دریافتی، پیگیری مرجوعی‌ها و لغوی‌ها.
   - CRM محلی فروشگاه و دسته‌بندی خریداران همان فروشگاه به «مشتری عادی» یا «مشتری ویژه».
   - تخفیف‌های زمان‌دار درصدی یا ثابت با تاریخ انقضا و سقف استفاده.

3. **سطح سوم: فروشندگی شرکتی («فروشگاه شرکتی»)**
   - ثبت مشخصات شرکتی و اسناد با جریان تأیید (`در انتظار بررسی`، `تأییدشده`، `ردشده`).
   - قفل دسترسی امکانات حساس شرکتی تا زمان اخذ تأییدیه با اعلان شفاف دلایل رد.
   - ۵ نقش مجزای خریدار در رابطه با هر فروشگاه (`مصرف‌کننده`، `مشتری ویژه`، `نماینده سطح ۱`، `۲` و `۳`).
   - قیمت‌گذاری پیشرفته: ترکیب قیمت نقش خریدار، قیمت پلکانی بر مبنای تیراژ (حجم خرید) و تخفیف‌های زمان‌دار با رعایت اولویت قطعی و fallback به قیمت پایه.

---

## ساختار مونو‌ریپو / Monorepo Structure

```text
├── apps/
│   ├── api/            # Cloudflare Worker / Hono backend API
│   └── web/            # Phoenix Web App (SPA + SSR hydration + Tailwind)
├── packages/
│   ├── commerce/       # Account tiers, pricing engine, offer resolution, order machine
│   ├── core/           # Shared domain types, contracts & utilities
│   ├── database/       # D1 repository abstractions & migration verifier
│   ├── i18n/           # High-performance RTL/LTR internationalization
│   ├── runtime/        # AI runtime policies & adapters
│   ├── discovery/      # Search, matching, catalog indexing
│   ├── booking/        # Slot generators, capacity calendar
│   ├── billing/        # Invoicing, financial audit trails
│   └── ...             # Supporting packages (seo, customer, etc.)
├── migrations/         # Canonical SQLite / D1 migration files (0001 - 0075)
├── scripts/            # Build, test, sync, and development server scripts
└── .github/workflows/  # Production CI/CD pipelines
```

---

## پیش‌نیازها و راه‌اندازی سریع / Quick Start

### نیازمندی‌ها
- **Node.js**: نسخه 22 به بالا
- **npm**: نسخه 10 به بالا

### نصب و اجرای پروژه
```bash
# ۱. نصب وابستگی‌های تمام پکیج‌ها
npm install

# ۲. کامپایل پروژه
npm run build

# ۳. اجرای سرور توسعه محلی (پورت ۳۰۰۰)
npm run dev

# ۴. اجرای تست‌ها
npm test
```

---

## دستورات گیت برای بارگذاری در گیت‌هاب / Push to GitHub

برای انتشار پروژه در یک مخزن جدید در گیت‌هاب، مراحل زیر را در ترمینال پروژه اجرا کنید:

```bash
# ۱. مقداردهی اولیه مخزن محلی (در صورت عدم وجود)
git init

# ۲. تعیین شاخه اصلی به main
git branch -M main

# ۳. افزودن تمام فایل‌های سورس به گیت
git add .

# ۴. ثبت کامیت اولیه
git commit -m "feat: initial commit of Phoenix Intelligence platform"

# ۵. اتصال به مخزن گیت‌هاب شما (آدرس مخزن خود را جایگزین کنید)
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git

# ۶. ارسال به گیت‌هاب
git push -u origin main
```

---

## آزمون‌ها و اعتبارسنجی / Testing & Verification

پروژه شامل بیش از ۲۰۰ تست واحد و یکپارچه است که تمامی رفتارهای سیستم، سطوح دسترسی، محاسبات مالی و سناریوهای کاربری را پوشش می‌دهند:

```bash
# اجرای کل آزمون‌ها
npm test

# اجرای تست‌های مشخص مربوط به سطوح حساب و کامرس
npx vitest run packages/commerce apps/web
```

---

## معماری پایگاه داده و استقرار

- **Database**: پایگاه داده رابطه ای رسمی بر بستر **Cloudflare D1** قرار دارد. فایل‌های مهاجرت در مسیر `migrations/` با مکانیزم قفل در `migrations/migration-lock.json` نگهداری می‌شوند.
- **Runtime**: اجرا بر پایه **Cloudflare Workers + Hono**.
- **Deployment**: از طریق ورک‌فلوهای GitHub Actions در مسیر `.github/workflows/production-deploy.yml`.

---
© 2026 Phoenix Platform (ققنوس). کلیه حقوق محفوظ است.

