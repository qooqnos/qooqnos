import { describe, expect, it } from "vitest";
import { brandId } from "@qooqnos/core";
import { createAuthorizationRegistry } from "@qooqnos/runtime";
import { createRequestContext } from "./context";
import { ApiRouter } from "./router";

describe("Unified Authentication & Registration API Suite", () => {
  const router = new ApiRouter({ authorization: createAuthorizationRegistry() });

  it("handles OTP request with normalization, rate limiting, and dev code generation", async () => {
    // 1. Request OTP for valid mobile with Persian digits
    const req1 = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile: "۰۹۱۲۹۹۹۸۸۷۷" }),
    });
    const res1 = await router.handle(req1);
    expect(res1.status).toBe(200);
    const data1 = (await res1.json()) as { data: { success: boolean; mobile: string; devCode: string; expiresInSeconds: number } };
    expect(data1.data.success).toBe(true);
    expect(data1.data.mobile).toBe("09129998877");
    expect(data1.data.devCode).toBeDefined();

    // 2. Reject immediate spam request (rate limiting cooldown)
    const reqSpam = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile: "09129998877" }),
    });
    const resSpam = await router.handle(reqSpam);
    expect(resSpam.status).toBe(422);

    // 3. Reject invalid mobile
    const reqInvalid = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile: "12345" }),
    });
    const resInvalid = await router.handle(reqInvalid);
    expect(resInvalid.status).toBe(400);
  });

  it("verifies OTP and distinguishes between new user and existing user", async () => {
    const mobile = "09351112233";

    // 1. Request code
    const reqOtp = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const resOtp = await router.handle(reqOtp);
    const { data: otpData } = (await resOtp.json()) as { data: { devCode: string } };

    // 2. Fail with wrong code
    const reqWrong = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: "000000" }),
    });
    const resWrong = await router.handle(reqWrong);
    expect(resWrong.status).toBe(400);

    // 3. Succeed with correct code (New User)
    const reqCorrect = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: otpData.devCode }),
    });
    const resCorrect = await router.handle(reqCorrect);
    expect(resCorrect.status).toBe(200);
    const correctData = (await resCorrect.json()) as { data: { isNewUser: boolean; verificationToken: string } };
    expect(correctData.data.isNewUser).toBe(true);
    expect(correctData.data.verificationToken).toBeDefined();

    // 4. Complete Fast Buyer Registration with ONLY First Name + Last Name
    const reqBuyer = new Request("http://localhost/api/v1/auth/register/buyer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mobile,
        verificationToken: correctData.data.verificationToken,
        firstName: "علی",
        lastName: "محمدی",
      }),
    });
    const resBuyer = await router.handle(reqBuyer);
    expect(resBuyer.status).toBe(201);
    const buyerData = (await resBuyer.json()) as { data: { authenticated: boolean; accessToken: string; user: { role: string; displayName: string } } };
    expect(buyerData.data.authenticated).toBe(true);
    expect(buyerData.data.user.displayName).toBe("علی محمدی");
    expect(buyerData.data.user.role).toBe("buyer");
    expect(buyerData.data.accessToken).toBeDefined();
  });

  it("logs in existing user directly upon OTP verification without re-registration", async () => {
    const mobile = "09123334455";

    // 1. Request OTP & Register first time
    const req1 = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const res1 = await router.handle(req1);
    const { data: d1 } = (await res1.json()) as { data: { devCode: string } };

    const reqV1 = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: d1.devCode }),
    });
    const resV1 = await router.handle(reqV1);
    const { data: v1 } = (await resV1.json()) as { data: { isNewUser: boolean; verificationToken: string } };
    expect(v1.isNewUser).toBe(true);

    await router.handle(
      new Request("http://localhost/api/v1/auth/register/buyer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mobile,
          verificationToken: v1.verificationToken,
          firstName: "بهرام",
          lastName: "رادان",
        }),
      }),
    );

    // 2. Next login: Request OTP again
    const req2 = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const res2 = await router.handle(req2);
    const { data: d2 } = (await res2.json()) as { data: { devCode: string; isExistingUser: boolean } };
    expect(d2.isExistingUser).toBe(true);

    // 3. Verify OTP again: logs in directly!
    const reqV2 = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: d2.devCode }),
    });
    const resV2 = await router.handle(reqV2);
    const { data: v2 } = (await resV2.json()) as {
      data: {
        authenticated: boolean;
        isNewUser: boolean;
        user: { displayName: string };
      };
    };
    expect(v2.authenticated).toBe(true);
    expect(v2.isNewUser).toBe(false);
    expect(v2.user.displayName).toBe("بهرام رادان");
  });

  it("handles specialized seller registration with business taxonomy", async () => {
    const mobile = "09127778899";

    // 1. Request OTP
    const reqOtp = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const resOtp = await router.handle(reqOtp);
    const { data: otpData } = (await resOtp.json()) as { data: { devCode: string } };

    // 2. Verify with master code or generated code
    const reqVerify = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: otpData.devCode }),
    });
    const resVerify = await router.handle(reqVerify);
    const { data: verifyData } = (await resVerify.json()) as { data: { verificationToken: string } };

    // 3. Register seller
    const reqSeller = new Request("http://localhost/api/v1/auth/register/seller", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mobile,
        verificationToken: verifyData.verificationToken,
        managerName: "سارا حسینی",
        businessName: "گالری ترنج",
        industry: "apparel",
        occupation: "clothing_store",
        subcategory: "womens_clothing",
      }),
    });
    const resSeller = await router.handle(reqSeller);
    expect(resSeller.status).toBe(201);
    const sellerData = (await resSeller.json()) as { data: { authenticated: boolean; businessType: string; user: { role: string; name: string } } };
    expect(sellerData.data.authenticated).toBe(true);
    expect(sellerData.data.businessType).toBe("retail_clothing");
    expect(sellerData.data.user.role).toBe("seller");
    expect(sellerData.data.user.name).toBe("سارا حسینی");
  });

  it("handles legal entity seller registration and preserves dynamic legal data", async () => {
    const mobile = "09126665544";

    const reqOtp = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const resOtp = await router.handle(reqOtp);
    const { data: otpData } = (await resOtp.json()) as { data: { devCode: string } };

    const reqVerify = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: otpData.devCode }),
    });
    const resVerify = await router.handle(reqVerify);
    const { data: verifyData } = (await resVerify.json()) as { data: { verificationToken: string } };

    const reqSeller = new Request("http://localhost/api/v1/auth/register/seller", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mobile,
        verificationToken: verifyData.verificationToken,
        managerName: "دکتر مریم احمدی",
        businessName: "شرکت تجهیزات پزشکی سلامت",
        industry: "healthcare",
        occupation: "doctor_clinic",
        entityType: "legal",
        registrationNumber: "۱۰۱۰۳۸۴۷۲۱",
        economicCode: "۴۱۱۸۷۲۳۴۹۱",
      }),
    });
    const resSeller = await router.handle(reqSeller);
    expect(resSeller.status).toBe(201);
    const sellerData = (await resSeller.json()) as {
      data: {
        authenticated: boolean;
        business: {
          entityType: string;
          registrationNumber: string;
          economicCode: string;
          verificationStatus: string;
        };
      };
    };
    expect(sellerData.data.authenticated).toBe(true);
    expect(sellerData.data.business.entityType).toBe("legal");
    expect(sellerData.data.business.registrationNumber).toBe("۱۰۱۰۳۸۴۷۲۱");
    expect(sellerData.data.business.economicCode).toBe("۴۱۱۸۷۲۳۴۹۱");
    expect(sellerData.data.business.verificationStatus).toBe("submitted");
  });

  it("allows seamless seller upgrade from standard account without data loss", async () => {
    const mobile = "09301239876";

    // 1. Create standard account
    const reqOtp = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const resOtp = await router.handle(reqOtp);
    const { data: otpData } = (await resOtp.json()) as { data: { devCode: string } };

    const reqVerify = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: otpData.devCode }),
    });
    const resVerify = await router.handle(reqVerify);
    const { data: verifyData } = (await resVerify.json()) as { data: { verificationToken: string } };

    const reqBuyer = new Request("http://localhost/api/v1/auth/register/buyer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mobile,
        verificationToken: verifyData.verificationToken,
        firstName: "مهدی",
        lastName: "نصیری",
      }),
    });
    const resBuyer = await router.handle(reqBuyer);
    const { data: buyerData } = (await resBuyer.json()) as { data: { user: { id: string } } };
    const userId = buyerData.user.id;

    // 2. Perform seller upgrade with natural entity
    const upgradeContext = createRequestContext({
      module: "business",
      operation: "auth.seller.upgrade",
      authenticated: true,
      actorId: userId,
    });
    const upgradeRoute = router.routes.find((r) => r.path === "/api/v1/auth/seller/upgrade" && r.method === "POST");
    expect(upgradeRoute).toBeDefined();

    const reqUpgrade = new Request("http://localhost/api/v1/auth/seller/upgrade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        managerName: "مهدی نصیری",
        businessName: "صنایع دستی کهن",
        industry: "apparel",
        occupation: "clothing_store",
        entityType: "natural",
        nationalCode: "۰۰۱۲۳۴۵۶۷۸",
      }),
    });

    const resUpgrade = await upgradeRoute!.handler({
      request: reqUpgrade,
      context: upgradeContext,
      subject: { authenticated: true, roles: [], permissions: [], actorId: brandId<"EntityId">(userId) },
      params: {},
    });
    expect(resUpgrade.status).toBe(200);
    const upgradeData = (await resUpgrade.json()) as { data: { role: string; profile: { entityType: string; nationalCode: string; displayName: string } } };
    expect(upgradeData.data.role).toBe("seller");
    expect(upgradeData.data.profile.entityType).toBe("natural");
    expect(upgradeData.data.profile.nationalCode).toBe("۰۰۱۲۳۴۵۶۷۸");
    // Verify first & last name preserved
    expect(upgradeData.data.profile.displayName).toBe("مهدی نصیری");

    // 3. Update seller profile to legal entity without losing previous nationalCode
    const updateRoute = router.routes.find((r) => r.path === "/api/v1/auth/seller/profile" && r.method === "PUT");
    expect(updateRoute).toBeDefined();

    const reqUpdate = new Request("http://localhost/api/v1/auth/seller/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "legal",
        companyName: "شرکت توسعه کهن آریا",
        registrationNumber: "۵۴۳۲۱",
      }),
    });

    const resUpdate = await updateRoute!.handler({
      request: reqUpdate,
      context: upgradeContext,
      subject: { authenticated: true, roles: [], permissions: [], actorId: brandId<"EntityId">(userId) },
      params: {},
    });
    expect(resUpdate.status).toBe(200);
    const updateData = (await resUpdate.json()) as { data: { profile: { entityType: string; nationalCode: string; companyName: string } } };
    expect(updateData.data.profile.entityType).toBe("legal");
    expect(updateData.data.profile.companyName).toBe("شرکت توسعه کهن آریا");
    // Previous data safely retained
    expect(updateData.data.profile.nationalCode).toBe("۰۰۱۲۳۴۵۶۷۸");
  });

  it("manages saved customer addresses for checkout", async () => {
    // 1. Setup buyer
    const mobile = "09194445566";
    const reqOtp = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const resOtp = await router.handle(reqOtp);
    const { data: otpData } = (await resOtp.json()) as { data: { devCode: string } };

    const reqVerify = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: otpData.devCode }),
    });
    const resVerify = await router.handle(reqVerify);
    const { data: verifyData } = (await resVerify.json()) as { data: { verificationToken: string } };

    const reqReg = new Request("http://localhost/api/v1/auth/register/buyer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mobile,
        verificationToken: verifyData.verificationToken,
        firstName: "رضا",
        lastName: "کریمی",
      }),
    });
    const resReg = await router.handle(reqReg);
    const { data: regData } = (await resReg.json()) as { data: { user: { id: string } } };

    // 2. Save new address using internal actor context
    const reqAddAddr = new Request("http://localhost/api/v1/auth/addresses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        receiverName: "رضا کریمی",
        receiverPhone: "09194445566",
        province: "تهران",
        city: "تهران",
        streetLine: "خیابان ولیعصر، نرسیده به میدان ونک",
        plaque: "۱۲",
        unit: "۴",
        postalCode: "1969713456",
        isDefault: true,
      }),
    });

    // Mock handler call with typed actorId context
    const initialContext = createRequestContext({
      module: "customer",
      operation: "auth.addresses.create",
      authenticated: true,
      actorId: regData.user.id,
    });
    const route = router.routes.find((r) => r.path === "/api/v1/auth/addresses" && r.method === "POST");
    expect(route).toBeDefined();

    const resAddr = await route!.handler({
      request: reqAddAddr,
      context: initialContext,
      subject: { authenticated: true, roles: [], permissions: [], actorId: brandId<"EntityId">(regData.user.id) },
      params: {},
    });
    expect(resAddr.status).toBe(201);
    const addrData = (await resAddr.json()) as { data: { id: string; streetLine: string; isDefault: boolean } };
    expect(addrData.data.streetLine).toContain("ولیعصر");
    expect(addrData.data.isDefault).toBe(true);
  });

  it("enforces server-side validation on OTP input (must be exactly 6 digits and numeric-only)", async () => {
    const mobile = "09129998877";

    // 1. Request OTP
    const reqOtp = new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    await router.handle(reqOtp);

    // 2. Reject non-numeric input (contains letters or symbols)
    const reqNonNumeric = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: "12a456" }),
    });
    const resNonNumeric = await router.handle(reqNonNumeric);
    expect(resNonNumeric.status).toBe(400);
    const errNonNumeric = (await resNonNumeric.json()) as { error: { message: string; details?: { reason: string } } };
    expect(errNonNumeric.error.message).toContain("فقط شامل اعداد");
    expect(errNonNumeric.error.details?.reason).toBe("numeric_only");

    // 3. Reject too short code (< 6 digits)
    const reqShort = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: "12345" }),
    });
    const resShort = await router.handle(reqShort);
    expect(resShort.status).toBe(400);
    const errShort = (await resShort.json()) as { error: { message: string; details?: { reason: string } } };
    expect(errShort.error.message).toContain("دقیقاً ۶ رقم");
    expect(errShort.error.details?.reason).toBe("exact_length_6");

    // 4. Reject too long code (> 6 digits)
    const reqLong = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: "1234567" }),
    });
    const resLong = await router.handle(reqLong);
    expect(resLong.status).toBe(400);
    const errLong = (await resLong.json()) as { error: { message: string } };
    expect(errLong.error.message).toContain("دقیقاً ۶ رقم");

    // 5. Accept Persian 6-digit numerals (normalized server-side)
    const reqPersian = new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile, code: "۱۲۳۴۵۶" }), // Master test code in Persian
    });
    const resPersian = await router.handle(reqPersian);
    expect(resPersian.status).toBe(200);
    const dataPersian = (await resPersian.json()) as { data: { authenticated?: boolean; isNewUser?: boolean } };
    expect(dataPersian.data.isNewUser).toBe(true);
  });
});
