import { describe, expect, it } from "vitest";
import {
  isValidMobileNumber,
  isValidNationalCode,
  isValidPostalCode,
  normalizeMobileNumber,
  toEnglishDigits,
  validateOtpCode,
} from "./auth-validation";

describe("Phoenix Auth & Identity Validation Suite", () => {
  it("normalizes Persian and Arabic digits to English digits", () => {
    expect(toEnglishDigits("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(toEnglishDigits("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
  });

  it("normalizes diverse mobile number formats to 09*********", () => {
    expect(normalizeMobileNumber("+989123456789")).toBe("09123456789");
    expect(normalizeMobileNumber("00989123456789")).toBe("09123456789");
    expect(normalizeMobileNumber("989123456789")).toBe("09123456789");
    expect(normalizeMobileNumber("9123456789")).toBe("09123456789");
    expect(normalizeMobileNumber("0912-345-6789")).toBe("09123456789");
    expect(normalizeMobileNumber("  ۰۹۱۲۳۴۵۶۷۸۹  ")).toBe("09123456789");
  });

  it("validates mobile numbers correctly", () => {
    expect(isValidMobileNumber("09123456789")).toBe(true);
    expect(isValidMobileNumber("+989191234567")).toBe(true);
    expect(isValidMobileNumber("۰۹۳۵۱۲۳۴۵۶۷")).toBe(true);
    expect(isValidMobileNumber("08123456789")).toBe(false); // Invalid prefix
    expect(isValidMobileNumber("09123456")).toBe(false); // Too short
    expect(isValidMobileNumber("0912345678901")).toBe(false); // Too long
    expect(isValidMobileNumber("abc")).toBe(false);
  });

  it("validates Iranian National Code with Modulus 11 algorithm", () => {
    // Valid national IDs
    // 0*10 + 0*9 + 1*8 + 0 + ... = 8; 11 - 8 = 3
    expect(isValidNationalCode("0010000003")).toBe(true);
    // 0010332804: sum = 73; 73 % 11 = 7; 11 - 7 = 4
    expect(isValidNationalCode("0010332804")).toBe(true);
    // Persian digits
    expect(isValidNationalCode("۰۰۱۰۳۳۲۸۰۴")).toBe(true);

    // Reject all identical digits
    expect(isValidNationalCode("1111111111")).toBe(false);
    expect(isValidNationalCode("0000000000")).toBe(false);
    expect(isValidNationalCode("2222222222")).toBe(false);

    // Reject invalid check digit
    expect(isValidNationalCode("0010332809")).toBe(false);
    expect(isValidNationalCode("1234567890")).toBe(false);
    expect(isValidNationalCode("123")).toBe(false);
  });

  it("validates 10-digit postal codes", () => {
    expect(isValidPostalCode("1456789012")).toBe(true);
    expect(isValidPostalCode("۱۴۵۶۷۸۹۰۱۲")).toBe(true);
    expect(isValidPostalCode("12345")).toBe(false); // Too short
    expect(isValidPostalCode("1111111111")).toBe(false); // All equal
    expect(isValidPostalCode("abc1234567")).toBe(false);
  });

  it("validates OTP input to ensure exactly 6 digits and purely numeric", () => {
    // Valid 6-digit numeric codes
    const validEn = validateOtpCode("123456");
    expect(validEn.valid).toBe(true);
    expect(validEn.cleanCode).toBe("123456");

    const validPersian = validateOtpCode("۱۲۳۴۵۶");
    expect(validPersian.valid).toBe(true);
    expect(validPersian.cleanCode).toBe("123456");

    const validArabic = validateOtpCode("١٢٣٤٥٦");
    expect(validArabic.valid).toBe(true);
    expect(validArabic.cleanCode).toBe("123456");

    // Invalid: Non-numeric
    const nonNumeric = validateOtpCode("12a456");
    expect(nonNumeric.valid).toBe(false);
    expect(nonNumeric.errorCode).toBe("NON_NUMERIC");
    expect(nonNumeric.error).toContain("فقط شامل اعداد");

    const nonNumericSpecial = validateOtpCode("12-456");
    expect(nonNumericSpecial.valid).toBe(false);
    expect(nonNumericSpecial.errorCode).toBe("NON_NUMERIC");

    // Invalid: Wrong length
    const tooShort = validateOtpCode("12345");
    expect(tooShort.valid).toBe(false);
    expect(tooShort.errorCode).toBe("INVALID_LENGTH");
    expect(tooShort.error).toContain("دقیقاً ۶ رقم");

    const tooLong = validateOtpCode("1234567");
    expect(tooLong.valid).toBe(false);
    expect(tooLong.errorCode).toBe("INVALID_LENGTH");
    expect(tooLong.error).toContain("دقیقاً ۶ رقم");

    // Invalid: Empty or null
    const empty = validateOtpCode("");
    expect(empty.valid).toBe(false);
    expect(empty.errorCode).toBe("EMPTY");

    const nullVal = validateOtpCode(null);
    expect(nullVal.valid).toBe(false);
    expect(nullVal.errorCode).toBe("EMPTY");
  });
});
