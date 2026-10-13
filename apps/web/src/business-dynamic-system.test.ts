import { describe, it, expect } from "vitest";
import {
  BUSINESS_TAXONOMY,
  resolveBusinessType,
  mapBusinessTypeToVerticalAnchor,
  type BusinessType,
} from "./business-taxonomy.js";
import {
  getBusinessTypeSchema,
} from "./business-schema.js";
import {
  renderDynamicBusinessDashboard,
  renderDynamicBusinessProfile,
  renderTaxonomyRegistrationSelector,
} from "./business-dynamic-renderer.js";

describe("Business Taxonomy & Dynamic Registration System", () => {
  it("provides comprehensive industry definitions covering all core sectors", () => {
    expect(BUSINESS_TAXONOMY.length).toBeGreaterThanOrEqual(10);
    const industryKeys = BUSINESS_TAXONOMY.map((ind) => ind.key);
    expect(industryKeys).toContain("apparel");
    expect(industryKeys).toContain("health");
    expect(industryKeys).toContain("food");
    expect(industryKeys).toContain("digital");
    expect(industryKeys).toContain("beauty");
    expect(industryKeys).toContain("automotive_tech");
  });

  it("deterministically resolves BusinessType from industry, occupation and subcategory", () => {
    // Apparel -> Clothing -> Womens Clothing => retail_clothing
    expect(resolveBusinessType("apparel", "clothing_store", "womens_clothing")).toBe("retail_clothing");

    // Health -> Doctor Office -> Dermatology => medical_clinic
    expect(resolveBusinessType("health", "doctor_office", "dermatology")).toBe("medical_clinic");

    // Health -> Specialty Clinic => medical_specialty_clinic
    expect(resolveBusinessType("health", "specialty_clinic")).toBe("medical_specialty_clinic");

    // Food -> Restaurant -> Iranian => food_restaurant
    expect(resolveBusinessType("food", "restaurant", "persian_food")).toBe("food_restaurant");

    // Beauty -> Salon => beauty_salon
    expect(resolveBusinessType("beauty", "beauty_salon")).toBe("beauty_salon");

    // Direct match fallback
    expect(resolveBusinessType("retail_clothing")).toBe("retail_clothing");
    expect(resolveBusinessType("unknown_something")).toBe("retail_general");
  });

  it("maps business types to existing canonical vertical anchors", () => {
    expect(mapBusinessTypeToVerticalAnchor("retail_clothing")).toBe("retail");
    expect(mapBusinessTypeToVerticalAnchor("retail_digital")).toBe("retail");
    expect(mapBusinessTypeToVerticalAnchor("medical_clinic")).toBe("clinic");
    expect(mapBusinessTypeToVerticalAnchor("medical_specialty_clinic")).toBe("clinic");
    expect(mapBusinessTypeToVerticalAnchor("food_restaurant")).toBe("restaurant");
    expect(mapBusinessTypeToVerticalAnchor("beauty_salon")).toBe("salon");
  });

  it("renders taxonomy registration selector HTML", () => {
    const html = renderTaxonomyRegistrationSelector("apparel", "clothing_store", "womens_clothing");
    expect(html).toContain("data-tax-industry");
    expect(html).toContain("data-tax-occupation");
    expect(html).toContain("data-tax-subcategory");
    expect(html).toContain("apparel");
    expect(html).toContain("clothing_store");
  });
});

describe("Business Schema-Driven Configuration", () => {
  const sampleTypes: BusinessType[] = [
    "retail_clothing",
    "medical_clinic",
    "food_restaurant",
    "beauty_salon",
    "service_repair",
  ];

  it("ensures every business type has a valid, distinct schema configuration", () => {
    for (const bType of sampleTypes) {
      const schema = getBusinessTypeSchema(bType);
      expect(schema).toBeDefined();
      expect(schema.businessType).toBe(bType);
      expect(schema.capabilities.length).toBeGreaterThan(0);
      expect(schema.dashboardKpis.length).toBeGreaterThanOrEqual(4);
      expect(schema.quickActions.length).toBeGreaterThanOrEqual(3);
      expect(schema.aiRecommendations.length).toBeGreaterThanOrEqual(1);
      expect(schema.profileSections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("distinguishes clothing retail from medical clinic in capabilities and KPIs", () => {
    const clothingSchema = getBusinessTypeSchema("retail_clothing");
    const clinicSchema = getBusinessTypeSchema("medical_clinic");

    expect(clothingSchema.capabilities).toContain("products");
    expect(clothingSchema.capabilities).toContain("inventory");
    expect(clothingSchema.capabilities).toContain("sizes");
    expect(clothingSchema.capabilities).toContain("colors");

    expect(clinicSchema.capabilities).toContain("appointments");
    expect(clinicSchema.capabilities).toContain("patients");
    expect(clinicSchema.capabilities).toContain("insurance");
    expect(clinicSchema.capabilities).toContain("doctors");

    const clothingKpiIds = clothingSchema.dashboardKpis.map((k) => k.id);
    const clinicKpiIds = clinicSchema.dashboardKpis.map((k) => k.id);

    expect(clothingKpiIds).toContain("todaySales");
    expect(clothingKpiIds).toContain("newOrders");
    expect(clinicKpiIds).toContain("todayAppointments");
    expect(clinicKpiIds).toContain("activePatients");
  });

  it("distinguishes restaurant and salon workflows", () => {
    const restaurantSchema = getBusinessTypeSchema("food_restaurant");
    const salonSchema = getBusinessTypeSchema("beauty_salon");

    expect(restaurantSchema.capabilities).toContain("menu");
    expect(restaurantSchema.capabilities).toContain("tables");
    expect(restaurantSchema.capabilities).toContain("kitchen");

    expect(salonSchema.capabilities).toContain("staff");
    expect(salonSchema.capabilities).toContain("appointments");
  });
});

describe("Dynamic Dashboard & Profile Renderers", () => {
  it("renders specialized dynamic dashboard for retail clothing", () => {
    const html = renderDynamicBusinessDashboard({
      businessType: "retail_clothing",
      businessName: "بوتیک پرنیان",
    });

    expect(html).toContain("dynamic-dash-kpi-grid");
    expect(html).toContain("بوتیک پرنیان");
    expect(html).toContain("dynamic-qa-btn");
    expect(html).toContain("dynamic-ai-card");
    expect(html).toContain("dynamic-cap-item");
  });

  it("renders specialized dynamic dashboard for medical clinic", () => {
    const html = renderDynamicBusinessDashboard({
      businessType: "medical_clinic",
      businessName: "کلینیک تخصصی دکتر روشن",
    });

    expect(html).toContain("کلینیک تخصصی دکتر روشن");
    expect(html).toContain("ds-table");
  });

  it("renders specialized dynamic profile for clothing store", () => {
    const html = renderDynamicBusinessProfile({
      businessType: "retail_clothing",
      businessName: "مزون نیلوفر",
      specialization: "پوشاک زنانه و مجلسی",
      phone: "02188776655",
    });

    expect(html).toContain("phoenix-dynamic-profile");
    expect(html).toContain("مزون نیلوفر");
    expect(html).toContain("02188776655");
    expect(html).toContain("dynamic-products-grid");
  });

  it("renders specialized dynamic profile for medical clinic with appointment booking CTA", () => {
    const html = renderDynamicBusinessProfile({
      businessType: "medical_clinic",
      businessName: "کلینیک جامع پوست و لیزر آناهید",
      specialization: "تخصصی پوست، مو و زیبایی",
    });

    expect(html).toContain("phoenix-dynamic-profile");
    expect(html).toContain("کلینیک جامع پوست و لیزر آناهید");
    expect(html).toContain("رزرو آنلاین نوبت ویزیت");
    expect(html).toContain("dynamic-services-grid");
  });

  it("renders specialized dynamic profile for restaurant with menu and table booking CTA", () => {
    const html = renderDynamicBusinessProfile({
      businessType: "food_restaurant",
      businessName: "رستوران سنتی هما",
      specialization: "غذای اصیل ایرانی و فرنگی",
    });

    expect(html).toContain("phoenix-dynamic-profile");
    expect(html).toContain("رستوران سنتی هما");
    expect(html).toContain("سفارش آنلاین / رزرو میز");
    expect(html).toContain("dynamic-menu-grid");
  });
});
