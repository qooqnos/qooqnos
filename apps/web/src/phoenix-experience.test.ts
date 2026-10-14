import { describe, it, expect } from "vitest";
import {
  getActivePersona,
  setActivePersona,
  renderPersonaSwitcher,
  renderSmartAiCard,
  renderUnifiedBottomNav,
  renderIndividualWelcome,
  renderIndividualDashboard,
  renderCreateContentHub,
  renderContentDetailsForm,
  renderDealTypeSelection,
  renderIndividualProfile,
  renderIndividualNotifications,
  renderBusinessWelcome,
  renderBusinessPanel,
  renderBusinessCreateContent,
  renderBusinessContentDetails,
  renderBusinessDeals,
  renderBusinessTeam,
  renderBusinessOrgProfile,
  renderConsumerWelcome,
  renderConsumerHome,
  renderConsumerProductDetails,
  renderConsumerCart,
  renderConsumerPayment,
  renderConsumerMessages,
  renderConsumerLoyalty,
  getCartItems,
  saveCartItems,
  updateCartQuantity,
  removeCartItem,
  getTeamMembers,
  addTeamMember,
  getOrgProfile,
  saveOrgProfile,
} from "./phoenix-experience";

describe("Phoenix Unified Experience (apps/web/src/phoenix-experience.ts)", () => {
  it("manages active persona state correctly", () => {
    setActivePersona("business");
    expect(getActivePersona()).toBe("business");
    setActivePersona("consumer");
    expect(getActivePersona()).toBe("consumer");
    setActivePersona("individual");
    expect(getActivePersona()).toBe("individual");
  });

  it("renders persona switcher with all 3 personas", () => {
    const html = renderPersonaSwitcher("individual");
    expect(html).toContain("حساب من");
    expect(html).toContain("فروشگاه من");
    expect(html).toContain("بازارگاه و خرید");
    expect(html).toContain('data-switch-persona="individual"');
  });

  it("renders role-aware bottom navigation for each persona", () => {
    const indivNav = renderUnifiedBottomNav("individual", "home");
    expect(indivNav).toContain("خانه");
    expect(indivNav).toContain("محتوا");
    expect(indivNav).toContain("معاملات");
    expect(indivNav).toContain("امتیاز");
    expect(indivNav).toContain("پروفایل");

    const bizNav = renderUnifiedBottomNav("business", "home");
    expect(bizNav).toContain("تیم");
    expect(bizNav).toContain("/business/team");

    const consNav = renderUnifiedBottomNav("consumer", "home");
    expect(consNav).toContain("دسته‌ها");
    expect(consNav).toContain("سبد خرید");
  });

  it("renders all Individual (کاربر حقیقی) screens from reference design", () => {
    expect(renderIndividualWelcome()).toContain("من ققنوس هستم دستیار هوشمندت");
    expect(renderIndividualWelcome()).toContain("سلام!");
    expect(renderIndividualDashboard()).toContain("سلام سارا");
    expect(renderIndividualDashboard()).toContain("بگو چی می‌خوای انجام بدی؟");
    expect(renderCreateContentHub()).toContain("چه محتوایی می‌خوای اضافه کنی؟");
    expect(renderCreateContentHub()).toContain("ایده / نظر");
    expect(renderContentDetailsForm()).toContain("جزئیات محتوا");
    expect(renderContentDetailsForm()).toContain("قیمت پیشنهادی");
    expect(renderDealTypeSelection()).toContain("الان می‌خوای با این محتوا چیکار کنی؟");
    expect(renderDealTypeSelection()).toContain("بفروشم");
    expect(renderDealTypeSelection()).toContain("معاوضه کنم");
    expect(renderIndividualProfile()).toContain("حساب من");
    expect(renderIndividualProfile()).toContain("امتیاز: ۲۸۰");
    expect(renderIndividualNotifications()).toContain("اعلان‌ها");
    expect(renderIndividualNotifications()).toContain("یک نفر به محتوای شما علاقمند شد");
  });

  it("renders all Business (فروشگاه من) screens from reference design", () => {
    expect(renderBusinessWelcome()).toContain("من ققنوس هستم دستیار کسب‌وکار شما");
    expect(renderBusinessWelcome()).toContain("سلام!");
    expect(renderBusinessPanel()).toContain("شرکت پارس تجارت");
    expect(renderBusinessPanel()).toContain("آخرین فعالیت‌ها");
    expect(renderBusinessCreateContent()).toContain("ایجاد محتوا");
    expect(renderBusinessCreateContent()).toContain("کاتالوگ");
    expect(renderBusinessContentDetails()).toContain("جزئیات محتوای تجاری");
    expect(renderBusinessDeals()).toContain("درخواست همکاری / معامله");
    expect(renderBusinessDeals()).toContain("خرید عمده");
    expect(renderBusinessTeam()).toContain("تیم و مدیریت تیم");
    expect(renderBusinessTeam()).toContain("مدیر عامل");
    expect(renderBusinessOrgProfile()).toContain("اطلاعات سازمانی");
    expect(renderBusinessOrgProfile()).toContain("شماره ثبت");
  });

  it("renders all Consumer (کاربر نهایی) screens from reference design", () => {
    expect(renderConsumerWelcome()).toContain("به دنیای خرید و فروش خوش اومدی");
    expect(renderConsumerHome()).toContain("هر چی می‌خوای بگو تا ققنوس برات پیداش کنه");
    expect(renderConsumerProductDetails()).toContain("جزئیات محصول");
    expect(renderConsumerProductDetails()).toContain("افزودن به سبد خرید");
    expect(renderConsumerCart()).toContain("سبد خرید");
    expect(renderConsumerCart()).toContain("مجموع تقریبی اقلام محلی");
    expect(renderConsumerCart()).toContain("پیش‌نمایش سبد محلی");
    expect(renderConsumerCart()).toContain("هزینهٔ ارسال پس از بررسی سفارش مشخص می‌شود.");
    expect(renderConsumerPayment()).toContain("پرداخت امن هنوز متصل نشده است.");
    expect(renderConsumerPayment()).toContain("سفارشی ثبت نمی‌شود و مبلغی کسر نخواهد شد.");
    expect(renderConsumerPayment()).toContain("اقلام انتخاب‌شده");
    expect(renderConsumerPayment()).not.toContain("درگاه بانکی");
    expect(renderConsumerPayment()).not.toContain("اعتبار ققنوس");
    expect(renderConsumerPayment()).not.toContain("پرداخت در محل");
    expect(renderConsumerPayment()).not.toContain('id="consumer-payment-form"');
    expect(renderConsumerPayment()).not.toContain("سفارش با موفقیت ثبت و پرداخت شد!");
    expect(renderConsumerMessages()).toContain("پیام‌ها");
    expect(renderConsumerMessages()).toContain("پشتیبانی ققنوس");
    expect(renderConsumerLoyalty()).toContain("امتیاز و رتبه");
    expect(renderConsumerLoyalty()).toContain("۴۰٪");
  });

  it("manages cart items and financial calculations", () => {
    saveCartItems([
      { id: "test-1", title: "کالای آزمایشی", category: "دیجیتال", price: 50000, quantity: 2 },
      { id: "test-2", title: "کالای دوم", category: "فیزیکی", price: 20000, quantity: 1 },
    ]);
    const items = getCartItems();
    expect(items.length).toBe(2);
    expect(items[0]?.quantity).toBe(2);

    updateCartQuantity("test-1", 1);
    expect(getCartItems()[0]?.quantity).toBe(3);

    removeCartItem("test-2");
    expect(getCartItems().length).toBe(1);

    updateCartQuantity("test-1", -3);
    expect(getCartItems().length).toBe(0);

    const smartAi = renderSmartAiCard("پیشنهاد هوشمند", "متن هوش مصنوعی");
    expect(smartAi).toContain("پیشنهاد هوشمند");
    expect(smartAi).toContain("متن هوش مصنوعی");
  });

  it("manages team members and organization profiles", () => {
    const initialMembers = getTeamMembers();
    expect(initialMembers.length).toBeGreaterThanOrEqual(4);

    const updated = addTeamMember({
      name: "مهندس ناصری",
      role: "مدیر توسعه بازار",
      status: "فعال",
      avatarChar: "ن",
    });
    expect(updated.some((m) => m.name === "مهندس ناصری")).toBe(true);

    saveOrgProfile({
      companyName: "هلدینگ ققنوس تجارت",
      regNumber: "998877",
      industry: "فناوری اطلاعات",
      address: "تهران",
      phone: "021-12345678",
    });
    expect(getOrgProfile().companyName).toBe("هلدینگ ققنوس تجارت");
  });
});
