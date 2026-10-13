/**
 * Phoenix Business Schema & Capability System
 *
 * Implements Schema-driven Profile and Dashboard architectures
 * tailored to each Business Type and Occupation.
 */

import type { BusinessType } from "./business-taxonomy.js";

export type BusinessCapability =
  | "products"
  | "variants"
  | "inventory"
  | "instant_purchase"
  | "compare"
  | "discounts"
  | "brands"
  | "sizes"
  | "colors"
  | "orders"
  | "customers"
  | "analytics"
  | "services"
  | "appointments"
  | "schedule"
  | "patients"
  | "insurance"
  | "doctors"
  | "credentials"
  | "staff"
  | "tables"
  | "menu"
  | "kitchen"
  | "reservations"
  | "takeaway"
  | "rooms"
  | "room_types"
  | "amenities"
  | "classes"
  | "courses"
  | "students"
  | "workorders"
  | "parts"
  | "warranty"
  | "contracts"
  | "sessions"
  | "reviews"
  | "locations"
  | "team";

export interface DashboardKpiItem {
  readonly id: string;
  readonly labelKey: string;
  readonly value: string;
  readonly change?: string;
  readonly isPositive?: boolean;
  readonly icon: string;
  readonly capability?: BusinessCapability;
}

export interface DashboardQuickActionItem {
  readonly id: string;
  readonly labelKey: string;
  readonly path: string;
  readonly icon: string;
  readonly isPrimary?: boolean;
  readonly capability?: BusinessCapability;
}

export interface BusinessAiRecommendation {
  readonly id: string;
  readonly titleKey: string;
  readonly textKey: string;
  readonly actionLabelKey: string;
  readonly actionPath: string;
  readonly urgency: "critical" | "warning" | "opportunity" | "info";
  readonly capability?: BusinessCapability;
}

export interface ProfileSectionConfig {
  readonly id: string;
  readonly titleKey: string;
  readonly subtitleKey?: string;
  readonly sectionType:
    | "about"
    | "catalog_grid"
    | "service_list"
    | "menu_categories"
    | "doctor_credentials"
    | "booking_slots"
    | "specialists"
    | "rooms_grid"
    | "courses_list"
    | "workorder_request"
    | "insurance_partners"
    | "brands_gallery"
    | "reviews_rating"
    | "location_hours";
  readonly requiredCapabilities: readonly BusinessCapability[];
}

export interface WorkflowStepConfig {
  readonly stepNumber: number;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly targetModule: string;
}

export interface BusinessTypeSchema {
  readonly businessType: BusinessType;
  readonly titleKey: string;
  readonly icon: string;
  readonly capabilities: readonly BusinessCapability[];
  readonly primaryCta: {
    readonly labelKey: string;
    readonly path: string;
    readonly icon: string;
  };
  readonly dashboardKpis: readonly DashboardKpiItem[];
  readonly quickActions: readonly DashboardQuickActionItem[];
  readonly aiRecommendations: readonly BusinessAiRecommendation[];
  readonly profileSections: readonly ProfileSectionConfig[];
  readonly workflowSteps: readonly WorkflowStepConfig[];
}

export const BUSINESS_TYPE_SCHEMAS: Readonly<Record<BusinessType, BusinessTypeSchema>> = {
  retail_clothing: {
    businessType: "retail_clothing",
    titleKey: "taxonomy.occupation.clothing_store",
    icon: "👗",
    capabilities: [
      "products",
      "variants",
      "inventory",
      "instant_purchase",
      "compare",
      "discounts",
      "brands",
      "sizes",
      "colors",
      "orders",
      "customers",
      "analytics",
      "reviews",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.addProduct",
      path: "/product-studio",
      icon: "✦",
    },
    dashboardKpis: [
      { id: "todaySales", labelKey: "sellerDashboard.kpi.todaySales", value: "۱۴,۸۵۰,۰۰۰ تومان", change: "+۱۸٪", isPositive: true, icon: "💳" },
      { id: "newOrders", labelKey: "sellerDashboard.kpi.newOrders", value: "۲۳ سفارش", change: "+۵", isPositive: true, icon: "📦" },
      { id: "lowStock", labelKey: "sellerDashboard.kpi.lowStock", value: "۴ کالا", change: "نیازمند شارژ", isPositive: false, icon: "⚠️" },
      { id: "conversionRate", labelKey: "sellerDashboard.kpi.conversionRate", value: "۳.۸٪", change: "+۰.۴٪", isPositive: true, icon: "📈" },
      { id: "activeDiscounts", labelKey: "sellerDashboard.kpi.activeDiscounts", value: "۳ پروموشن", icon: "🏷" },
      { id: "activeCustomers", labelKey: "sellerDashboard.kpi.activeCustomers", value: "۱۸۴ نفر", icon: "👥" },
    ],
    quickActions: [
      { id: "addProduct", labelKey: "sellerDashboard.action.addProduct", path: "/product-studio", icon: "＋", isPrimary: true },
      { id: "manageInventory", labelKey: "sellerDashboard.action.manageInventory", path: "/catalog", icon: "▦" },
      { id: "processOrders", labelKey: "sellerDashboard.action.processOrders", path: "/orders", icon: "📦" },
      { id: "createDiscount", labelKey: "sellerDashboard.action.createDiscount", path: "/promotion", icon: "🏷" },
    ],
    aiRecommendations: [
      {
        id: "rec_stock_apparel",
        titleKey: "sellerDashboard.ai.stockWarningTitle",
        textKey: "sellerDashboard.ai.clothingStockAlert",
        actionLabelKey: "sellerDashboard.action.viewStock",
        actionPath: "/catalog",
        urgency: "warning",
        capability: "inventory",
      },
      {
        id: "rec_trend_apparel",
        titleKey: "sellerDashboard.ai.salesOpportunityTitle",
        textKey: "sellerDashboard.ai.clothingTrendOpportunity",
        actionLabelKey: "sellerDashboard.action.applyPromotion",
        actionPath: "/promotion",
        urgency: "opportunity",
        capability: "discounts",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.aboutShop", sectionType: "about", requiredCapabilities: [] },
      { id: "catalog", titleKey: "sellerProfile.section.clothingCollection", sectionType: "catalog_grid", requiredCapabilities: ["products"] },
      { id: "brands", titleKey: "sellerProfile.section.brandsAndAuthenticity", sectionType: "brands_gallery", requiredCapabilities: ["brands"] },
      { id: "reviews", titleKey: "sellerProfile.section.buyerReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.storeLocationHours", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepProductIntake", descriptionKey: "sellerDashboard.workflow.stepProductIntakeDesc", targetModule: "محصولات" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepVariants", descriptionKey: "sellerDashboard.workflow.stepVariantsDesc", targetModule: "مدل‌ها و تنوع" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepInventory", descriptionKey: "sellerDashboard.workflow.stepInventoryDesc", targetModule: "موجودی" },
      { stepNumber: 4, labelKey: "sellerDashboard.workflow.stepFulfillment", descriptionKey: "sellerDashboard.workflow.stepFulfillmentDesc", targetModule: "سفارش‌ها" },
    ],
  },

  medical_clinic: {
    businessType: "medical_clinic",
    titleKey: "taxonomy.occupation.doctor_office",
    icon: "🩺",
    capabilities: [
      "services",
      "appointments",
      "schedule",
      "patients",
      "insurance",
      "doctors",
      "credentials",
      "reviews",
      "analytics",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.addAppointment",
      path: "/booking",
      icon: "◷",
    },
    dashboardKpis: [
      { id: "todayAppointments", labelKey: "sellerDashboard.kpi.todayAppointments", value: "۱۴ نوبت", change: "تکمیل", isPositive: true, icon: "◷" },
      { id: "upcomingAppointments", labelKey: "sellerDashboard.kpi.upcomingAppointments", value: "۴۸ نوبت", change: "هفته جاری", isPositive: true, icon: "📅" },
      { id: "activePatients", labelKey: "sellerDashboard.kpi.activePatients", value: "۳۲۵ پرونده", change: "+۱۵ جدید", isPositive: true, icon: "🏥" },
      { id: "cancelledAppointments", labelKey: "sellerDashboard.kpi.cancelledAppointments", value: "۱ نوبت", change: "-۲", isPositive: true, icon: "✕" },
      { id: "contractedInsurances", labelKey: "sellerDashboard.kpi.contractedInsurances", value: "۶ بیمه فعال", icon: "🛡" },
      { id: "patientSatisfaction", labelKey: "sellerDashboard.kpi.patientSatisfaction", value: "۴.۹ از ۵", icon: "★" },
    ],
    quickActions: [
      { id: "addAppointment", labelKey: "sellerDashboard.action.addAppointment", path: "/booking", icon: "＋", isPrimary: true },
      { id: "manageSchedule", labelKey: "sellerDashboard.action.manageSchedule", path: "/booking", icon: "◷" },
      { id: "addService", labelKey: "sellerDashboard.action.addService", path: "/catalog", icon: "✦" },
      { id: "patientRecords", labelKey: "sellerDashboard.action.patientRecords", path: "/customer", icon: "👥" },
    ],
    aiRecommendations: [
      {
        id: "rec_clinic_density",
        titleKey: "sellerDashboard.ai.scheduleDensityTitle",
        textKey: "sellerDashboard.ai.clinicDensityAlert",
        actionLabelKey: "sellerDashboard.action.sendReminder",
        actionPath: "/booking",
        urgency: "critical",
        capability: "appointments",
      },
      {
        id: "rec_clinic_insurance",
        titleKey: "sellerDashboard.ai.insuranceOpportunityTitle",
        textKey: "sellerDashboard.ai.clinicInsuranceTip",
        actionLabelKey: "sellerDashboard.action.updateProfile",
        actionPath: "/business/profile",
        urgency: "info",
        capability: "insurance",
      },
    ],
    profileSections: [
      { id: "credentials", titleKey: "sellerProfile.section.doctorBiography", sectionType: "doctor_credentials", requiredCapabilities: ["credentials"] },
      { id: "services", titleKey: "sellerProfile.section.medicalServices", sectionType: "service_list", requiredCapabilities: ["services"] },
      { id: "booking", titleKey: "sellerProfile.section.onlineAppointmentSlots", sectionType: "booking_slots", requiredCapabilities: ["appointments"] },
      { id: "insurance", titleKey: "sellerProfile.section.acceptedInsurances", sectionType: "insurance_partners", requiredCapabilities: ["insurance"] },
      { id: "reviews", titleKey: "sellerProfile.section.patientExperiences", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.clinicAddressHours", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepReception", descriptionKey: "sellerDashboard.workflow.stepReceptionDesc", targetModule: "نوبت‌ها" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepConsultation", descriptionKey: "sellerDashboard.workflow.stepConsultationDesc", targetModule: "پزشکان" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepTreatment", descriptionKey: "sellerDashboard.workflow.stepTreatmentDesc", targetModule: "خدمات" },
      { stepNumber: 4, labelKey: "sellerDashboard.workflow.stepSettlement", descriptionKey: "sellerDashboard.workflow.stepSettlementDesc", targetModule: "پرداخت" },
    ],
  },

  food_restaurant: {
    businessType: "food_restaurant",
    titleKey: "taxonomy.occupation.restaurant",
    icon: "🥘",
    capabilities: [
      "menu",
      "orders",
      "tables",
      "kitchen",
      "reservations",
      "takeaway",
      "discounts",
      "reviews",
      "analytics",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.manageOrders",
      path: "/orders",
      icon: "🍽",
    },
    dashboardKpis: [
      { id: "todayOrders", labelKey: "sellerDashboard.kpi.todayOrders", value: "۶۲ فیش", change: "+۱۴٪", isPositive: true, icon: "🍽" },
      { id: "kitchenPending", labelKey: "sellerDashboard.kpi.kitchenPending", value: "۸ سفارش", change: "در حال پخت", isPositive: false, icon: "🔥" },
      { id: "tableReservations", labelKey: "sellerDashboard.kpi.tableReservations", value: "۵ میز", change: "عصر امروز", isPositive: true, icon: "⌂" },
      { id: "revenueToday", labelKey: "sellerDashboard.kpi.todaySales", value: "۹,۴۰۰,۰۰۰ تومان", change: "+۲۲٪", isPositive: true, icon: "💳" },
      { id: "topDish", labelKey: "sellerDashboard.kpi.topDish", value: "کباب برگ", icon: "⭐" },
    ],
    quickActions: [
      { id: "manageOrders", labelKey: "sellerDashboard.action.manageOrders", path: "/orders", icon: "🍽", isPrimary: true },
      { id: "manageMenu", labelKey: "sellerDashboard.action.manageMenu", path: "/catalog", icon: "📜" },
      { id: "reserveTable", labelKey: "sellerDashboard.action.reserveTable", path: "/booking", icon: "⌂" },
      { id: "kitchenQueue", labelKey: "sellerDashboard.action.kitchenQueue", path: "/operations", icon: "🔥" },
    ],
    aiRecommendations: [
      {
        id: "rec_restaurant_bestseller",
        titleKey: "sellerDashboard.ai.menuDemandTitle",
        textKey: "sellerDashboard.ai.restaurantDemandAlert",
        actionLabelKey: "sellerDashboard.action.viewMenu",
        actionPath: "/catalog",
        urgency: "opportunity",
        capability: "menu",
      },
      {
        id: "rec_restaurant_prep",
        titleKey: "sellerDashboard.ai.peakHoursTitle",
        textKey: "sellerDashboard.ai.restaurantPeakAlert",
        actionLabelKey: "sellerDashboard.action.kitchenQueue",
        actionPath: "/operations",
        urgency: "warning",
        capability: "kitchen",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.restaurantStory", sectionType: "about", requiredCapabilities: [] },
      { id: "menu", titleKey: "sellerProfile.section.digitalMenu", sectionType: "menu_categories", requiredCapabilities: ["menu"] },
      { id: "booking", titleKey: "sellerProfile.section.onlineTableReservation", sectionType: "booking_slots", requiredCapabilities: ["reservations"] },
      { id: "reviews", titleKey: "sellerProfile.section.dinerReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.restaurantHoursLocation", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepOrderIntake", descriptionKey: "sellerDashboard.workflow.stepOrderIntakeDesc", targetModule: "سفارش‌های امروز" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepKitchen", descriptionKey: "sellerDashboard.workflow.stepKitchenDesc", targetModule: "آشپزخانه" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepServiceTable", descriptionKey: "sellerDashboard.workflow.stepServiceTableDesc", targetModule: "میزها" },
      { stepNumber: 4, labelKey: "sellerDashboard.workflow.stepCheckout", descriptionKey: "sellerDashboard.workflow.stepCheckoutDesc", targetModule: "پرداخت" },
    ],
  },

  beauty_salon: {
    businessType: "beauty_salon",
    titleKey: "taxonomy.occupation.beauty_salon",
    icon: "💇",
    capabilities: [
      "services",
      "appointments",
      "schedule",
      "staff",
      "reviews",
      "analytics",
      "discounts",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.addAppointment",
      path: "/booking",
      icon: "✦",
    },
    dashboardKpis: [
      { id: "todayAppointments", labelKey: "sellerDashboard.kpi.todaySlots", value: "۱۱ نوبت", change: "۳ نوبت مانده", isPositive: true, icon: "✦" },
      { id: "activeStylists", labelKey: "sellerDashboard.kpi.activeStylists", value: "۴ متخصص", change: "حاضر در سالن", isPositive: true, icon: "👥" },
      { id: "newClients", labelKey: "sellerDashboard.kpi.newClients", value: "۸ نفر", change: "+۳", isPositive: true, icon: "✨" },
      { id: "todaySales", labelKey: "sellerDashboard.kpi.todaySales", value: "۵,۶۰۰,۰۰۰ تومان", isPositive: true, icon: "💳" },
    ],
    quickActions: [
      { id: "addAppointment", labelKey: "sellerDashboard.action.addAppointment", path: "/booking", icon: "＋", isPrimary: true },
      { id: "manageStaff", labelKey: "sellerDashboard.action.manageStaff", path: "/business?module=متخصصان", icon: "👥" },
      { id: "manageServices", labelKey: "sellerDashboard.action.addService", path: "/catalog", icon: "✦" },
    ],
    aiRecommendations: [
      {
        id: "rec_salon_slots",
        titleKey: "sellerDashboard.ai.emptySlotsTitle",
        textKey: "sellerDashboard.ai.salonMidweekSlots",
        actionLabelKey: "sellerDashboard.action.createDiscount",
        actionPath: "/promotion",
        urgency: "opportunity",
        capability: "discounts",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.salonOverview", sectionType: "about", requiredCapabilities: [] },
      { id: "services", titleKey: "sellerProfile.section.beautyServicesMenu", sectionType: "service_list", requiredCapabilities: ["services"] },
      { id: "specialists", titleKey: "sellerProfile.section.stylistsAndExperts", sectionType: "specialists", requiredCapabilities: ["staff"] },
      { id: "booking", titleKey: "sellerProfile.section.onlineSalonBooking", sectionType: "booking_slots", requiredCapabilities: ["appointments"] },
      { id: "reviews", titleKey: "sellerProfile.section.clientReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.salonHoursAddress", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepClientGreeting", descriptionKey: "sellerDashboard.workflow.stepClientGreetingDesc", targetModule: "وقت‌های امروز" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepStylistAssignment", descriptionKey: "sellerDashboard.workflow.stepStylistAssignmentDesc", targetModule: "متخصصان" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepServiceDelivery", descriptionKey: "sellerDashboard.workflow.stepServiceDeliveryDesc", targetModule: "خدمات" },
      { stepNumber: 4, labelKey: "sellerDashboard.workflow.stepPayment", descriptionKey: "sellerDashboard.workflow.stepPaymentDesc", targetModule: "پرداخت" },
    ],
  },

  retail_digital: {
    businessType: "retail_digital",
    titleKey: "taxonomy.occupation.digital_store",
    icon: "💻",
    capabilities: [
      "products",
      "variants",
      "inventory",
      "instant_purchase",
      "compare",
      "warranty",
      "brands",
      "orders",
      "customers",
      "analytics",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.addProduct",
      path: "/product-studio",
      icon: "✦",
    },
    dashboardKpis: [
      { id: "todaySales", labelKey: "sellerDashboard.kpi.todaySales", value: "۴۲,۰۰۰,۰۰۰ تومان", change: "+۳۱٪", isPositive: true, icon: "💳" },
      { id: "newOrders", labelKey: "sellerDashboard.kpi.newOrders", value: "۱۱ سفارش", change: "+۴", isPositive: true, icon: "📦" },
      { id: "warrantyRequests", labelKey: "sellerDashboard.kpi.warrantyRequests", value: "۲ مورد", icon: "🛡" },
      { id: "lowStock", labelKey: "sellerDashboard.kpi.lowStock", value: "۳ قلم", change: "رو به اتمام", isPositive: false, icon: "⚠️" },
    ],
    quickActions: [
      { id: "addProduct", labelKey: "sellerDashboard.action.addProduct", path: "/product-studio", icon: "＋", isPrimary: true },
      { id: "manageInventory", labelKey: "sellerDashboard.action.manageInventory", path: "/catalog", icon: "▦" },
      { id: "processOrders", labelKey: "sellerDashboard.action.processOrders", path: "/orders", icon: "📦" },
    ],
    aiRecommendations: [
      {
        id: "rec_digital_stock",
        titleKey: "sellerDashboard.ai.stockWarningTitle",
        textKey: "sellerDashboard.ai.digitalAccessoriesStock",
        actionLabelKey: "sellerDashboard.action.viewStock",
        actionPath: "/catalog",
        urgency: "warning",
        capability: "inventory",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.digitalStoreIntro", sectionType: "about", requiredCapabilities: [] },
      { id: "catalog", titleKey: "sellerProfile.section.digitalProductsGrid", sectionType: "catalog_grid", requiredCapabilities: ["products"] },
      { id: "brands", titleKey: "sellerProfile.section.brandsAndWarranty", sectionType: "brands_gallery", requiredCapabilities: ["brands"] },
      { id: "reviews", titleKey: "sellerProfile.section.buyerReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.storeLocationHours", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepProductIntake", descriptionKey: "sellerDashboard.workflow.stepProductIntakeDesc", targetModule: "محصولات" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepInventory", descriptionKey: "sellerDashboard.workflow.stepInventoryDesc", targetModule: "موجودی" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepFulfillment", descriptionKey: "sellerDashboard.workflow.stepFulfillmentDesc", targetModule: "سفارش‌ها" },
    ],
  },

  service_repair: {
    businessType: "service_repair",
    titleKey: "taxonomy.occupation.repair_shop",
    icon: "🔧",
    capabilities: [
      "services",
      "workorders",
      "parts",
      "warranty",
      "schedule",
      "customers",
      "reviews",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.newWorkorder",
      path: "/operations",
      icon: "🔧",
    },
    dashboardKpis: [
      { id: "openWorkorders", labelKey: "sellerDashboard.kpi.openWorkorders", value: "۹ دستگاه", change: "در حال تعمیر", isPositive: true, icon: "🔧" },
      { id: "readyPickup", labelKey: "sellerDashboard.kpi.readyPickup", value: "۴ دستگاه", change: "آماده تحویل", isPositive: true, icon: "✓" },
      { id: "waitingParts", labelKey: "sellerDashboard.kpi.waitingParts", value: "۲ سفارش", change: "در انتظار قطعه", isPositive: false, icon: "⏱" },
      { id: "todayRevenue", labelKey: "sellerDashboard.kpi.todaySales", value: "۳,۸۰۰,۰۰۰ تومان", icon: "💳" },
    ],
    quickActions: [
      { id: "newWorkorder", labelKey: "sellerDashboard.action.newWorkorder", path: "/operations", icon: "＋", isPrimary: true },
      { id: "partsStock", labelKey: "sellerDashboard.action.manageInventory", path: "/catalog", icon: "🔩" },
      { id: "clientHistory", labelKey: "sellerDashboard.action.patientRecords", path: "/customer", icon: "👥" },
    ],
    aiRecommendations: [
      {
        id: "rec_repair_delay",
        titleKey: "sellerDashboard.ai.repairDelayTitle",
        textKey: "sellerDashboard.ai.repairPartsDelay",
        actionLabelKey: "sellerDashboard.action.viewWorkorders",
        actionPath: "/operations",
        urgency: "warning",
        capability: "workorders",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.repairWorkshopIntro", sectionType: "about", requiredCapabilities: [] },
      { id: "services", titleKey: "sellerProfile.section.technicalRepairServices", sectionType: "service_list", requiredCapabilities: ["services"] },
      { id: "request", titleKey: "sellerProfile.section.onlineRepairRequest", sectionType: "workorder_request", requiredCapabilities: ["workorders"] },
      { id: "reviews", titleKey: "sellerProfile.section.clientReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.workshopLocationHours", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepIntakeInspection", descriptionKey: "sellerDashboard.workflow.stepIntakeInspectionDesc", targetModule: "عملیات" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepRepairExecution", descriptionKey: "sellerDashboard.workflow.stepRepairExecutionDesc", targetModule: "خدمات" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepQualityCheck", descriptionKey: "sellerDashboard.workflow.stepQualityCheckDesc", targetModule: "اعتماد" },
      { stepNumber: 4, labelKey: "sellerDashboard.workflow.stepDeliverySettlement", descriptionKey: "sellerDashboard.workflow.stepDeliverySettlementDesc", targetModule: "پرداخت" },
    ],
  },

  education_academy: {
    businessType: "education_academy",
    titleKey: "taxonomy.occupation.academy",
    icon: "🎓",
    capabilities: [
      "courses",
      "classes",
      "students",
      "schedule",
      "staff",
      "reviews",
      "analytics",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.addCourse",
      path: "/catalog",
      icon: "📚",
    },
    dashboardKpis: [
      { id: "activeCourses", labelKey: "sellerDashboard.kpi.activeCourses", value: "۸ دوره", icon: "📚" },
      { id: "enrolledStudents", labelKey: "sellerDashboard.kpi.enrolledStudents", value: "۱۴۲ دانشجو", change: "+۱۸", isPositive: true, icon: "🎓" },
      { id: "todayClasses", labelKey: "sellerDashboard.kpi.todayClasses", value: "۵ جلسه", change: "طبق برنامه", isPositive: true, icon: "◷" },
      { id: "tuitionCollected", labelKey: "sellerDashboard.kpi.todaySales", value: "۱۸,۲۰۰,۰۰۰ تومان", icon: "💳" },
    ],
    quickActions: [
      { id: "addCourse", labelKey: "sellerDashboard.action.addCourse", path: "/catalog", icon: "＋", isPrimary: true },
      { id: "manageSchedule", labelKey: "sellerDashboard.action.manageSchedule", path: "/booking", icon: "📅" },
      { id: "studentList", labelKey: "sellerDashboard.action.patientRecords", path: "/customer", icon: "👥" },
    ],
    aiRecommendations: [
      {
        id: "rec_academy_capacity",
        titleKey: "sellerDashboard.ai.courseCapacityTitle",
        textKey: "sellerDashboard.ai.academyCapacityTip",
        actionLabelKey: "sellerDashboard.action.viewCourses",
        actionPath: "/catalog",
        urgency: "opportunity",
        capability: "courses",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.academyIntro", sectionType: "about", requiredCapabilities: [] },
      { id: "courses", titleKey: "sellerProfile.section.availableCourses", sectionType: "courses_list", requiredCapabilities: ["courses"] },
      { id: "instructors", titleKey: "sellerProfile.section.instructorTeam", sectionType: "specialists", requiredCapabilities: ["staff"] },
      { id: "reviews", titleKey: "sellerProfile.section.studentTestimonials", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.academyAddressHours", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepCoursePublishing", descriptionKey: "sellerDashboard.workflow.stepCoursePublishingDesc", targetModule: "کاتالوگ" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepStudentEnrollment", descriptionKey: "sellerDashboard.workflow.stepStudentEnrollmentDesc", targetModule: "مشتریان" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepClassSchedule", descriptionKey: "sellerDashboard.workflow.stepClassScheduleDesc", targetModule: "رزرو" },
    ],
  },

  hospitality_hotel: {
    businessType: "hospitality_hotel",
    titleKey: "taxonomy.occupation.hotel",
    icon: "🏨",
    capabilities: [
      "rooms",
      "room_types",
      "amenities",
      "reservations",
      "schedule",
      "staff",
      "reviews",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.newReservation",
      path: "/booking",
      icon: "🛎",
    },
    dashboardKpis: [
      { id: "occupancyRate", labelKey: "sellerDashboard.kpi.occupancyRate", value: "۸۴٪", change: "+۱۵٪", isPositive: true, icon: "🏨" },
      { id: "todayCheckins", labelKey: "sellerDashboard.kpi.todayCheckins", value: "۶ مسافر", icon: "🔑" },
      { id: "availableRooms", labelKey: "sellerDashboard.kpi.availableRooms", value: "۴ اتاق", change: "خالی", isPositive: true, icon: "🛏" },
      { id: "hotelRevenue", labelKey: "sellerDashboard.kpi.todaySales", value: "۲۶,۰۰۰,۰۰۰ تومان", icon: "💳" },
    ],
    quickActions: [
      { id: "newReservation", labelKey: "sellerDashboard.action.newReservation", path: "/booking", icon: "＋", isPrimary: true },
      { id: "roomAvailability", labelKey: "sellerDashboard.action.manageSchedule", path: "/booking", icon: "🛏" },
      { id: "guestList", labelKey: "sellerDashboard.action.patientRecords", path: "/customer", icon: "👥" },
    ],
    aiRecommendations: [
      {
        id: "rec_hotel_weekend",
        titleKey: "sellerDashboard.ai.hotelWeekendTitle",
        textKey: "sellerDashboard.ai.hotelWeekendTip",
        actionLabelKey: "sellerDashboard.action.createDiscount",
        actionPath: "/promotion",
        urgency: "opportunity",
        capability: "reservations",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.hotelStoryAmenities", sectionType: "about", requiredCapabilities: [] },
      { id: "rooms", titleKey: "sellerProfile.section.roomTypesSuite", sectionType: "rooms_grid", requiredCapabilities: ["rooms"] },
      { id: "booking", titleKey: "sellerProfile.section.onlineRoomBooking", sectionType: "booking_slots", requiredCapabilities: ["reservations"] },
      { id: "reviews", titleKey: "sellerProfile.section.guestReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.hotelLocationMap", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepGuestBooking", descriptionKey: "sellerDashboard.workflow.stepGuestBookingDesc", targetModule: "رزرو" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepCheckinRoom", descriptionKey: "sellerDashboard.workflow.stepCheckinRoomDesc", targetModule: "عملیات" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepCheckoutBilling", descriptionKey: "sellerDashboard.workflow.stepCheckoutBillingDesc", targetModule: "پرداخت" },
    ],
  },

  professional_consulting: {
    businessType: "professional_consulting",
    titleKey: "taxonomy.occupation.consulting_office",
    icon: "💼",
    capabilities: [
      "services",
      "appointments",
      "contracts",
      "schedule",
      "sessions",
      "credentials",
      "reviews",
    ],
    primaryCta: {
      labelKey: "sellerDashboard.action.bookConsultation",
      path: "/booking",
      icon: "💼",
    },
    dashboardKpis: [
      { id: "todaySessions", labelKey: "sellerDashboard.kpi.todaySessions", value: "۴ جلسه", icon: "⏱" },
      { id: "activeCases", labelKey: "sellerDashboard.kpi.activeCases", value: "۱۶ پرونده", change: "+۲", isPositive: true, icon: "📁" },
      { id: "bookedHours", labelKey: "sellerDashboard.kpi.bookedHours", value: "۲۸ ساعت", change: "هفته جاری", isPositive: true, icon: "📅" },
      { id: "consultingRevenue", labelKey: "sellerDashboard.kpi.todaySales", value: "۸,۵۰۰,۰۰۰ تومان", icon: "💳" },
    ],
    quickActions: [
      { id: "bookConsultation", labelKey: "sellerDashboard.action.bookConsultation", path: "/booking", icon: "＋", isPrimary: true },
      { id: "manageServices", labelKey: "sellerDashboard.action.addService", path: "/catalog", icon: "✦" },
      { id: "clientFiles", labelKey: "sellerDashboard.action.patientRecords", path: "/customer", icon: "👥" },
    ],
    aiRecommendations: [
      {
        id: "rec_consulting_prep",
        titleKey: "sellerDashboard.ai.sessionPrepTitle",
        textKey: "sellerDashboard.ai.consultingPrepTip",
        actionLabelKey: "sellerDashboard.action.viewSessions",
        actionPath: "/booking",
        urgency: "info",
        capability: "appointments",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.consultantBioCredentials", sectionType: "doctor_credentials", requiredCapabilities: ["credentials"] },
      { id: "services", titleKey: "sellerProfile.section.consultingPractices", sectionType: "service_list", requiredCapabilities: ["services"] },
      { id: "booking", titleKey: "sellerProfile.section.bookSessionSlot", sectionType: "booking_slots", requiredCapabilities: ["appointments"] },
      { id: "reviews", titleKey: "sellerProfile.section.clientTestimonials", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.officeLocationContact", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepIntakeBrief", descriptionKey: "sellerDashboard.workflow.stepIntakeBriefDesc", targetModule: "نوبت‌ها" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepConsultingSession", descriptionKey: "sellerDashboard.workflow.stepConsultingSessionDesc", targetModule: "خدمات" },
      { stepNumber: 3, labelKey: "sellerDashboard.workflow.stepFollowupAgreement", descriptionKey: "sellerDashboard.workflow.stepFollowupAgreementDesc", targetModule: "مشتریان" },
    ],
  },

  // Fallback defaults for remaining types using the shared engine
  retail_general: {
    businessType: "retail_general",
    titleKey: "taxonomy.occupation.general_store",
    icon: "🏬",
    capabilities: ["products", "inventory", "instant_purchase", "orders", "customers", "analytics", "reviews"],
    primaryCta: { labelKey: "sellerDashboard.action.addProduct", path: "/product-studio", icon: "＋" },
    dashboardKpis: [
      { id: "todaySales", labelKey: "sellerDashboard.kpi.todaySales", value: "۸,۲۰۰,۰۰۰ تومان", icon: "💳" },
      { id: "newOrders", labelKey: "sellerDashboard.kpi.newOrders", value: "۱۴ سفارش", icon: "📦" },
      { id: "lowStock", labelKey: "sellerDashboard.kpi.lowStock", value: "۵ کالا", icon: "⚠️" },
    ],
    quickActions: [
      { id: "addProduct", labelKey: "sellerDashboard.action.addProduct", path: "/product-studio", icon: "＋", isPrimary: true },
      { id: "manageInventory", labelKey: "sellerDashboard.action.manageInventory", path: "/catalog", icon: "▦" },
    ],
    aiRecommendations: [
      {
        id: "rec_gen_stock",
        titleKey: "sellerDashboard.ai.stockWarningTitle",
        textKey: "sellerDashboard.ai.generalStockAlert",
        actionLabelKey: "sellerDashboard.action.viewStock",
        actionPath: "/catalog",
        urgency: "warning",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.aboutShop", sectionType: "about", requiredCapabilities: [] },
      { id: "catalog", titleKey: "sellerProfile.section.allProducts", sectionType: "catalog_grid", requiredCapabilities: ["products"] },
      { id: "reviews", titleKey: "sellerProfile.section.buyerReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.storeLocationHours", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepProductIntake", descriptionKey: "sellerDashboard.workflow.stepProductIntakeDesc", targetModule: "محصولات" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepFulfillment", descriptionKey: "sellerDashboard.workflow.stepFulfillmentDesc", targetModule: "سفارش‌ها" },
    ],
  },

  retail_specialty: {
    businessType: "retail_specialty",
    titleKey: "taxonomy.occupation.specialty_store",
    icon: "🏷",
    capabilities: ["products", "inventory", "instant_purchase", "brands", "orders", "customers", "reviews"],
    primaryCta: { labelKey: "sellerDashboard.action.addProduct", path: "/product-studio", icon: "＋" },
    dashboardKpis: [
      { id: "todaySales", labelKey: "sellerDashboard.kpi.todaySales", value: "۱۱,۵۰۰,۰۰۰ تومان", icon: "💳" },
      { id: "newOrders", labelKey: "sellerDashboard.kpi.newOrders", value: "۸ سفارش", icon: "📦" },
    ],
    quickActions: [
      { id: "addProduct", labelKey: "sellerDashboard.action.addProduct", path: "/product-studio", icon: "＋", isPrimary: true },
      { id: "manageInventory", labelKey: "sellerDashboard.action.manageInventory", path: "/catalog", icon: "▦" },
    ],
    aiRecommendations: [
      {
        id: "rec_spec_art",
        titleKey: "sellerDashboard.ai.salesOpportunityTitle",
        textKey: "sellerDashboard.ai.specialtyDemandTip",
        actionLabelKey: "sellerDashboard.action.viewStock",
        actionPath: "/catalog",
        urgency: "opportunity",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.aboutShop", sectionType: "about", requiredCapabilities: [] },
      { id: "catalog", titleKey: "sellerProfile.section.specialtyCollection", sectionType: "catalog_grid", requiredCapabilities: ["products"] },
      { id: "reviews", titleKey: "sellerProfile.section.buyerReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.storeLocationHours", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepProductIntake", descriptionKey: "sellerDashboard.workflow.stepProductIntakeDesc", targetModule: "محصولات" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepFulfillment", descriptionKey: "sellerDashboard.workflow.stepFulfillmentDesc", targetModule: "سفارش‌ها" },
    ],
  },

  medical_specialty_clinic: {
    businessType: "medical_specialty_clinic",
    titleKey: "taxonomy.occupation.specialty_clinic",
    icon: "🏥",
    capabilities: ["services", "appointments", "schedule", "patients", "insurance", "doctors", "credentials", "reviews"],
    primaryCta: { labelKey: "sellerDashboard.action.addAppointment", path: "/booking", icon: "◷" },
    dashboardKpis: [
      { id: "todayAppointments", labelKey: "sellerDashboard.kpi.todayAppointments", value: "۲۲ نوبت", icon: "◷" },
      { id: "activePatients", labelKey: "sellerDashboard.kpi.activePatients", value: "۵۱۰ پرونده", icon: "🏥" },
    ],
    quickActions: [
      { id: "addAppointment", labelKey: "sellerDashboard.action.addAppointment", path: "/booking", icon: "＋", isPrimary: true },
      { id: "manageSchedule", labelKey: "sellerDashboard.action.manageSchedule", path: "/booking", icon: "◷" },
    ],
    aiRecommendations: [
      {
        id: "rec_spec_clinic",
        titleKey: "sellerDashboard.ai.scheduleDensityTitle",
        textKey: "sellerDashboard.ai.clinicDensityAlert",
        actionLabelKey: "sellerDashboard.action.sendReminder",
        actionPath: "/booking",
        urgency: "warning",
      },
    ],
    profileSections: [
      { id: "credentials", titleKey: "sellerProfile.section.clinicCredentials", sectionType: "doctor_credentials", requiredCapabilities: ["credentials"] },
      { id: "services", titleKey: "sellerProfile.section.specializedTreatments", sectionType: "service_list", requiredCapabilities: ["services"] },
      { id: "booking", titleKey: "sellerProfile.section.onlineAppointmentSlots", sectionType: "booking_slots", requiredCapabilities: ["appointments"] },
      { id: "reviews", titleKey: "sellerProfile.section.patientExperiences", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.clinicAddressHours", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepReception", descriptionKey: "sellerDashboard.workflow.stepReceptionDesc", targetModule: "نوبت‌ها" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepTreatment", descriptionKey: "sellerDashboard.workflow.stepTreatmentDesc", targetModule: "خدمات" },
    ],
  },

  medical_pharmacy: {
    businessType: "medical_pharmacy",
    titleKey: "taxonomy.occupation.pharmacy",
    icon: "💊",
    capabilities: ["products", "inventory", "instant_purchase", "insurance", "orders", "customers", "reviews"],
    primaryCta: { labelKey: "sellerDashboard.action.addProduct", path: "/product-studio", icon: "＋" },
    dashboardKpis: [
      { id: "todaySales", labelKey: "sellerDashboard.kpi.todaySales", value: "۱۶,۳۰۰,۰۰۰ تومان", icon: "💳" },
      { id: "newOrders", labelKey: "sellerDashboard.kpi.newOrders", value: "۴۱ نسخه و سفارش", icon: "📦" },
    ],
    quickActions: [
      { id: "addProduct", labelKey: "sellerDashboard.action.addProduct", path: "/product-studio", icon: "＋", isPrimary: true },
      { id: "manageInventory", labelKey: "sellerDashboard.action.manageInventory", path: "/catalog", icon: "▦" },
    ],
    aiRecommendations: [
      {
        id: "rec_pharmacy_stock",
        titleKey: "sellerDashboard.ai.stockWarningTitle",
        textKey: "sellerDashboard.ai.pharmacyRefillAlert",
        actionLabelKey: "sellerDashboard.action.viewStock",
        actionPath: "/catalog",
        urgency: "warning",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.pharmacyIntro", sectionType: "about", requiredCapabilities: [] },
      { id: "catalog", titleKey: "sellerProfile.section.otcAndCosmetics", sectionType: "catalog_grid", requiredCapabilities: ["products"] },
      { id: "insurance", titleKey: "sellerProfile.section.acceptedInsurances", sectionType: "insurance_partners", requiredCapabilities: ["insurance"] },
      { id: "reviews", titleKey: "sellerProfile.section.buyerReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.pharmacyHoursLocation", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepPrescriptionIntake", descriptionKey: "sellerDashboard.workflow.stepPrescriptionIntakeDesc", targetModule: "محصولات" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepDispense", descriptionKey: "sellerDashboard.workflow.stepDispenseDesc", targetModule: "سفارش‌ها" },
    ],
  },

  food_cafe: {
    businessType: "food_cafe",
    titleKey: "taxonomy.occupation.cafe",
    icon: "☕",
    capabilities: ["menu", "orders", "tables", "reservations", "takeaway", "reviews", "analytics"],
    primaryCta: { labelKey: "sellerDashboard.action.manageOrders", path: "/orders", icon: "☕" },
    dashboardKpis: [
      { id: "todayOrders", labelKey: "sellerDashboard.kpi.todayOrders", value: "۴۶ سفارش", icon: "☕" },
      { id: "todaySales", labelKey: "sellerDashboard.kpi.todaySales", value: "۴,۱۰۰,۰۰۰ تومان", icon: "💳" },
    ],
    quickActions: [
      { id: "manageOrders", labelKey: "sellerDashboard.action.manageOrders", path: "/orders", icon: "☕", isPrimary: true },
      { id: "manageMenu", labelKey: "sellerDashboard.action.manageMenu", path: "/catalog", icon: "📜" },
    ],
    aiRecommendations: [
      {
        id: "rec_cafe_roast",
        titleKey: "sellerDashboard.ai.salesOpportunityTitle",
        textKey: "sellerDashboard.ai.cafeRoastOpportunity",
        actionLabelKey: "sellerDashboard.action.viewMenu",
        actionPath: "/catalog",
        urgency: "opportunity",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.cafeStory", sectionType: "about", requiredCapabilities: [] },
      { id: "menu", titleKey: "sellerProfile.section.beveragesAndBakery", sectionType: "menu_categories", requiredCapabilities: ["menu"] },
      { id: "booking", titleKey: "sellerProfile.section.tableReservation", sectionType: "booking_slots", requiredCapabilities: ["reservations"] },
      { id: "reviews", titleKey: "sellerProfile.section.clientReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.cafeHoursLocation", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepOrderIntake", descriptionKey: "sellerDashboard.workflow.stepOrderIntakeDesc", targetModule: "سفارش‌های امروز" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepServiceTable", descriptionKey: "sellerDashboard.workflow.stepServiceTableDesc", targetModule: "میزها" },
    ],
  },

  service_company: {
    businessType: "service_company",
    titleKey: "taxonomy.occupation.service_company",
    icon: "🏢",
    capabilities: ["services", "workorders", "schedule", "staff", "contracts", "customers", "reviews"],
    primaryCta: { labelKey: "sellerDashboard.action.addService", path: "/catalog", icon: "✦" },
    dashboardKpis: [
      { id: "activeContracts", labelKey: "sellerDashboard.kpi.activeContracts", value: "۱۱ قرارداد", icon: "🏢" },
      { id: "todayWorkorders", labelKey: "sellerDashboard.kpi.openWorkorders", value: "۶ ماموریت", icon: "🔧" },
    ],
    quickActions: [
      { id: "addService", labelKey: "sellerDashboard.action.addService", path: "/catalog", icon: "＋", isPrimary: true },
      { id: "manageStaff", labelKey: "sellerDashboard.action.manageStaff", path: "/business?module=متخصصان", icon: "👥" },
    ],
    aiRecommendations: [
      {
        id: "rec_service_maintenance",
        titleKey: "sellerDashboard.ai.maintenanceScheduleTitle",
        textKey: "sellerDashboard.ai.serviceCompanyContractTip",
        actionLabelKey: "sellerDashboard.action.viewWorkorders",
        actionPath: "/operations",
        urgency: "info",
      },
    ],
    profileSections: [
      { id: "about", titleKey: "sellerProfile.section.companyIntro", sectionType: "about", requiredCapabilities: [] },
      { id: "services", titleKey: "sellerProfile.section.corporateServices", sectionType: "service_list", requiredCapabilities: ["services"] },
      { id: "reviews", titleKey: "sellerProfile.section.clientReviews", sectionType: "reviews_rating", requiredCapabilities: ["reviews"] },
      { id: "location", titleKey: "sellerProfile.section.officeHoursLocation", sectionType: "location_hours", requiredCapabilities: ["locations"] },
    ],
    workflowSteps: [
      { stepNumber: 1, labelKey: "sellerDashboard.workflow.stepServiceRequest", descriptionKey: "sellerDashboard.workflow.stepServiceRequestDesc", targetModule: "خدمات" },
      { stepNumber: 2, labelKey: "sellerDashboard.workflow.stepDispatchStaff", descriptionKey: "sellerDashboard.workflow.stepDispatchStaffDesc", targetModule: "عملیات" },
    ],
  },
};

export function getBusinessTypeSchema(businessType: BusinessType): BusinessTypeSchema {
  return BUSINESS_TYPE_SCHEMAS[businessType] ?? BUSINESS_TYPE_SCHEMAS.retail_general;
}

export function hasBusinessCapability(businessType: BusinessType, capability: BusinessCapability): boolean {
  const schema = getBusinessTypeSchema(businessType);
  return schema.capabilities.includes(capability);
}
