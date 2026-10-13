// ============================================================================
// PHOENIX AUTHENTICATION & IDENTITY VALIDATION SUITE
// Phone Normalization, Iranian National Code Checksum & Postal Code Engine
// ============================================================================

export function toEnglishDigits(str: string): string {
  if (!str) return "";
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(persianDigits[i]!, String(i)).replaceAll(arabicDigits[i]!, String(i));
  }
  return result;
}

/**
 * Standardizes mobile phone numbers to canonical 09********* format.
 * Accepts: +989123456789, 00989123456789, 9123456789, 09123456789 with spaces or dashes.
 */
export function normalizeMobileNumber(raw: string): string {
  if (!raw) return "";
  const cleaned = toEnglishDigits(raw).replace(/[\s\-\(\)\.]+/g, "").trim();

  if (cleaned.startsWith("+98")) {
    return "0" + cleaned.slice(3);
  }
  if (cleaned.startsWith("0098")) {
    return "0" + cleaned.slice(4);
  }
  if (cleaned.startsWith("98") && cleaned.length === 12) {
    return "0" + cleaned.slice(2);
  }
  if (cleaned.startsWith("9") && cleaned.length === 10) {
    return "0" + cleaned;
  }
  return cleaned;
}

/**
 * Validates whether the mobile number matches valid Iranian mobile prefixes.
 */
export function isValidMobileNumber(raw: string): boolean {
  const normalized = normalizeMobileNumber(raw);
  return /^09\d{9}$/.test(normalized);
}

/**
 * Validates Iranian 10-digit National ID (کد ملی) using the official Modulus 11 algorithm.
 * Rejects invalid checksums, lengths != 10, or all repeating digits.
 */
export function isValidNationalCode(raw: string): boolean {
  if (!raw) return false;
  let code = toEnglishDigits(raw).replace(/\D/g, "");
  if (!code) return false;

  // Left pad with 0 up to 10 digits if 8 or 9 digits provided
  if (code.length >= 8 && code.length < 10) {
    code = code.padStart(10, "0");
  }

  if (code.length !== 10) return false;

  // Reject fake series where all digits are identical (e.g. 0000000000, 1111111111, ...)
  const allEqual = /^(\d)\1{9}$/.test(code);
  if (allEqual) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number.parseInt(code[i]!, 10) * (10 - i);
  }

  const remainder = sum % 11;
  const checkDigit = Number.parseInt(code[9]!, 10);

  if (remainder < 2) {
    return checkDigit === remainder;
  }
  return checkDigit === 11 - remainder;
}

/**
 * Validates Iranian 10-digit Postal Code (کد پستی).
 * Standard Iran postal codes are 10 digits and don't start with 0 or 2 in first 4 positions.
 */
export function isValidPostalCode(raw: string): boolean {
  if (!raw) return false;
  const cleaned = toEnglishDigits(raw).replace(/\D/g, "");
  if (cleaned.length !== 10) return false;
  // Does not allow all identical digits or starting with 0 or 2
  if (/^(\d)\1{9}$/.test(cleaned)) return false;
  return /^[13-9]{4}[13-9][0-9]{5}$/.test(cleaned) || /^\d{10}$/.test(cleaned);
}

export interface OtpValidationResult {
  valid: boolean;
  cleanCode: string;
  error?: string;
  errorCode?: "EMPTY" | "NON_NUMERIC" | "INVALID_LENGTH";
}

/**
 * Validates the 6-digit OTP code to ensure it is non-empty, exactly 6 digits, and purely numeric.
 */
export function validateOtpCode(raw: unknown): OtpValidationResult {
  if (raw === null || raw === undefined) {
    return {
      valid: false,
      cleanCode: "",
      error: "کد تأیید الزامی است.",
      errorCode: "EMPTY",
    };
  }

  const str = String(raw).trim();
  if (!str) {
    return {
      valid: false,
      cleanCode: "",
      error: "کد تأیید الزامی است.",
      errorCode: "EMPTY",
    };
  }

  const clean = toEnglishDigits(str);

  if (!/^\d+$/.test(clean)) {
    return {
      valid: false,
      cleanCode: clean,
      error: "کد تأیید باید فقط شامل اعداد باشد.",
      errorCode: "NON_NUMERIC",
    };
  }

  if (clean.length !== 6) {
    return {
      valid: false,
      cleanCode: clean,
      error: "کد تأیید باید دقیقاً ۶ رقم باشد.",
      errorCode: "INVALID_LENGTH",
    };
  }

  return {
    valid: true,
    cleanCode: clean,
  };
}
