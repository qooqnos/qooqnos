/**
 * Phoenix Business Taxonomy & Classification Engine
 *
 * Provides deterministic mapping:
 * Industry (صنف) → Occupation (رسته) → Subcategory (زیررسته) → BusinessType (نوع کسب‌وکار)
 *
 * All taxonomy metadata is localized through canonical dictionary keys.
 */

export type TradeIndustryKey =
  | "apparel"
  | "health"
  | "food"
  | "digital"
  | "beauty"
  | "automotive_tech"
  | "education"
  | "hospitality"
  | "professional"
  | "retail_general";

export type TradeOccupationKey =
  | "clothing_store"
  | "doctor_office"
  | "specialty_clinic"
  | "pharmacy"
  | "restaurant"
  | "cafe"
  | "digital_store"
  | "beauty_salon"
  | "repair_shop"
  | "service_company"
  | "academy"
  | "hotel"
  | "consulting_office"
  | "specialty_store"
  | "general_store";

export type BusinessType =
  | "retail_clothing"
  | "retail_digital"
  | "retail_general"
  | "retail_specialty"
  | "medical_clinic"
  | "medical_specialty_clinic"
  | "medical_pharmacy"
  | "food_restaurant"
  | "food_cafe"
  | "beauty_salon"
  | "service_repair"
  | "service_company"
  | "education_academy"
  | "hospitality_hotel"
  | "professional_consulting";

export interface SubcategoryDefinition {
  readonly key: string;
  readonly labelKey: string;
  readonly defaultSpecializationKey?: string;
}

export interface OccupationDefinition {
  readonly key: TradeOccupationKey;
  readonly labelKey: string;
  readonly icon: string;
  readonly businessType: BusinessType;
  readonly subcategories: readonly SubcategoryDefinition[];
  readonly specializationSuggestions: readonly string[];
}

export interface IndustryDefinition {
  readonly key: TradeIndustryKey;
  readonly labelKey: string;
  readonly icon: string;
  readonly occupations: readonly OccupationDefinition[];
}

export const BUSINESS_TAXONOMY: readonly IndustryDefinition[] = [
  {
    key: "apparel",
    labelKey: "taxonomy.industry.apparel",
    icon: "👗",
    occupations: [
      {
        key: "clothing_store",
        labelKey: "taxonomy.occupation.clothing_store",
        icon: "👕",
        businessType: "retail_clothing",
        subcategories: [
          { key: "womens_clothing", labelKey: "taxonomy.subcategory.womens_clothing" },
          { key: "mens_clothing", labelKey: "taxonomy.subcategory.mens_clothing" },
          { key: "kids_clothing", labelKey: "taxonomy.subcategory.kids_clothing" },
          { key: "bags_shoes", labelKey: "taxonomy.subcategory.bags_shoes" },
          { key: "sportswear", labelKey: "taxonomy.subcategory.sportswear" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.casual_wear",
          "taxonomy.spec.formal_wear",
          "taxonomy.spec.leather_goods",
          "taxonomy.spec.modest_fashion",
        ],
      },
    ],
  },
  {
    key: "health",
    labelKey: "taxonomy.industry.health",
    icon: "⚕",
    occupations: [
      {
        key: "doctor_office",
        labelKey: "taxonomy.occupation.doctor_office",
        icon: "🩺",
        businessType: "medical_clinic",
        subcategories: [
          { key: "dermatology", labelKey: "taxonomy.subcategory.dermatology" },
          { key: "general_practice", labelKey: "taxonomy.subcategory.general_practice" },
          { key: "dentistry", labelKey: "taxonomy.subcategory.dentistry" },
          { key: "cardiology", labelKey: "taxonomy.subcategory.cardiology" },
          { key: "pediatrics", labelKey: "taxonomy.subcategory.pediatrics" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.skin_hair",
          "taxonomy.spec.orthodontics",
          "taxonomy.spec.cosmetic_dentistry",
          "taxonomy.spec.internal_medicine",
        ],
      },
      {
        key: "specialty_clinic",
        labelKey: "taxonomy.occupation.specialty_clinic",
        icon: "🏥",
        businessType: "medical_specialty_clinic",
        subcategories: [
          { key: "day_surgery", labelKey: "taxonomy.subcategory.day_surgery" },
          { key: "physiotherapy", labelKey: "taxonomy.subcategory.physiotherapy" },
          { key: "imaging_center", labelKey: "taxonomy.subcategory.imaging_center" },
          { key: "lab_diagnostics", labelKey: "taxonomy.subcategory.lab_diagnostics" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.rehabilitation",
          "taxonomy.spec.mri_ultrasound",
          "taxonomy.spec.genetic_tests",
        ],
      },
      {
        key: "pharmacy",
        labelKey: "taxonomy.occupation.pharmacy",
        icon: "💊",
        businessType: "medical_pharmacy",
        subcategories: [
          { key: "retail_pharmacy", labelKey: "taxonomy.subcategory.retail_pharmacy" },
          { key: "compounding_pharmacy", labelKey: "taxonomy.subcategory.compounding_pharmacy" },
          { key: "cosmeceuticals", labelKey: "taxonomy.subcategory.cosmeceuticals" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.specialty_drugs",
          "taxonomy.spec.herbal_supplements",
          "taxonomy.spec.dermocosmetics",
        ],
      },
    ],
  },
  {
    key: "food",
    labelKey: "taxonomy.industry.food",
    icon: "🍽",
    occupations: [
      {
        key: "restaurant",
        labelKey: "taxonomy.occupation.restaurant",
        icon: "🥘",
        businessType: "food_restaurant",
        subcategories: [
          { key: "persian_traditional", labelKey: "taxonomy.subcategory.persian_traditional" },
          { key: "fast_food", labelKey: "taxonomy.subcategory.fast_food" },
          { key: "international", labelKey: "taxonomy.subcategory.international" },
          { key: "buffet_catering", labelKey: "taxonomy.subcategory.buffet_catering" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.kebab_grill",
          "taxonomy.spec.italian_pizza",
          "taxonomy.spec.seafood",
          "taxonomy.spec.healthy_vegan",
        ],
      },
      {
        key: "cafe",
        labelKey: "taxonomy.occupation.cafe",
        icon: "☕",
        businessType: "food_cafe",
        subcategories: [
          { key: "specialty_coffee", labelKey: "taxonomy.subcategory.specialty_coffee" },
          { key: "pastry_bakery", labelKey: "taxonomy.subcategory.pastry_bakery" },
          { key: "board_game_cafe", labelKey: "taxonomy.subcategory.board_game_cafe" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.artisan_roast",
          "taxonomy.spec.french_pastry",
          "taxonomy.spec.cold_brew",
        ],
      },
    ],
  },
  {
    key: "digital",
    labelKey: "taxonomy.industry.digital",
    icon: "📱",
    occupations: [
      {
        key: "digital_store",
        labelKey: "taxonomy.occupation.digital_store",
        icon: "💻",
        businessType: "retail_digital",
        subcategories: [
          { key: "mobile_tablet", labelKey: "taxonomy.subcategory.mobile_tablet" },
          { key: "computers_laptops", labelKey: "taxonomy.subcategory.computers_laptops" },
          { key: "accessories_audio", labelKey: "taxonomy.subcategory.accessories_audio" },
          { key: "smart_home", labelKey: "taxonomy.subcategory.smart_home" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.flagship_phones",
          "taxonomy.spec.gaming_rigs",
          "taxonomy.spec.apple_ecosystem",
        ],
      },
    ],
  },
  {
    key: "beauty",
    labelKey: "taxonomy.industry.beauty",
    icon: "✨",
    occupations: [
      {
        key: "beauty_salon",
        labelKey: "taxonomy.occupation.beauty_salon",
        icon: "💇",
        businessType: "beauty_salon",
        subcategories: [
          { key: "hair_styling", labelKey: "taxonomy.subcategory.hair_styling" },
          { key: "skin_care", labelKey: "taxonomy.subcategory.skin_care" },
          { key: "nail_artist", labelKey: "taxonomy.subcategory.nail_artist" },
          { key: "bridal_makeup", labelKey: "taxonomy.subcategory.bridal_makeup" },
          { key: "barbershop", labelKey: "taxonomy.subcategory.barbershop" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.hair_coloring",
          "taxonomy.spec.microblading",
          "taxonomy.spec.beard_styling",
        ],
      },
    ],
  },
  {
    key: "automotive_tech",
    labelKey: "taxonomy.industry.automotive_tech",
    icon: "🔧",
    occupations: [
      {
        key: "repair_shop",
        labelKey: "taxonomy.occupation.repair_shop",
        icon: "🚗",
        businessType: "service_repair",
        subcategories: [
          { key: "auto_mechanic", labelKey: "taxonomy.subcategory.auto_mechanic" },
          { key: "auto_electric", labelKey: "taxonomy.subcategory.auto_electric" },
          { key: "appliance_repair", labelKey: "taxonomy.subcategory.appliance_repair" },
          { key: "phone_repair", labelKey: "taxonomy.subcategory.phone_repair" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.foreign_cars",
          "taxonomy.spec.ecu_tuning",
          "taxonomy.spec.hvac_repair",
        ],
      },
      {
        key: "service_company",
        labelKey: "taxonomy.occupation.service_company",
        icon: "🏢",
        businessType: "service_company",
        subcategories: [
          { key: "cleaning_facility", labelKey: "taxonomy.subcategory.cleaning_facility" },
          { key: "installation_maintenance", labelKey: "taxonomy.subcategory.installation_maintenance" },
          { key: "logistics_moving", labelKey: "taxonomy.subcategory.logistics_moving" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.industrial_cleaning",
          "taxonomy.spec.elevator_maintenance",
          "taxonomy.spec.safe_freight",
        ],
      },
    ],
  },
  {
    key: "education",
    labelKey: "taxonomy.industry.education",
    icon: "📚",
    occupations: [
      {
        key: "academy",
        labelKey: "taxonomy.occupation.academy",
        icon: "🎓",
        businessType: "education_academy",
        subcategories: [
          { key: "foreign_languages", labelKey: "taxonomy.subcategory.foreign_languages" },
          { key: "software_coding", labelKey: "taxonomy.subcategory.software_coding" },
          { key: "exam_prep", labelKey: "taxonomy.subcategory.exam_prep" },
          { key: "arts_music", labelKey: "taxonomy.subcategory.arts_music" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.ielts_toefl",
          "taxonomy.spec.fullstack_ai",
          "taxonomy.spec.classical_music",
        ],
      },
    ],
  },
  {
    key: "hospitality",
    labelKey: "taxonomy.industry.hospitality",
    icon: "🏨",
    occupations: [
      {
        key: "hotel",
        labelKey: "taxonomy.occupation.hotel",
        icon: "🛎",
        businessType: "hospitality_hotel",
        subcategories: [
          { key: "boutique_hotel", labelKey: "taxonomy.subcategory.boutique_hotel" },
          { key: "traditional_ecolodge", labelKey: "taxonomy.subcategory.traditional_ecolodge" },
          { key: "serviced_apartment", labelKey: "taxonomy.subcategory.serviced_apartment" },
          { key: "resort_complex", labelKey: "taxonomy.subcategory.resort_complex" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.heritage_stay",
          "taxonomy.spec.luxury_suite",
          "taxonomy.spec.eco_tourism",
        ],
      },
    ],
  },
  {
    key: "professional",
    labelKey: "taxonomy.industry.professional",
    icon: "⚖",
    occupations: [
      {
        key: "consulting_office",
        labelKey: "taxonomy.occupation.consulting_office",
        icon: "💼",
        businessType: "professional_consulting",
        subcategories: [
          { key: "legal_advocacy", labelKey: "taxonomy.subcategory.legal_advocacy" },
          { key: "financial_tax", labelKey: "taxonomy.subcategory.financial_tax" },
          { key: "management_growth", labelKey: "taxonomy.subcategory.management_growth" },
          { key: "architecture_design", labelKey: "taxonomy.subcategory.architecture_design" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.corporate_law",
          "taxonomy.spec.audit_taxation",
          "taxonomy.spec.startup_scaling",
        ],
      },
    ],
  },
  {
    key: "retail_general",
    labelKey: "taxonomy.industry.retail_general",
    icon: "🛍",
    occupations: [
      {
        key: "specialty_store",
        labelKey: "taxonomy.occupation.specialty_store",
        icon: "🏷",
        businessType: "retail_specialty",
        subcategories: [
          { key: "handicrafts_souvenirs", labelKey: "taxonomy.subcategory.handicrafts_souvenirs" },
          { key: "perfume_cosmetics", labelKey: "taxonomy.subcategory.perfume_cosmetics" },
          { key: "jewelry_watches", labelKey: "taxonomy.subcategory.jewelry_watches" },
          { key: "stationery_books", labelKey: "taxonomy.subcategory.stationery_books" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.persian_rugs",
          "taxonomy.spec.artisan_jewelry",
          "taxonomy.spec.rare_books",
        ],
      },
      {
        key: "general_store",
        labelKey: "taxonomy.occupation.general_store",
        icon: "🏬",
        businessType: "retail_general",
        subcategories: [
          { key: "supermarket_grocery", labelKey: "taxonomy.subcategory.supermarket_grocery" },
          { key: "home_kitchen", labelKey: "taxonomy.subcategory.home_kitchen" },
          { key: "department_store", labelKey: "taxonomy.subcategory.department_store" },
        ],
        specializationSuggestions: [
          "taxonomy.spec.organic_produce",
          "taxonomy.spec.fast_delivery",
        ],
      },
    ],
  },
];

/**
 * Resolve deterministic BusinessType from Industry, Occupation and Subcategory.
 */
export function resolveBusinessType(
  industryKey?: string | null,
  occupationKey?: string | null,
  subcategoryKey?: string | null,
): BusinessType {
  const normOcc = (occupationKey ?? "").trim().toLowerCase();
  const normInd = (industryKey ?? "").trim().toLowerCase();
  const normSub = (subcategoryKey ?? "").trim().toLowerCase();

  // If a raw BusinessType string is passed directly as first or second argument
  const KNOWN_TYPES: readonly BusinessType[] = [
    "retail_clothing",
    "retail_digital",
    "retail_general",
    "retail_specialty",
    "medical_clinic",
    "medical_specialty_clinic",
    "medical_pharmacy",
    "food_restaurant",
    "food_cafe",
    "beauty_salon",
    "service_repair",
    "service_company",
    "education_academy",
    "hospitality_hotel",
    "professional_consulting",
  ];
  if (KNOWN_TYPES.includes(normInd as BusinessType)) {
    return normInd as BusinessType;
  }
  if (KNOWN_TYPES.includes(normOcc as BusinessType)) {
    return normOcc as BusinessType;
  }

  // Explicit match against taxonomy tree
  for (const industry of BUSINESS_TAXONOMY) {
    if (industry.key === normInd || !normInd) {
      for (const occ of industry.occupations) {
        if (occ.key === normOcc) {
          return occ.businessType;
        }
      }
    }
  }

  // Fallbacks and alias matching
  if (normOcc.includes("cloth") || normOcc.includes("پوشاک") || normSub.includes("clothing")) {
    return "retail_clothing";
  }
  if (normOcc.includes("digital") || normOcc.includes("دیجیتال") || normOcc.includes("موبایل")) {
    return "retail_digital";
  }
  if (normOcc.includes("doctor") || normOcc.includes("clinic") || normOcc.includes("مطب") || normOcc.includes("پزشک")) {
    return "medical_clinic";
  }
  if (normOcc.includes("pharmacy") || normOcc.includes("دارو")) {
    return "medical_pharmacy";
  }
  if (normOcc.includes("restaurant") || normOcc.includes("رستوران") || normOcc.includes("غذا")) {
    return "food_restaurant";
  }
  if (normOcc.includes("cafe") || normOcc.includes("کافه")) {
    return "food_cafe";
  }
  if (normOcc.includes("salon") || normOcc.includes("آرایش") || normOcc.includes("زیبایی")) {
    return "beauty_salon";
  }
  if (normOcc.includes("repair") || normOcc.includes("تعمیر")) {
    return "service_repair";
  }
  if (normOcc.includes("academy") || normOcc.includes("آموزش")) {
    return "education_academy";
  }
  if (normOcc.includes("hotel") || normOcc.includes("هتل") || normOcc.includes("اقامت")) {
    return "hospitality_hotel";
  }
  if (normOcc.includes("consult") || normOcc.includes("مشاور")) {
    return "professional_consulting";
  }
  if (normInd.includes("health")) return "medical_clinic";
  if (normInd.includes("food")) return "food_restaurant";
  if (normInd.includes("beauty")) return "beauty_salon";
  if (normInd.includes("apparel")) return "retail_clothing";

  return "retail_general";
}

/**
 * Map a granular BusinessType to one of the 4 canonical vertical workflow anchors
 * so that existing canonical vertical-workflow registries stay completely compatible.
 */
export function mapBusinessTypeToVerticalAnchor(businessType: BusinessType): "retail" | "clinic" | "restaurant" | "salon" {
  switch (businessType) {
    case "medical_clinic":
    case "medical_specialty_clinic":
    case "medical_pharmacy":
    case "professional_consulting":
      return "clinic";
    case "food_restaurant":
    case "food_cafe":
      return "restaurant";
    case "beauty_salon":
    case "service_company":
    case "education_academy":
    case "hospitality_hotel":
      return "salon";
    case "retail_clothing":
    case "retail_digital":
    case "retail_general":
    case "retail_specialty":
    case "service_repair":
    default:
      return "retail";
  }
}
