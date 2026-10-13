import { describe, expect, it } from "vitest";
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
  type AuthSessionUser,
} from "./auth-modal";
import { globalLocaleService } from "./locale-service";

describe("Unified Authentication Modal & Dual-Track Registration Suite", () => {
  it("stores and clears authentication session properly", () => {
    clearAuthSession();
    expect(isUserAuthenticated()).toBe(false);
    expect(getStoredAuth().token).toBeNull();

    const sampleUser: AuthSessionUser = {
      id: "usr-test-1",
      mobile: "09123456789",
      role: "buyer",
      firstName: "سارا",
      lastName: "حسینی",
      displayName: "سارا حسینی",
    };

    saveAuthSession("tok-test-abc", sampleUser);
    expect(isUserAuthenticated()).toBe(true);
    expect(getStoredAuth().token).toBe("tok-test-abc");
    expect(getStoredAuth().user?.displayName).toBe("سارا حسینی");

    clearAuthSession();
    expect(isUserAuthenticated()).toBe(false);
    expect(getStoredAuth().token).toBeNull();
  });

  it("renders initial choice screen with both standard platform and seller tracks with dignity", () => {
    globalLocaleService.setLocale("fa");
    const html = renderChoiceScreen();

    expect(html).toContain("ثبت‌نام در ققنوس");
    expect(html).toContain("ثبت‌نام و استفاده از پلتفرم");
    expect(html).toContain("استفاده کامل از خدمات، جستجو، کشف و خرید هوشمند");
    expect(html).toContain("ثبت‌نام فروشندگان");
    expect(html).toContain("ارائه خدمات، فروش محصولات و مدیریت کسب‌وکار");
    // Verify no patronizing labels exist
    expect(html).not.toContain("کاربر عادی");
    expect(html).not.toContain("سطح پایین‌تر");
    expect(html).toContain("data-select-track=\"buyer\"");
    expect(html).toContain("data-select-track=\"seller\"");
  });

  it("renders Fast Standard Registration flow without redundant fields", () => {
    // 1. Mobile screen
    const mobileHtml = renderMobileScreen(false);
    expect(mobileHtml).toContain("auth-mobile-input");
    expect(mobileHtml).toContain("دریافت کد تأیید");
    expect(mobileHtml).toContain("btn-spinner");
    expect(mobileHtml).toContain("spinner-svg");
    expect(mobileHtml).toContain("btn-text");
    expect(mobileHtml).not.toContain("کد پستی");
    expect(mobileHtml).not.toContain("کد ملی");
    expect(mobileHtml).not.toContain("آدرس");

    // 2. OTP screen
    const otpHtml = renderOtpScreen(false);
    expect(otpHtml).toContain("کد تأیید");
    expect(otpHtml).toContain("otp-digit-0");
    expect(otpHtml).toContain("otp-digit-5");
    expect(otpHtml).toContain("ویرایش شماره");
    expect(otpHtml).toContain("ارسال مجدد");

    // 3. Name completion screen (ONLY First Name + Last Name)
    const nameHtml = renderBuyerNameScreen();
    expect(nameHtml).toContain("auth-first-name");
    expect(nameHtml).toContain("auth-last-name");
    expect(nameHtml).toContain("تکمیل ثبت‌نام");
    // Ensure no redundant checkout fields are present
    expect(nameHtml).not.toContain("کد پستی");
    expect(nameHtml).not.toContain("کد ملی");
    expect(nameHtml).not.toContain("آدرس");
    expect(nameHtml).not.toContain("شهر");
  });

  it("renders Specialized Seller Registration flow with natural/legal entity support", () => {
    const sellerHtml = renderSellerBusinessScreen();
    expect(sellerHtml).toContain("seller-manager-name");
    expect(sellerHtml).toContain("seller-business-name");
    expect(sellerHtml).toContain("فروشگاه مستقل");
    expect(sellerHtml).toContain("شرکت و فروشگاه سازمانی");
    expect(sellerHtml).toContain("seller-legal-fields-container");
    expect(sellerHtml).toContain("seller-natural-fields-container");
    expect(sellerHtml).toContain("seller-national-code");
    expect(sellerHtml).toContain("seller-reg-number");
    expect(sellerHtml).toContain("seller-economic-code");
    expect(sellerHtml).toContain("seller-industry-select");
    expect(sellerHtml).toContain("seller-occupation-select");
    expect(sellerHtml).toContain("seller-subcategory-select");
    expect(sellerHtml).toContain("تکمیل ثبت‌نام و ورود به پنل فروشنده");
    expect(sellerHtml).not.toContain("کاربر عادی");
    expect(sellerHtml).not.toContain("کاربر معمولی");
  });
});
