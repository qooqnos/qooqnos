import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_WALLET_MARKUP_BPS,
  calculateCustomerChargeMinor,
  calculateTokenCostMinor,
} from "./ai-wallet";

describe("AI wallet pricing", () => {
  it("applies the default 50 percent markup", () => {
    expect(DEFAULT_AI_WALLET_MARKUP_BPS).toBe(5000);
    expect(calculateCustomerChargeMinor(100)).toBe(150);
    expect(calculateCustomerChargeMinor(1)).toBe(2);
  });

  it("calculates token cost per million tokens using integer minor units", () => {
    expect(calculateTokenCostMinor(1_000_000, 20_000, 0, 0)).toBe(20_000);
    expect(calculateTokenCostMinor(0, 0, 1_000_000, 30_000)).toBe(30_000);
    expect(calculateTokenCostMinor(500_000, 20_000, 500_000, 30_000)).toBe(25_000);
  });

  it("rounds provider cost and customer charge upward", () => {
    expect(calculateTokenCostMinor(1, 1, 0, 0)).toBe(1);
    expect(calculateCustomerChargeMinor(1)).toBe(2);
  });

  it("does not expose or depend on a floating point money calculation", () => {
    expect(calculateCustomerChargeMinor(2_000_001)).toBe(3_000_002);
  });
});
