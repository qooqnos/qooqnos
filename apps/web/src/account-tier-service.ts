/**
 * Account Tier Service for Phoenix Web
 * Implements behaviors for all 3 account tiers:
 * - Level 1 (حساب من): Base account (profile, nationalCode, addresses, orders, invoices, wishlist)
 * - Level 2 (فروشگاه من): Seller activation (store info, 4 offering types, received orders, timed discounts, customer CRM)
 * - Level 3 (فروشگاه شرکتی): Corporate seller activation (verification workflow, 5 buyer roles, role-based & tiered volume pricing)
 * 
 * In accordance with rule 5, visible UI titles use natural terms:
 * "حساب من", "فروشگاه من", "مدیریت فروش", "مدیریت مشتریان", "ارتقای فروشگاه"
 * Never using "کاربر", "حقیقی", or "حقوقی" as user-facing level labels.
 */

import {
  calculateTieredAndRolePrice,
  canAccessSellerFeatures,
  canAccessCorporateFeatures,
  validateNationalCode,
  validateCorporateUpgradeInput,
  type AccountTier,
  type CorporateVerificationStatus,
  type OfferingType,
  type StoreBuyerRole,
  type TieredPriceBracket,
  type TimedDiscount,
  type CustomerAddressItem,
  type CorporateProfile,
  type PricingCalculationResult,
  BUYER_ROLE_LABELS_FA,
} from "@qooqnos/commerce";

export type {
  AccountTier,
  CorporateVerificationStatus,
  OfferingType,
  StoreBuyerRole,
  TieredPriceBracket,
  TimedDiscount,
  CustomerAddressItem,
  CorporateProfile,
  PricingCalculationResult,
};
export { BUYER_ROLE_LABELS_FA, validateNationalCode };

export interface StoreProductItem {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  type: OfferingType;
  basePriceMinor: number;
  inventory: number;
  images: string[];
  status: "draft" | "published" | "disabled";
  // Type-specific attributes
  downloadUrl?: string; // for digital
  serviceDurationMinutes?: number; // for service
  variableAttributes?: { name: string; options: string[] }[]; // for variable
  // Advanced Tier 3 Pricing
  rolePrices?: Record<string, number>;
  tieredPrices?: TieredPriceBracket[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreCustomerRelationship {
  buyerId: string;
  buyerName: string;
  buyerMobile: string;
  sellerId: string;
  role: StoreBuyerRole;
  notes?: string;
  ordersCount: number;
  totalSpentMinor: number;
  lastOrderDate?: string;
}

export interface AccountOrderRecord {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerMobile: string;
  buyerNationalCode?: string;
  sellerId: string;
  sellerName: string;
  status: "processing" | "shipped" | "delivered" | "cancelled" | "returned";
  trackingNumber?: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  grandTotalMinor: number;
  shippingAddress: CustomerAddressItem;
  items: {
    productId: string;
    productTitle: string;
    productType: OfferingType;
    quantity: number;
    unitPriceMinor: number;
    originalUnitPriceMinor: number;
    appliedRule: string;
    lineTotalMinor: number;
  }[];
  invoiceNumber: string;
  createdAt: string;
  estimatedDelivery?: string;
}

const STORAGE_KEYS = {
  tier: "phoenix-account-tier",
  corpVerification: "phoenix-corp-verification-status",
  corpProfile: "phoenix-corp-profile",
  addresses: "phoenix-user-addresses",
  wishlist: "phoenix-user-wishlist",
  orders: "phoenix-orders-records",
  products: "phoenix-store-products",
  storeCustomers: "phoenix-store-customers",
  discounts: "phoenix-store-discounts",
  storeInfo: "phoenix-store-info",
  profile: "phoenix-profile-extended",
};

// Default Initial Addresses
const DEFAULT_ADDRESSES: CustomerAddressItem[] = [
  {
    id: "addr-1",
    title: "خانه",
    streetLine1: "تهران، سعادت‌آباد، خیابان سرو غربی، پلاک ۱۴، واحد ۳",
    postalCode: "1998877665",
    city: "تهران",
    province: "تهران",
    isDefault: true,
  },
  {
    id: "addr-2",
    title: "محل کار",
    streetLine1: "تهران، میدان ونک، خیابان ملاصدرا، برج فناوری ققنوس، طبقه ۵",
    postalCode: "1994433221",
    city: "تهران",
    province: "تهران",
    isDefault: false,
  },
];

// Initial Products Supporting all 4 offering types
const DEFAULT_PRODUCTS: StoreProductItem[] = [
  {
    id: "prod-phys-1",
    sellerId: "seller-me",
    title: "دستگاه هوشمند پوز ققنوس (پایانه فروشگاهی)",
    description: "پایانه فروشگاهی با قابلیت اتصال بی‌سیم به حساب بانکی، پردازش تراکنش و صدور فاکتور رسمی.",
    type: "physical",
    basePriceMinor: 4800000,
    inventory: 35,
    images: ["/phoenix-mark.svg"],
    status: "published",
    rolePrices: {
      vip: 4300000,
      tier_1_agent: 3900000,
      tier_2_agent: 3600000,
      tier_3_agent: 3300000,
    },
    tieredPrices: [
      { minQty: 1, maxQty: 4, priceAmountMinor: 4800000 },
      { minQty: 5, maxQty: 19, priceAmountMinor: 4200000 },
      { minQty: 20, maxQty: null, priceAmountMinor: 3800000 },
      { minQty: 10, maxQty: 50, priceAmountMinor: 3200000, buyerRole: "tier_1_agent" },
    ],
    createdAt: new Date(Date.now() - 604800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prod-digi-1",
    sellerId: "seller-me",
    title: "بسته داده و لایسنس نرم‌افزار هوش تجاری ققنوس",
    description: "فایل دیجیتال نصبی و کلید فعال‌سازی سالانه با تحویل آنی پس از پرداخت.",
    type: "digital",
    basePriceMinor: 2500000,
    inventory: 999,
    downloadUrl: "https://qooqnos.com/downloads/phoenix-bi-suite.zip",
    images: ["/phoenix-mark.svg"],
    status: "published",
    rolePrices: {
      vip: 2200000,
      tier_1_agent: 1800000,
    },
    createdAt: new Date(Date.now() - 504800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prod-svc-1",
    sellerId: "seller-me",
    title: "مشاوره تخصصی بازاریابی و بهینه‌سازی فروشگاه",
    description: "جلسه اختصاصی آنلاین ۹۰ دقیقه‌ای با کارشناس رشد پلتفرم ققنوس.",
    type: "service",
    basePriceMinor: 1500000,
    inventory: 12,
    serviceDurationMinutes: 90,
    images: ["/phoenix-mark.svg"],
    status: "published",
    rolePrices: {
      vip: 1200000,
    },
    createdAt: new Date(Date.now() - 404800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prod-var-1",
    sellerId: "seller-me",
    title: "پک تجهیزات برندینگ سازمانی ققنوس (متغیر)",
    description: "محصول متغیر شامل پیراهن، ماگ و استند با تنوع سایز و رنگ‌بندی سازمانی.",
    type: "variable",
    basePriceMinor: 890000,
    inventory: 80,
    variableAttributes: [
      { name: "رنگ", options: ["مشکی سازمانی", "نارنجی ققنوس", "سفید"] },
      { name: "سایز", options: ["متوسط (M)", "بزرگ (L)", "خیلی بزرگ (XL)"] },
    ],
    images: ["/phoenix-mark.svg"],
    status: "published",
    rolePrices: {
      vip: 790000,
      tier_1_agent: 690000,
    },
    tieredPrices: [
      { minQty: 10, maxQty: null, priceAmountMinor: 650000 },
    ],
    createdAt: new Date(Date.now() - 304800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class AccountTierService {
  private memoryStore = new Map<string, string>();

  clearMemoryForTesting(): void {
    this.memoryStore.clear();
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }
    } catch {
      // ignore
    }
  }

  private getJson<T>(key: string, defaultValue: T): T {
    try {
      if (typeof localStorage !== "undefined") {
        const item = localStorage.getItem(key);
        if (item) return JSON.parse(item) as T;
      }
    } catch {
      // ignore
    }
    const mem = this.memoryStore.get(key);
    if (mem) {
      try {
        return JSON.parse(mem) as T;
      } catch {
        // ignore
      }
    }
    return defaultValue;
  }

  private setJson<T>(key: string, value: T): void {
    const serialized = JSON.stringify(value);
    this.memoryStore.set(key, serialized);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, serialized);
      }
    } catch {
      // ignore
    }
  }

  // Tier management
  getAccountTier(): AccountTier {
    return this.getJson<AccountTier>(STORAGE_KEYS.tier, "base");
  }

  setAccountTier(tier: AccountTier): void {
    this.setJson(STORAGE_KEYS.tier, tier);
  }

  getCorporateVerificationStatus(): CorporateVerificationStatus {
    return this.getJson<CorporateVerificationStatus>(STORAGE_KEYS.corpVerification, "none");
  }

  setCorporateVerificationStatus(status: CorporateVerificationStatus, reason?: string): void {
    this.setJson(STORAGE_KEYS.corpVerification, status);
    if (reason) {
      const profile = this.getCorporateProfile();
      this.setJson(STORAGE_KEYS.corpProfile, { ...profile, rejectionReason: reason });
    }
  }

  getCorporateProfile(): CorporateProfile | null {
    return this.getJson<CorporateProfile | null>(STORAGE_KEYS.corpProfile, null);
  }

  // Profile & National Code
  getProfileData(): {
    displayName: string;
    mobile: string;
    nationalCode: string;
    email?: string;
  } {
    return this.getJson(STORAGE_KEYS.profile, {
      displayName: "سارا احمدی",
      mobile: "09123456789",
      nationalCode: "0012345678",
      email: "sara@example.com",
    });
  }

  updateProfileData(data: Partial<{ displayName: string; mobile: string; nationalCode: string; email?: string }>): void {
    const current = this.getProfileData();
    this.setJson(STORAGE_KEYS.profile, { ...current, ...data });
  }

  // Addresses
  getAddresses(): CustomerAddressItem[] {
    return this.getJson<CustomerAddressItem[]>(STORAGE_KEYS.addresses, DEFAULT_ADDRESSES);
  }

  addAddress(address: Omit<CustomerAddressItem, "id">): CustomerAddressItem {
    const current = this.getAddresses();
    const isDef = current.length === 0 ? true : Boolean(address.isDefault);
    const newAddress: CustomerAddressItem = {
      ...address,
      id: "addr-" + Date.now(),
      isDefault: isDef,
    };
    const mappedCurrent = isDef ? current.map((a) => ({ ...a, isDefault: false })) : current;
    const updated = [newAddress, ...mappedCurrent];
    this.setJson(STORAGE_KEYS.addresses, updated);
    return newAddress;
  }

  deleteAddress(addressId: string): void {
    let current = this.getAddresses().filter((a) => a.id !== addressId);
    if (current.length > 0 && !current.some((a) => a.isDefault)) {
      current = current.map((a, idx) => (idx === 0 ? { ...a, isDefault: true } : a));
    }
    this.setJson(STORAGE_KEYS.addresses, current);
  }

  // Wishlist
  getWishlist(): string[] {
    return this.getJson<string[]>(STORAGE_KEYS.wishlist, ["prod-phys-1", "prod-digi-1"]);
  }

  toggleWishlist(productId: string): boolean {
    const current = this.getWishlist();
    const exists = current.includes(productId);
    const updated = exists ? current.filter((id) => id !== productId) : [...current, productId];
    this.setJson(STORAGE_KEYS.wishlist, updated);
    return !exists;
  }

  // Orders & Invoices (Buyer perspective)
  getBuyerOrders(): AccountOrderRecord[] {
    const sample: AccountOrderRecord[] = [
      {
        id: "PHX-ORD-9421",
        buyerId: "usr-me",
        buyerName: "سارا احمدی",
        buyerMobile: "09123456789",
        buyerNationalCode: "0012345678",
        sellerId: "seller-me",
        sellerName: "فروشگاه مرکزی ققنوس",
        status: "processing",
        trackingNumber: "TRK-98214432-IR",
        currency: "تومان",
        subtotalMinor: 4800000,
        discountMinor: 0,
        grandTotalMinor: 4800000,
        shippingAddress: DEFAULT_ADDRESSES[0]!,
        items: [
          {
            productId: "prod-phys-1",
            productTitle: "دستگاه هوشمند پوز ققنوس",
            productType: "physical",
            quantity: 1,
            unitPriceMinor: 4800000,
            originalUnitPriceMinor: 4800000,
            appliedRule: "قیمت پایه",
            lineTotalMinor: 4800000,
          },
        ],
        invoiceNumber: "INV-1403-9421",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        estimatedDelivery: new Date(Date.now() + 172800000).toISOString(),
      },
      {
        id: "PHX-ORD-8812",
        buyerId: "usr-me",
        buyerName: "سارا احمدی",
        buyerMobile: "09123456789",
        sellerId: "seller-me",
        sellerName: "فروشگاه مرکزی ققنوس",
        status: "delivered",
        trackingNumber: "TRK-77192301-IR",
        currency: "تومان",
        subtotalMinor: 2500000,
        discountMinor: 250000,
        grandTotalMinor: 2250000,
        shippingAddress: DEFAULT_ADDRESSES[0]!,
        items: [
          {
            productId: "prod-digi-1",
            productTitle: "بسته داده و لایسنس نرم‌افزار هوش تجاری ققنوس",
            productType: "digital",
            quantity: 1,
            unitPriceMinor: 2250000,
            originalUnitPriceMinor: 2500000,
            appliedRule: "تخفیف زمان‌دار ۱۰٪",
            lineTotalMinor: 2250000,
          },
        ],
        invoiceNumber: "INV-1403-8812",
        createdAt: new Date(Date.now() - 345600000).toISOString(),
        estimatedDelivery: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
    return this.getJson<AccountOrderRecord[]>(STORAGE_KEYS.orders, sample);
  }

  createOrder(orderData: Omit<AccountOrderRecord, "id" | "invoiceNumber" | "createdAt">): AccountOrderRecord {
    const orders = this.getBuyerOrders();
    const newOrder: AccountOrderRecord = {
      ...orderData,
      id: "PHX-ORD-" + Math.floor(1000 + Math.random() * 9000),
      invoiceNumber: "INV-1403-" + Math.floor(1000 + Math.random() * 9000),
      createdAt: new Date().toISOString(),
    };
    this.setJson(STORAGE_KEYS.orders, [newOrder, ...orders]);
    return newOrder;
  }

  // Store Management (Level 2 & Level 3)
  getStoreInfo(): {
    name: string;
    description: string;
    address: string;
    phone: string;
    sheba: string;
  } {
    return this.getJson(STORAGE_KEYS.storeInfo, {
      name: "فروشگاه مرکزی ققنوس",
      description: "ارائه‌دهنده رسمی تجهیزات، خدمات و بسته‌های ابری هوش تجاری در پلتفرم ققنوس",
      address: "تهران، میدان ونک، برج فناوری ققنوس، واحد ۲۰۴",
      phone: "02188776655",
      sheba: "IR120000000000000000000001",
    });
  }

  updateStoreInfo(data: Partial<ReturnType<typeof this.getStoreInfo>>): void {
    const current = this.getStoreInfo();
    this.setJson(STORAGE_KEYS.storeInfo, { ...current, ...data });
  }

  getStoreProducts(): StoreProductItem[] {
    return this.getJson<StoreProductItem[]>(STORAGE_KEYS.products, DEFAULT_PRODUCTS);
  }

  saveProduct(product: Omit<StoreProductItem, "id" | "createdAt" | "updatedAt"> & { id?: string }): StoreProductItem {
    const products = this.getStoreProducts();
    const now = new Date().toISOString();
    let saved: StoreProductItem;

    if (product.id) {
      saved = {
        ...product,
        id: product.id,
        createdAt: products.find((p) => p.id === product.id)?.createdAt ?? now,
        updatedAt: now,
      } as StoreProductItem;
      const index = products.findIndex((p) => p.id === product.id);
      if (index >= 0) products[index] = saved;
      else products.push(saved);
    } else {
      saved = {
        ...product,
        id: "prod-" + Date.now(),
        createdAt: now,
        updatedAt: now,
      } as StoreProductItem;
      products.unshift(saved);
    }

    this.setJson(STORAGE_KEYS.products, products);
    return saved;
  }

  updateProductStatus(productId: string, status: StoreProductItem["status"]): void {
    const products = this.getStoreProducts();
    const p = products.find((item) => item.id === productId);
    if (p) {
      p.status = status;
      p.updatedAt = new Date().toISOString();
      this.setJson(STORAGE_KEYS.products, products);
    }
  }

  // Store Customer CRM (Store-Scoped)
  getStoreCustomers(): StoreCustomerRelationship[] {
    const sample: StoreCustomerRelationship[] = [
      {
        buyerId: "buyer-101",
        buyerName: "محمدرضا کاظمی",
        buyerMobile: "09121112233",
        sellerId: "seller-me",
        role: "vip",
        notes: "مشتری منظم، پرداخت‌ها سر وقت انجام می‌شود.",
        ordersCount: 4,
        totalSpentMinor: 14500000,
        lastOrderDate: "۱۴۰۳/۰۷/۱۰",
      },
      {
        buyerId: "buyer-102",
        buyerName: "فروشگاه عصر ارتباط",
        buyerMobile: "09359876543",
        sellerId: "seller-me",
        role: "tier_1_agent",
        notes: "نماینده انحصاری توزیع پایانه‌های فروشگاهی در منطقه شرق.",
        ordersCount: 12,
        totalSpentMinor: 48000000,
        lastOrderDate: "۱۴۰۳/۰۷/۱۵",
      },
      {
        buyerId: "buyer-103",
        buyerName: "مهرداد صادقی",
        buyerMobile: "09195556677",
        sellerId: "seller-me",
        role: "regular",
        notes: "ثبت سفارش اول با تخفیف خوش‌آمدگویی.",
        ordersCount: 1,
        totalSpentMinor: 2500000,
        lastOrderDate: "۱۴۰۳/۰۷/۱۸",
      },
    ];
    return this.getJson<StoreCustomerRelationship[]>(STORAGE_KEYS.storeCustomers, sample);
  }

  updateStoreCustomerRole(buyerId: string, role: StoreBuyerRole, notes?: string): void {
    const customers = this.getStoreCustomers();
    const cust = customers.find((c) => c.buyerId === buyerId);
    if (cust) {
      cust.role = role;
      if (notes !== undefined) cust.notes = notes;
    } else {
      const newCustomer: StoreCustomerRelationship = {
        buyerId,
        buyerName: "خریدار جدید",
        buyerMobile: "09120000000",
        sellerId: "seller-me",
        role,
        ordersCount: 1,
        totalSpentMinor: 0,
      };
      if (notes !== undefined) {
        newCustomer.notes = notes;
      }
      customers.push(newCustomer);
    }
    this.setJson(STORAGE_KEYS.storeCustomers, customers);
  }

  // Store Timed Discounts
  getStoreDiscounts(): TimedDiscount[] {
    const sample: TimedDiscount[] = [
      {
        id: "disc-fall-20",
        sellerId: "seller-me",
        productIds: ["prod-phys-1", "prod-digi-1"],
        discountType: "percentage",
        value: 15,
        startDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 15).toISOString(),
        maxUses: 200,
        usedCount: 28,
        minOrderAmount: 2000000,
      },
    ];
    return this.getJson<TimedDiscount[]>(STORAGE_KEYS.discounts, sample);
  }

  saveDiscount(discount: Omit<TimedDiscount, "id" | "usedCount"> & { id?: string }): TimedDiscount {
    const discounts = this.getStoreDiscounts();
    const newDisc: TimedDiscount = {
      ...discount,
      id: discount.id || "disc-" + Date.now(),
      usedCount: 0,
    };
    this.setJson(STORAGE_KEYS.discounts, [newDisc, ...discounts]);
    return newDisc;
  }

  // Tier Upgrade Flows (All preserving prior data)
  upgradeToSeller(): void {
    this.setAccountTier("seller");
  }

  upgradeToCorporate(profile: CorporateProfile): { success: boolean; errors: string[] } {
    const check = validateCorporateUpgradeInput(profile);
    if (!check.valid) return { success: false, errors: check.errors };

    this.setJson(STORAGE_KEYS.corpProfile, profile);
    this.setAccountTier("corporate_seller");
    this.setCorporateVerificationStatus("pending_review");
    return { success: true, errors: [] };
  }

  adminSimulateVerification(status: "approved" | "rejected", reason?: string): void {
    this.setCorporateVerificationStatus(status, reason);
  }

  // Price Calculation Engine Helper
  computePrice(productId: string, quantity: number, buyerRole?: StoreBuyerRole): PricingCalculationResult {
    const product = this.getStoreProducts().find((p) => p.id === productId);
    if (!product) {
      return {
        unitPriceMinor: 0,
        originalUnitPriceMinor: 0,
        discountMinorPerUnit: 0,
        pricingRuleApplied: "base",
        lineTotalMinor: 0,
      };
    }

    const discounts = this.getStoreDiscounts();

    return calculateTieredAndRolePrice({
      basePriceMinor: product.basePriceMinor,
      quantity,
      buyerRole,
      rolePrices: product.rolePrices,
      tieredPrices: product.tieredPrices,
      discounts,
      productId,
    });
  }
}

export const accountTierService = new AccountTierService();
