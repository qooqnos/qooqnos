# Phoenix Vertical Workflow UI Framework

## هدف

این سند قرارداد مشترک رابط Workspace برای چهار Vertical اصلی Phoenix است:

- Clinic
- Retail
- Restaurant
- Salon

این معماری «چهار اپ جدا» نمی‌سازد. همه Verticalها از یک Shell، Design System، Role Lens، Capability Contract، Module Blueprint و Workflow Canvas استفاده می‌کنند.

## لایه‌های قرارداد

`Business Type → Capability → Module → Role Lens → Workflow Stage → Canonical Domain`

### 1. Business Type
`apps/web/src/business-vertical-ui.ts` مالک composition سطح Vertical است.

### 2. Module Registry
`apps/web/src/business-module-ui.ts` مالک:

- semantic module slug
- route identity مستقل از زبان
- blueprint
- layout
- interaction
- canonical term keys
- capability requirements
- permission metadata
- role lenses

UI مجوز ایجاد نمی‌کند؛ Backend همچنان مرجع نهایی authorization است.

### 3. Workflow Canvas
`apps/web/src/vertical-workflow-ui.ts` یک Canvas مشترک برای stateهای:

- connected
- requires-input
- readonly
- unavailable

ارائه می‌کند و داده را از domain canonical می‌خواند.

### 4. Workflow Stages
`apps/web/src/business-workflow-ui.ts` ترتیب و مرحله‌های workflow را نگه می‌دارد و نباید domain source جدید بسازد.

## چهار Vertical

### Clinic
امروز، نوبت‌ها، تقویم، پزشکان، خدمات، مراجعان، ساعات کاری، پیام‌ها، پرداخت، محتوا، تیم.

### Retail
فروش امروز، محصولات، مدل‌ها و تنوع، سایز و رنگ، موجودی، سفارش‌ها، مرجوعی، مشتریان، تخفیف‌ها، محتوا، گزارش فروش.

### Restaurant
سفارش‌های امروز، منو، میزها، رزرو، آشپزخانه، تحویل، مشتریان، تخفیف، پرداخت، گزارش.

### Salon
وقت‌های امروز، خدمات، متخصصان، تقویم، مشتریان، ظرفیت، پرداخت، پیشنهادها، محتوا، تیم.

## قواعد غیرقابل‌تغییر

1. هر module باید blueprint مشترک داشته باشد.
2. هر module باید route semantic و مستقل از locale داشته باشد.
3. هر module باید canonical term mapping داشته باشد.
4. هر module باید capability/permission metadata داشته باشد.
5. role lens فقط UI emphasis است؛ authorization نیست.
6. عدد، metric، ظرفیت، موجودی، نوبت یا سفارش ساختگی نباید در UI تولید شود.
7. اگر endpoint canonical در دسترس نباشد، UI باید state صادقانه `unavailable` یا `requires-input` نشان دهد.
8. Verticalها نباید source of truth موازی برای Catalog، Booking، Commerce، Customer، Billing، Trust یا Communication بسازند.
9. زبان نباید route identity را تغییر دهد.
10. اضافه‌شدن module جدید باید با `auditVerticalUiRegistry` قابل بررسی باشد.

## معیار تکمیل زیرساخت

یک Vertical زمانی از نظر UI Framework آماده محسوب می‌شود که تمام moduleهای آن:

- route
- blueprint
- canonical terms
- capability contract
- role lens
- workflow canvas

را داشته باشند.

این معیار «کامل بودن backend workflow» را ادعا نمی‌کند؛ فقط کامل بودن قرارداد و زیرساخت UI را اندازه می‌گیرد.
