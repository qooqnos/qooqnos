import { describe, expect, it } from "vitest";
import {
  deleteAddress,
  getSavedAddresses,
  renderCheckoutPage,
  saveAddress,
} from "./checkout-flow";
import { isValidNationalCode } from "./auth-validation";

describe("Progressive Checkout & Address Management Suite", () => {
  it("renders stepwise checkout page with all 5 progressive stages", () => {
    const html = renderCheckoutPage();
    expect(html).toContain("سبد خرید");
    expect(html).toContain("آدرس و گیرنده");
    expect(html).toContain("روش ارسال");
    expect(html).toContain("اطلاعات هویتی");
    expect(html).toContain("پرداخت و ثبت");
    expect(html).toContain("خلاصه سفارش");
    expect(html).toContain("ضمانت بازگشت وجه ققنوس");
  });

  it("manages saved customer addresses (add, default, delete)", () => {
    const newAddress = {
      id: "addr-test-custom",
      title: "انبار مرکزی",
      receiverName: "مهندس احمدی",
      receiverPhone: "09129876543",
      province: "اصفهان",
      city: "اصفهان",
      streetLine: "میدان نقش جهان، بازار قیصریه",
      plaque: "۱۰",
      postalCode: "8146412345",
      isDefault: true,
    };

    saveAddress(newAddress);
    let addresses = getSavedAddresses();
    const found = addresses.find((a) => a.id === "addr-test-custom");
    expect(found).toBeDefined();
    expect(found?.city).toBe("اصفهان");
    expect(found?.isDefault).toBe(true);

    // Delete
    deleteAddress("addr-test-custom");
    addresses = getSavedAddresses();
    expect(addresses.some((a) => a.id === "addr-test-custom")).toBe(false);
  });

  it("verifies Iranian National ID Modulus 11 validation used during identity checkout step", () => {
    // Valid national ID
    expect(isValidNationalCode("0010332804")).toBe(true);
    // Invalid national ID
    expect(isValidNationalCode("1234567890")).toBe(false);
    expect(isValidNationalCode("0000000000")).toBe(false);
  });
});
