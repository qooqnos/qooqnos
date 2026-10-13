// ============================================================================
// PHOENIX WEB ORDER STATE MACHINE ADAPTER (Phase 4)
// Single Source of Truth for Order Lifecycle, Transitions, Timeline & Actions
// ============================================================================

export type OrderLifecycleState =
  // Standard flow
  | "draft"
  | "pending_payment"
  | "paid"
  | "waiting_seller"
  | "confirmed"
  | "preparing"
  | "packed"
  | "ready_to_ship"
  | "handed_to_carrier"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  // Exceptional flow
  | "cancelled"
  | "rejected"
  | "payment_failed"
  | "delayed"
  | "return_requested"
  | "returned"
  | "refund_pending"
  | "refunded"
  | "delivery_failed"
  | "order_issue";

export type ActorRole = "buyer" | "seller" | "carrier" | "admin" | "system";

export interface OrderStateMetadata {
  readonly state: OrderLifecycleState;
  readonly baseOrderStatus: string;
  readonly labels: { readonly fa: string; readonly ar: string; readonly en: string };
  readonly descriptions: { readonly fa: string; readonly ar: string; readonly en: string };
  readonly badgeTone: "neutral" | "info" | "warning" | "success" | "danger";
  readonly icon: string;
  readonly stepIndex: number; // 0 to 5 in main timeline, -1 for exceptional
  readonly isFinal: boolean;
  readonly isException: boolean;
}

export const ORDER_STATE_METADATA: Record<OrderLifecycleState, OrderStateMetadata> = {
  draft: {
    state: "draft",
    baseOrderStatus: "draft",
    labels: { fa: "پیش‌نویس", ar: "مسودة", en: "Draft" },
    descriptions: { fa: "سفارش هنوز نهایی یا ثبت نشده است.", ar: "الطلب لم يكتمل بعد.", en: "Order has not been finalized yet." },
    badgeTone: "neutral",
    icon: "✎",
    stepIndex: 0,
    isFinal: false,
    isException: false,
  },
  pending_payment: {
    state: "pending_payment",
    baseOrderStatus: "pending_payment",
    labels: { fa: "در انتظار پرداخت", ar: "بانتظار الدفع", en: "Pending Payment" },
    descriptions: { fa: "منتظر انجام یا تأیید تراکنش بانکی خریدار است.", ar: "بانتظار إتمام عملية الدفع.", en: "Awaiting customer payment." },
    badgeTone: "warning",
    icon: "💳",
    stepIndex: 0,
    isFinal: false,
    isException: false,
  },
  paid: {
    state: "paid",
    baseOrderStatus: "pending_confirmation",
    labels: { fa: "پرداخت‌شده", ar: "تم الدفع", en: "Paid" },
    descriptions: { fa: "پرداخت موفق بود و به فروشنده اطلاع‌رسانی شد.", ar: "تم الدفع بنجاح وإبلاغ البائع.", en: "Payment successful, waiting seller." },
    badgeTone: "info",
    icon: "✓",
    stepIndex: 0,
    isFinal: false,
    isException: false,
  },
  waiting_seller: {
    state: "waiting_seller",
    baseOrderStatus: "pending_confirmation",
    labels: { fa: "در انتظار تأیید فروشنده", ar: "بانتظار تأكيد البائع", en: "Waiting for Seller" },
    descriptions: { fa: "سفارش برای بررسی موجودی به فروشنده ارجاع شده است.", ar: "الطلب قيد مراجعة وتأكيد البائع.", en: "Waiting for seller confirmation." },
    badgeTone: "warning",
    icon: "⏳",
    stepIndex: 1,
    isFinal: false,
    isException: false,
  },
  confirmed: {
    state: "confirmed",
    baseOrderStatus: "confirmed",
    labels: { fa: "تأییدشده توسط فروشنده", ar: "مؤكد من البائع", en: "Confirmed by Seller" },
    descriptions: { fa: "فروشنده سفارش را پذیرفت و وارد فرایند آماده‌سازی شد.", ar: "وافق البائع على الطلب وبدأ التجهيز.", en: "Seller confirmed the order." },
    badgeTone: "info",
    icon: "✓",
    stepIndex: 1,
    isFinal: false,
    isException: false,
  },
  preparing: {
    state: "preparing",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "در حال آماده‌سازی", ar: "قيد التجهيز", en: "Preparing" },
    descriptions: { fa: "اقلام در حال گردآوری و کنترل کیفیت هستند.", ar: "المنتجات قيد التجميع وفحص الجودة.", en: "Items are being picked and prepared." },
    badgeTone: "info",
    icon: "⚙",
    stepIndex: 2,
    isFinal: false,
    isException: false,
  },
  packed: {
    state: "packed",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "بسته‌بندی‌شده", ar: "تم التغليف", en: "Packed" },
    descriptions: { fa: "بسته‌بندی تکمیل شد و برچسب پستی صادر شده است.", ar: "اكتمل التغليف وجاهز للشحن.", en: "Items packed and labeled." },
    badgeTone: "info",
    icon: "📦",
    stepIndex: 2,
    isFinal: false,
    isException: false,
  },
  ready_to_ship: {
    state: "ready_to_ship",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "آماده تحویل به حامل", ar: "جاهز للتسليم لشركة الشحن", en: "Ready to Ship" },
    descriptions: { fa: "بسته منتظر مأمور جمع‌آوری شرکت پست یا پیک است.", ar: "الطلب بانتظار مندوب شركة الشحن.", en: "Package waiting for carrier pickup." },
    badgeTone: "info",
    icon: "🏷",
    stepIndex: 2,
    isFinal: false,
    isException: false,
  },
  handed_to_carrier: {
    state: "handed_to_carrier",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "تحویل به شرکت حمل", ar: "تم التسليم لشركة الشحن", en: "Handed to Carrier" },
    descriptions: { fa: "بسته به شرکت پستی یا مأمور ارسال تحویل داده شد.", ar: "تم استلام الشحنة من قبل شركة الشحن.", en: "Received by postal carrier." },
    badgeTone: "info",
    icon: "🚚",
    stepIndex: 3,
    isFinal: false,
    isException: false,
  },
  shipped: {
    state: "shipped",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "ارسال‌شده", ar: "تم الشحن", en: "Shipped" },
    descriptions: { fa: "مرسوله در مرکز پردازش پستی پذیرش شده است.", ar: "تم شحن الطرد وهو در مسار التوزيع.", en: "Parcel is in transit hub." },
    badgeTone: "info",
    icon: "✈",
    stepIndex: 3,
    isFinal: false,
    isException: false,
  },
  in_transit: {
    state: "in_transit",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "در مسیر ارسال", ar: "في الطريق", en: "In Transit" },
    descriptions: { fa: "بسته بین مراکز مبدأ و مقصد در حال انتقال است.", ar: "الشحنة تنتقل بين مراكز الفرز.", en: "Package moving between hubs." },
    badgeTone: "info",
    icon: "↔",
    stepIndex: 4,
    isFinal: false,
    isException: false,
  },
  out_for_delivery: {
    state: "out_for_delivery",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "در دست توزیع", ar: "خرج للتوصيل", en: "Out for Delivery" },
    descriptions: { fa: "مأمور توزیع در حال رساندن بسته به آدرس شماست.", ar: "مندوب التوصيل في طريقه إلى عنوانك اليوم.", en: "Courier is on the way to delivery address today." },
    badgeTone: "warning",
    icon: "🛵",
    stepIndex: 4,
    isFinal: false,
    isException: false,
  },
  delivered: {
    state: "delivered",
    baseOrderStatus: "completed",
    labels: { fa: "تحویل داده شد", ar: "تم التوصيل", en: "Delivered" },
    descriptions: { fa: "بسته با موفقیت به گیرنده تحویل شد.", ar: "تم استلام الطلب بنجاح.", en: "Order delivered successfully." },
    badgeTone: "success",
    icon: "✓",
    stepIndex: 5,
    isFinal: true,
    isException: false,
  },

  // Exceptional States
  cancelled: {
    state: "cancelled",
    baseOrderStatus: "cancelled",
    labels: { fa: "لغو شده", ar: "ملغى", en: "Cancelled" },
    descriptions: { fa: "این سفارش قبل از ارسال لغو گردید.", ar: "تم إلغاء هذا الطلب.", en: "Order was cancelled." },
    badgeTone: "neutral",
    icon: "✕",
    stepIndex: -1,
    isFinal: true,
    isException: true,
  },
  rejected: {
    state: "rejected",
    baseOrderStatus: "cancelled",
    labels: { fa: "رد توسط فروشنده", ar: "مرفوض من البائع", en: "Rejected by Seller" },
    descriptions: { fa: "فروشنده به علت عدم موجودی یا مغایرت سفارش را رد کرد.", ar: "تعذر على البائع قبول الطلب.", en: "Seller was unable to accept the order." },
    badgeTone: "danger",
    icon: "✕",
    stepIndex: -1,
    isFinal: true,
    isException: true,
  },
  payment_failed: {
    state: "payment_failed",
    baseOrderStatus: "pending_payment",
    labels: { fa: "پرداخت ناموفق", ar: "فشل الدفع", en: "Payment Failed" },
    descriptions: { fa: "عملیات پرداخت با خطا مواجه شد. لطفاً مجدداً تلاش کنید.", ar: "فشلت عملية الدفع. يرجى المحاولة مرة أخرى.", en: "Payment failed. Please retry." },
    badgeTone: "danger",
    icon: "⚠",
    stepIndex: -1,
    isFinal: false,
    isException: true,
  },
  delayed: {
    state: "delayed",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "تأخیر در ارسال", ar: "تأخر في الشحن", en: "Delayed" },
    descriptions: { fa: "به دلیل شرایط جوی یا ترافیک پستی، بسته با تأخیر مواجه شد.", ar: "تأخر غير متوقع في مسار التوصيل.", en: "Shipment delayed due to operational constraints." },
    badgeTone: "warning",
    icon: "⏱",
    stepIndex: -1,
    isFinal: false,
    isException: true,
  },
  return_requested: {
    state: "return_requested",
    baseOrderStatus: "refund_pending",
    labels: { fa: "درخواست مرجوعی", ar: "طلب إرجاع", en: "Return Requested" },
    descriptions: { fa: "خریدار درخواست بازگشت کالا ثبت کرده است.", ar: "تم تقديم طلب إرجاع المنتجات.", en: "Buyer requested return of items." },
    badgeTone: "warning",
    icon: "↺",
    stepIndex: -1,
    isFinal: false,
    isException: true,
  },
  returned: {
    state: "returned",
    baseOrderStatus: "refund_pending",
    labels: { fa: "مرجوع‌شده", ar: "تم الإرجاع", en: "Returned" },
    descriptions: { fa: "کالا به فروشنده بازگشت داده شد.", ar: "تمت إعادة السلعة إلى البائع.", en: "Items returned to seller warehouse." },
    badgeTone: "neutral",
    icon: "↺",
    stepIndex: -1,
    isFinal: false,
    isException: true,
  },
  refund_pending: {
    state: "refund_pending",
    baseOrderStatus: "refund_pending",
    labels: { fa: "در حال عودت وجه", ar: "قيد استرداد المبلغ", en: "Refund Pending" },
    descriptions: { fa: "حسابداری در حال واریز مبلغ به حساب خریدار است.", ar: "المبلغ قيد التحويل إلى حساب المشتري.", en: "Refund being processed to buyer account." },
    badgeTone: "warning",
    icon: "💰",
    stepIndex: -1,
    isFinal: false,
    isException: true,
  },
  refunded: {
    state: "refunded",
    baseOrderStatus: "refunded",
    labels: { fa: "مبلغ عودت داده شد", ar: "تم استرداد المبلغ", en: "Refunded" },
    descriptions: { fa: "مبلغ سفارش به حساب خریدار واریز شد.", ar: "تمت إعادة المبلغ بالكامل.", en: "Full refund completed." },
    badgeTone: "success",
    icon: "✓",
    stepIndex: -1,
    isFinal: true,
    isException: true,
  },
  delivery_failed: {
    state: "delivery_failed",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "تحویل ناموفق", ar: "فشل التوصيل", en: "Delivery Failed" },
    descriptions: { fa: "مأمور توزیع به آدرس مراجعه کرد اما خریدار در محل حضور نداشت.", ar: "تعذر التوصيل لعدم الرد في العنوان.", en: "Delivery attempt failed; recipient unavailable." },
    badgeTone: "danger",
    icon: "⚠",
    stepIndex: -1,
    isFinal: false,
    isException: true,
  },
  order_issue: {
    state: "order_issue",
    baseOrderStatus: "in_fulfillment",
    labels: { fa: "گزارش مشکل در سفارش", ar: "مشكلة في الطلب", en: "Order Issue" },
    descriptions: { fa: "موضوع توسط پشتیبانی یا بازرسی در دست بررسی است.", ar: "الطلب قيد المتابعة من الدعم.", en: "Order is under investigation by support." },
    badgeTone: "danger",
    icon: "⚠",
    stepIndex: -1,
    isFinal: false,
    isException: true,
  },
};

export interface StateTransitionRule {
  readonly from: OrderLifecycleState;
  readonly to: OrderLifecycleState;
  readonly allowedActors: readonly ActorRole[];
  readonly description: string;
}

export const ORDER_TRANSITION_RULES: readonly StateTransitionRule[] = [
  // Checkout & Payment
  { from: "draft", to: "pending_payment", allowedActors: ["buyer", "system"], description: "Buyer checks out and requests payment" },
  { from: "draft", to: "cancelled", allowedActors: ["buyer", "system"], description: "Buyer abandons or cancels draft" },
  { from: "pending_payment", to: "paid", allowedActors: ["system"], description: "Payment gateway confirmation" },
  { from: "pending_payment", to: "payment_failed", allowedActors: ["system"], description: "Payment gateway error or timeout" },
  { from: "pending_payment", to: "cancelled", allowedActors: ["buyer", "system"], description: "Buyer cancels pending payment" },
  { from: "payment_failed", to: "pending_payment", allowedActors: ["buyer"], description: "Buyer retries payment" },
  { from: "payment_failed", to: "cancelled", allowedActors: ["buyer", "system"], description: "Payment retry cancelled" },

  // Confirmation by Seller
  { from: "paid", to: "waiting_seller", allowedActors: ["system"], description: "Routed to seller queue" },
  { from: "waiting_seller", to: "confirmed", allowedActors: ["seller", "admin"], description: "Seller accepts order" },
  { from: "waiting_seller", to: "rejected", allowedActors: ["seller", "admin"], description: "Seller rejects (out of stock)" },
  { from: "waiting_seller", to: "cancelled", allowedActors: ["buyer", "admin"], description: "Buyer cancels before confirmation" },
  { from: "rejected", to: "refund_pending", allowedActors: ["system", "admin"], description: "Automatic refund after rejection" },

  // Fulfillment & Preparation
  { from: "confirmed", to: "preparing", allowedActors: ["seller", "system"], description: "Seller starts picking and assembly" },
  { from: "confirmed", to: "cancelled", allowedActors: ["seller", "buyer", "admin"], description: "Mutual cancellation with refund" },
  { from: "preparing", to: "packed", allowedActors: ["seller", "system"], description: "Items boxed and labeled" },
  { from: "preparing", to: "delayed", allowedActors: ["seller", "admin"], description: "Preparation delay recorded" },
  { from: "preparing", to: "order_issue", allowedActors: ["seller", "buyer", "admin"], description: "Damaged goods during prep" },
  { from: "delayed", to: "preparing", allowedActors: ["seller"], description: "Delay resolved, resumed" },
  { from: "packed", to: "ready_to_ship", allowedActors: ["seller", "system"], description: "Awaiting pickup" },

  // Shipping & Dispatch
  { from: "ready_to_ship", to: "handed_to_carrier", allowedActors: ["seller", "carrier"], description: "Carrier picks up parcel" },
  { from: "handed_to_carrier", to: "shipped", allowedActors: ["carrier", "system"], description: "Carrier depot scanned" },
  { from: "shipped", to: "in_transit", allowedActors: ["carrier", "system"], description: "Movement between hubs" },
  { from: "in_transit", to: "out_for_delivery", allowedActors: ["carrier", "system"], description: "Assigned to final mile delivery" },
  { from: "in_transit", to: "delayed", allowedActors: ["carrier", "system"], description: "Weather/transit disruption" },
  { from: "delayed", to: "in_transit", allowedActors: ["carrier", "system"], description: "Transit resumed" },

  // Delivery & Completion
  { from: "out_for_delivery", to: "delivered", allowedActors: ["carrier", "buyer", "admin", "system"], description: "Recipient received package" },
  { from: "out_for_delivery", to: "delivery_failed", allowedActors: ["carrier"], description: "Recipient unavailable" },
  { from: "delivery_failed", to: "out_for_delivery", allowedActors: ["carrier"], description: "Second delivery attempt" },
  { from: "delivery_failed", to: "returned", allowedActors: ["carrier"], description: "Returned to sender after max attempts" },

  // Post-delivery Returns & Refunds
  { from: "delivered", to: "return_requested", allowedActors: ["buyer"], description: "Buyer requests return within window" },
  { from: "delivered", to: "order_issue", allowedActors: ["buyer", "admin"], description: "Missing item or dispute reported" },
  { from: "return_requested", to: "returned", allowedActors: ["seller", "carrier", "admin"], description: "Return package received by seller" },
  { from: "return_requested", to: "delivered", allowedActors: ["admin", "seller"], description: "Return rejected by seller" },
  { from: "returned", to: "refund_pending", allowedActors: ["seller", "admin", "system"], description: "Inspection passed, initiate refund" },
  { from: "refund_pending", to: "refunded", allowedActors: ["system", "admin"], description: "Refund credited to bank account" },
  { from: "order_issue", to: "refund_pending", allowedActors: ["admin"], description: "Dispute settled with refund" },
  { from: "order_issue", to: "delivered", allowedActors: ["admin"], description: "Dispute resolved without refund" },
];

export function canTransition(
  from: OrderLifecycleState,
  to: OrderLifecycleState,
  actor: ActorRole = "system",
): boolean {
  return ORDER_TRANSITION_RULES.some(
    (rule) => rule.from === from && rule.to === to && (rule.allowedActors.includes(actor) || actor === "admin"),
  );
}

export function getAllowedTransitions(
  current: OrderLifecycleState,
  actor: ActorRole = "buyer",
): readonly OrderLifecycleState[] {
  return ORDER_TRANSITION_RULES
    .filter((rule) => rule.from === current && (rule.allowedActors.includes(actor) || actor === "admin"))
    .map((rule) => rule.to);
}

export interface TimelineStepView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly status: "completed" | "current" | "upcoming" | "exception";
  readonly timestamp?: string | undefined;
  readonly actor?: string | undefined;
}

export const STANDARD_TIMELINE_STEPS = [
  { key: "created", labelFa: "ثبت سفارش", labelAr: "تسجيل الطلب", labelEn: "Order Placed", icon: "✓" },
  { key: "confirmed", labelFa: "تأیید فروشنده", labelAr: "تأكيد البائع", labelEn: "Seller Confirmed", icon: "◉" },
  { key: "preparing", labelFa: "آماده‌سازی", labelAr: "التجهيز والتغليف", labelEn: "Preparing & Packing", icon: "⚙" },
  { key: "shipped", labelFa: "تحویل به حامل", labelAr: "التسليم للشحن", labelEn: "Handed to Carrier", icon: "🚚" },
  { key: "in_transit", labelFa: "در مسیر تحویل", labelAr: "في الطريق", labelEn: "In Transit", icon: "↔" },
  { key: "delivered", labelFa: "تحویل به خریدار", labelAr: "تم التوصيل", labelEn: "Delivered", icon: "★" },
] as const;

export function buildOrderTimeline(
  state: OrderLifecycleState,
  locale: "fa" | "ar" | "en" = "fa",
  history: readonly { state: OrderLifecycleState; at: string; note?: string }[] = [],
): readonly TimelineStepView[] {
  const currentMeta = ORDER_STATE_METADATA[state] ?? ORDER_STATE_METADATA.confirmed;
  const currentStep = currentMeta.stepIndex;

  if (currentMeta.isException) {
    return [
      {
        id: "step-created",
        label: locale === "fa" ? "سفارش ثبت شد" : locale === "ar" ? "تم تسجيل الطلب" : "Order Placed",
        description: locale === "fa" ? "ثبت اولیه در سیستم" : locale === "ar" ? "مسجل في النظام" : "Logged in system",
        icon: "✓",
        status: "completed",
        timestamp: history[0]?.at,
      },
      {
        id: "step-exception",
        label: currentMeta.labels[locale],
        description: currentMeta.descriptions[locale],
        icon: currentMeta.icon,
        status: "exception",
        timestamp: history[history.length - 1]?.at,
      },
    ];
  }

  return STANDARD_TIMELINE_STEPS.map((stepDef, idx) => {
    let status: "completed" | "current" | "upcoming" | "exception" = "upcoming";
    if (idx < currentStep || (currentMeta.isFinal && idx <= currentStep)) status = "completed";
    else if (idx === currentStep) status = "current";

    const label = locale === "fa" ? stepDef.labelFa : locale === "ar" ? stepDef.labelAr : stepDef.labelEn;
    const historyItem = history.find((h) => ORDER_STATE_METADATA[h.state]?.stepIndex === idx);

    return {
      id: `step-${stepDef.key}`,
      label,
      description: idx === currentStep ? currentMeta.descriptions[locale] : "",
      icon: stepDef.icon,
      status,
      timestamp: historyItem?.at,
    };
  });
}

export interface OrderActionView {
  readonly actionId: string;
  readonly title: string;
  readonly tone: "primary" | "secondary" | "danger" | "ghost";
  readonly targetRoute?: string | undefined;
  readonly requiresConfirmation?: boolean | undefined;
}

export function resolveOrderNextAction(
  state: OrderLifecycleState,
  role: "buyer" | "seller",
  locale: "fa" | "ar" | "en" = "fa",
  orderId = "",
): OrderActionView | null {
  if (role === "buyer") {
    switch (state) {
      case "pending_payment":
      case "payment_failed":
        return {
          actionId: "retry_payment",
          title: locale === "fa" ? "پرداخت سفارش" : locale === "ar" ? "دفع الطلب" : "Pay Now",
          tone: "primary",
          targetRoute: `/checkout?orderId=${encodeURIComponent(orderId)}`,
        };
      case "out_for_delivery":
        return {
          actionId: "track_live",
          title: locale === "fa" ? "مشاهده زنده مسیر پیک" : locale === "ar" ? "تتبع مباشر للمندوب" : "Live Courier Tracking",
          tone: "primary",
          targetRoute: `/orders?track=${encodeURIComponent(orderId)}`,
        };
      case "delivered":
        return {
          actionId: "review_and_reorder",
          title: locale === "fa" ? "ثبت نظر یا خرید مجدد" : locale === "ar" ? "تقييم أو إعادة الشراء" : "Review & Reorder",
          tone: "secondary",
          targetRoute: `/orders?orderId=${encodeURIComponent(orderId)}`,
        };
      case "delivery_failed":
        return {
          actionId: "contact_carrier",
          title: locale === "fa" ? "هماهنگی آدرس با پشتیبانی" : locale === "ar" ? "تنسيق العنوان مع الدعم" : "Contact Delivery Support",
          tone: "primary",
          targetRoute: "/messages",
        };
      case "return_requested":
        return {
          actionId: "return_status",
          title: locale === "fa" ? "پیگیری مرجوعی" : locale === "ar" ? "متابعة الإرجاع" : "Track Return",
          tone: "ghost",
          targetRoute: `/orders?orderId=${encodeURIComponent(orderId)}`,
        };
      default:
        return {
          actionId: "view_details",
          title: locale === "fa" ? "مشاهده جزئیات سفارش" : locale === "ar" ? "عرض تفاصيل الطلب" : "View Order Details",
          tone: "ghost",
          targetRoute: `/orders?orderId=${encodeURIComponent(orderId)}`,
        };
    }
  }

  // Seller Role
  switch (state) {
    case "waiting_seller":
      return {
        actionId: "confirm_order",
        title: locale === "fa" ? "تأیید و پذیرش سفارش" : locale === "ar" ? "تأكيد وقبول الطلب" : "Accept & Confirm Order",
        tone: "primary",
        requiresConfirmation: true,
      };
    case "confirmed":
    case "preparing":
      return {
        actionId: "mark_packed",
        title: locale === "fa" ? "اتمام بسته‌بندی و صدور بارنامه" : locale === "ar" ? "إكمال التغليف" : "Mark as Packed",
        tone: "primary",
      };
    case "packed":
    case "ready_to_ship":
      return {
        actionId: "handover_carrier",
        title: locale === "fa" ? "تحویل به مأمور پست" : locale === "ar" ? "تسليم لمندوب الشحن" : "Hand to Courier",
        tone: "primary",
      };
    default:
      return null;
  }
}
