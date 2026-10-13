import { describe, it, expect, beforeEach } from "vitest";
import { accountTierService } from "./account-tier-service";

describe("Account Tier Service & Behaviors (apps/web/src/account-tier-service.ts)", () => {
  beforeEach(() => {
    accountTierService.clearMemoryForTesting();
  });

  it("Level 1: initializes with base account and allows profile & national code editing", () => {
    expect(accountTierService.getAccountTier()).toBe("base");
    expect(accountTierService.getCorporateVerificationStatus()).toBe("none");

    const profile = accountTierService.getProfileData();
    expect(profile.displayName).toBeDefined();

    accountTierService.updateProfileData({
      displayName: "علی رضایی",
      nationalCode: "0081234567",
      mobile: "09121111111",
    });

    const updated = accountTierService.getProfileData();
    expect(updated.displayName).toBe("علی رضایی");
    expect(updated.nationalCode).toBe("0081234567");
    expect(updated.mobile).toBe("09121111111");
  });

  it("Level 1: manages multiple addresses with custom titles and postal codes", () => {
    const initial = accountTierService.getAddresses();
    expect(initial.length).toBeGreaterThanOrEqual(1);

    const newAddr = accountTierService.addAddress({
      title: "انبار مرکزی",
      streetLine1: "تهران، شهرک صنعتی شمس‌آباد، بلوار بوستان",
      postalCode: "1833445566",
      city: "تهران",
      province: "تهران",
      isDefault: false,
    });

    expect(newAddr.id).toBeDefined();
    expect(newAddr.title).toBe("انبار مرکزی");
    expect(accountTierService.getAddresses().some((a) => a.title === "انبار مرکزی")).toBe(true);

    accountTierService.deleteAddress(newAddr.id);
    expect(accountTierService.getAddresses().some((a) => a.id === newAddr.id)).toBe(false);
  });

  it("Level 1 -> Level 2 Upgrade: preserves prior addresses, orders, and wishlist without data loss", () => {
    // Add custom address & wishlist in Level 1
    const customAddr = accountTierService.addAddress({
      title: "ویلای شمال",
      streetLine1: "مازندران، نوشهر، خیابان ساحلی",
      postalCode: "4651122334",
    });
    accountTierService.toggleWishlist("prod-custom-wishlist-item");

    // Create an order in Level 1
    const initialOrder = accountTierService.createOrder({
      buyerId: "usr-me",
      buyerName: "سارا احمدی",
      buyerMobile: "09123456789",
      sellerId: "seller-1",
      sellerName: "فروشگاه نمونه",
      status: "processing",
      currency: "تومان",
      subtotalMinor: 100000,
      discountMinor: 0,
      grandTotalMinor: 100000,
      shippingAddress: customAddr,
      items: [
        {
          productId: "prod-1",
          productTitle: "تست",
          productType: "physical",
          quantity: 1,
          unitPriceMinor: 100000,
          originalUnitPriceMinor: 100000,
          appliedRule: "base",
          lineTotalMinor: 100000,
        },
      ],
    });

    // Elevate to Level 2 (Seller)
    accountTierService.upgradeToSeller();
    expect(accountTierService.getAccountTier()).toBe("seller");

    // Verify all prior data is preserved!
    expect(accountTierService.getAddresses().some((a) => a.id === customAddr.id)).toBe(true);
    expect(accountTierService.getWishlist()).toContain("prod-custom-wishlist-item");
    expect(accountTierService.getBuyerOrders().some((o) => o.id === initialOrder.id)).toBe(true);
  });

  it("Level 2: supports all 4 offering types (physical, digital, service, variable)", () => {
    const products = accountTierService.getStoreProducts();
    const types = products.map((p) => p.type);

    expect(types).toContain("physical");
    expect(types).toContain("digital");
    expect(types).toContain("service");
    expect(types).toContain("variable");

    // Add a new variable product
    const variableProduct = accountTierService.saveProduct({
      sellerId: "seller-me",
      title: "تیشرت سازمانی با سایزبندی",
      description: "تیشرت رسمی پنبه‌ای با طرح اختصاصی",
      type: "variable",
      basePriceMinor: 350000,
      inventory: 50,
      images: ["/sample.jpg"],
      status: "published",
      variableAttributes: [
        { name: "رنگ", options: ["سرمه‌ای", "طوسی"] },
        { name: "سایز", options: ["L", "XL", "XXL"] },
      ],
    });

    expect(variableProduct.id).toBeDefined();
    expect(variableProduct.type).toBe("variable");
    expect(variableProduct.variableAttributes?.length).toBe(2);
  });

  it("Level 2: manages store-scoped buyer groups ('مشتری عادی' / 'مشتری ویژه')", () => {
    const customers = accountTierService.getStoreCustomers();
    expect(customers.length).toBeGreaterThan(0);

    accountTierService.updateStoreCustomerRole("buyer-999", "vip", "خریدار وفادار فروشگاه");
    const updated = accountTierService.getStoreCustomers().find((c) => c.buyerId === "buyer-999");

    expect(updated).toBeDefined();
    expect(updated?.role).toBe("vip");
    expect(updated?.notes).toBe("خریدار وفادار فروشگاه");
  });

  it("Level 2 -> Level 3 Upgrade: requires corporate credentials, enters pending_review, then approved/rejected", () => {
    accountTierService.upgradeToSeller();

    // Invalid upgrade attempt
    const failedAttempt = accountTierService.upgradeToCorporate({
      companyName: "ا",
      registrationNumber: "",
    });
    expect(failedAttempt.success).toBe(false);

    // Valid upgrade
    const success = accountTierService.upgradeToCorporate({
      companyName: "شرکت پیشگامان هوش ققنوس",
      registrationNumber: "889900",
      economicCode: "411233445566",
    });
    expect(success.success).toBe(true);
    expect(accountTierService.getAccountTier()).toBe("corporate_seller");
    expect(accountTierService.getCorporateVerificationStatus()).toBe("pending_review");

    // Rejection simulation with reason
    accountTierService.adminSimulateVerification("rejected", "تصویر روزنامه رسمی ناخوانا است.");
    expect(accountTierService.getCorporateVerificationStatus()).toBe("rejected");
    expect(accountTierService.getCorporateProfile()?.rejectionReason).toBe("تصویر روزنامه رسمی ناخوانا است.");

    // Approval simulation
    accountTierService.adminSimulateVerification("approved");
    expect(accountTierService.getCorporateVerificationStatus()).toBe("approved");
  });

  it("Level 3: pricing engine calculates tiered quantity and role prices accurately", () => {
    // prod-phys-1 has base: 4800000, vip: 4300000, tier_1_agent: 3900000
    // tiered prices: 1-4 qty: 4800000, 5-19 qty: 4200000, 20+ qty: 3800000
    // and for tier_1_agent with 10-50 qty: 3200000

    // Single item, base
    const price1 = accountTierService.computePrice("prod-phys-1", 1);
    expect(price1.originalUnitPriceMinor).toBe(4800000);

    // 10 items, general tier (5-19 qty = 4200000)
    const price10 = accountTierService.computePrice("prod-phys-1", 10);
    expect(price10.originalUnitPriceMinor).toBe(4200000);

    // 2 items for VIP (role price: 4300000)
    const priceVip = accountTierService.computePrice("prod-phys-1", 2, "vip");
    expect(priceVip.originalUnitPriceMinor).toBe(4300000);

    // 15 items for tier_1_agent (role-specific tier: 3200000)
    const priceAgent = accountTierService.computePrice("prod-phys-1", 15, "tier_1_agent");
    expect(priceAgent.originalUnitPriceMinor).toBe(3200000);
  });
});
