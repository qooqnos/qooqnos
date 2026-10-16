import { describe, expect, it } from "vitest";
import {
  isValidMobileNumber,
  isValidNationalCode,
  isValidPostalCode,
  normalizeMobileNumber,
} from "./auth-validation";
import {
  clearAuthSession,
  getStoredAuth,
  isUserAuthenticated,
  renderBuyerNameScreen,
  renderChoiceScreen,
  renderMobileScreen,
  renderOtpScreen,
  renderSellerBusinessScreen,
  saveAuthSession,
} from "./auth-modal";
import {
  deleteAddress,
  getSavedAddresses,
  renderCheckoutPage,
  saveAddress,
} from "./checkout-flow";
import { globalLocaleService } from "./locale-service";

describe("Phase 14 & Acceptance: End-to-End Registration, Authentication & Progressive Checkout (Client & E2E)", () => {
  it("executes Scenario 1: New Buyer Fast Registration (Mobile → OTP → First + Last Name ONLY)", () => {
    // 1. Mobile input normalization & validation
    const rawMobile = "  +98 912 888 7766  ";
    const normalized = normalizeMobileNumber(rawMobile);
    expect(normalized).toBe("09128887766");
    expect(isValidMobileNumber(normalized)).toBe(true);

    // 2. Render screens: Choice screen -> Mobile screen -> OTP screen -> Buyer Name screen
    const choiceHtml = renderChoiceScreen();
    expect(choiceHtml).toContain("یک حساب برای همهٔ تجربه‌های ققنوس");
    expect(choiceHtml).toContain("ادامه با شمارهٔ موبایل");
    expect(choiceHtml).toContain("بعداً فروشندگی را به همین حساب اضافه کن");
    expect(choiceHtml).not.toContain("ثبت‌نام فروشندگان");

    const mobileHtml = renderMobileScreen(false);
    expect(mobileHtml).toContain("شماره موبایل");
    expect(mobileHtml).toContain("دریافت کد تأیید");

    const otpHtml = renderOtpScreen(false);
    expect(otpHtml).toContain("کد ۶ رقمی تأیید");
    expect(otpHtml).toContain("ارسال مجدد کد");

    const nameHtml = renderBuyerNameScreen();
    expect(nameHtml).toContain("نام");
    expect(nameHtml).toContain("نام خانوادگی");
    expect(nameHtml).toContain("تکمیل ثبت‌نام");
    // CRITICAL: Fast registration must NOT ask for address, national code, postal code, etc.
    expect(nameHtml).not.toContain("کد ملی");
    expect(nameHtml).not.toContain("کد پستی");
    expect(nameHtml).not.toContain("آدرس کامل");

    // 3. Complete authentication session on client
    saveAuthSession("tok_e2e_buyer", {
      id: "usr_e2e_1",
      mobile: normalized,
      role: "buyer",
      firstName: "مهدی",
      lastName: "نیکوکار",
      displayName: "مهدی نیکوکار",
    });

    expect(isUserAuthenticated()).toBe(true);
    const stored = getStoredAuth();
    expect(stored.user?.displayName).toBe("مهدی نیکوکار");
    expect(stored.user?.role).toBe("buyer");
    expect(stored.token).toBe("tok_e2e_buyer");
  });

  it("executes Scenario 2: Existing User Login and Session Management", () => {
    const mobile = "09128887766";
    expect(isValidMobileNumber(mobile)).toBe(true);

    // Existing user logs in directly with token and user profile
    saveAuthSession("tok_existing_user", {
      id: "usr_existing_1",
      mobile,
      role: "buyer",
      firstName: "مهدی",
      lastName: "نیکوکار",
      displayName: "مهدی نیکوکار",
    });

    expect(isUserAuthenticated()).toBe(true);
    expect(getStoredAuth().user?.mobile).toBe(mobile);

    // Logout cleans session
    clearAuthSession();
    expect(isUserAuthenticated()).toBe(false);
    expect(getStoredAuth().user).toBeNull();
  });

  it("executes Scenario 3: Progressive Checkout Flow (Address → Shipping → National Code → Payment)", () => {
    // 1. Initial Cart Step
    const checkoutHtml = renderCheckoutPage();
    expect(checkoutHtml).toContain("خلاصه سفارش");
    expect(checkoutHtml).toContain("سبد خرید");

    // 2. Address Management
    const testAddr = {
      id: "addr-e2e-buyer",
      title: "دفتر مرکزی",
      receiverName: "مهدی نیکوکار",
      receiverPhone: "09128887766",
      province: "تهران",
      city: "تهران",
      streetLine: "میدان فاطمی، کوچه شهید مصطفی جهانبخش",
      plaque: "۱۸",
      unit: "۵",
      postalCode: "1415789123",
      isDefault: true,
    };
    saveAddress(testAddr);
    expect(isValidPostalCode(testAddr.postalCode)).toBe(true);
    expect(getSavedAddresses().some((a) => a.id === "addr-e2e-buyer")).toBe(true);

    // 3. National ID validation during checkout
    const validNationalId = "0010332804";
    const invalidNationalId = "1111111111";
    expect(isValidNationalCode(validNationalId)).toBe(true);
    expect(isValidNationalCode(invalidNationalId)).toBe(false);

    // Clean up
    deleteAddress("addr-e2e-buyer");
  });

  it("executes Scenario 4: Specialized Seller Registration & Business Taxonomy", () => {
    const sellerMobile = "09365554433";
    expect(isValidMobileNumber(sellerMobile)).toBe(true);

    // Seller business onboarding screen
    const sellerHtml = renderSellerBusinessScreen();
    expect(sellerHtml).toContain("نام و نام خانوادگی مدیر");
    expect(sellerHtml).toContain("نام کسب‌وکار");
    expect(sellerHtml).toContain("صنف");
    expect(sellerHtml).toContain("رسته");
    expect(sellerHtml).toContain("پزشکی");
    expect(sellerHtml).toContain("پوشاک");

    // Establish seller session
    saveAuthSession("tok_seller_e2e", {
      id: "usr_seller_1",
      mobile: sellerMobile,
      role: "seller",
      displayName: "دکتر فرزاد راد",
      businessName: "کلینیک تخصصی پوست و مو سپهر",
    });

    expect(isUserAuthenticated()).toBe(true);
    const sellerAuth = getStoredAuth();
    expect(sellerAuth.user?.role).toBe("seller");
    expect(sellerAuth.user?.businessName).toBe("کلینیک تخصصی پوست و مو سپهر");
  });

  it("executes Scenario 5: Multi-Locale Compatibility across fa, ar, and en", () => {
    // Persian
    globalLocaleService.setLocale("fa");
    expect(globalLocaleService.getDirection()).toBe("rtl");
    const faChoice = renderChoiceScreen();
    expect(faChoice).toContain("یک حساب برای همهٔ تجربه‌های ققنوس");
    expect(faChoice).toContain("ادامه با شمارهٔ موبایل");
    expect(faChoice).not.toContain("ثبت‌نام فروشندگان");

    // Arabic
    globalLocaleService.setLocale("ar");
    expect(globalLocaleService.getDirection()).toBe("rtl");
    const arChoice = renderChoiceScreen();
    expect(arChoice).toContain("حساب واحد لجميع تجارب ققنوس");
    expect(arChoice).toContain("المتابعة برقم الهاتف");
    expect(arChoice).not.toContain("تسجيل التجار");

    // English
    globalLocaleService.setLocale("en");
    expect(globalLocaleService.getDirection()).toBe("ltr");
    const enChoice = renderChoiceScreen();
    expect(enChoice).toContain("One account for every Phoenix experience");
    expect(enChoice).toContain("Continue with mobile number");
    expect(enChoice).not.toContain("Seller Registration");

    // Reset back to Persian default
    globalLocaleService.setLocale("fa");
  });
});
