import { describe, expect, it } from "vitest";
import {
  ORDER_STATE_METADATA,
  ORDER_TRANSITION_RULES,
  buildOrderTimeline,
  canTransition,
  getAllowedTransitions,
  resolveOrderNextAction,
  type OrderLifecycleState,
} from "./order-state-machine";

describe("Phase 4: Order State Machine & Timeline", () => {
  it("defines comprehensive metadata for all standard and exceptional lifecycle states", () => {
    const states: OrderLifecycleState[] = [
      "draft",
      "pending_payment",
      "paid",
      "waiting_seller",
      "confirmed",
      "preparing",
      "packed",
      "ready_to_ship",
      "handed_to_carrier",
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "rejected",
      "payment_failed",
      "delayed",
      "return_requested",
      "returned",
      "refund_pending",
      "refunded",
      "delivery_failed",
      "order_issue",
    ];

    for (const state of states) {
      const meta = ORDER_STATE_METADATA[state];
      expect(meta).toBeDefined();
      expect(meta.labels.fa).toBeTruthy();
      expect(meta.labels.ar).toBeTruthy();
      expect(meta.labels.en).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.badgeTone).toBeTruthy();
    }
  });

  it("enforces valid actor transitions across lifecycle states", () => {
    expect(ORDER_TRANSITION_RULES.length).toBeGreaterThan(10);
    // Buyer can transition draft -> pending_payment
    expect(canTransition("draft", "pending_payment", "buyer")).toBe(true);

    // System transitions pending_payment -> paid
    expect(canTransition("pending_payment", "paid", "system")).toBe(true);
    expect(canTransition("pending_payment", "paid", "buyer")).toBe(false);

    // Seller confirms
    expect(canTransition("waiting_seller", "confirmed", "seller")).toBe(true);
    expect(canTransition("waiting_seller", "rejected", "seller")).toBe(true);

    // Fulfillment progression
    expect(canTransition("confirmed", "preparing", "seller")).toBe(true);
    expect(canTransition("preparing", "packed", "seller")).toBe(true);
    expect(canTransition("packed", "ready_to_ship", "seller")).toBe(true);
    expect(canTransition("ready_to_ship", "handed_to_carrier", "carrier")).toBe(true);
    expect(canTransition("handed_to_carrier", "shipped", "carrier")).toBe(true);
    expect(canTransition("shipped", "in_transit", "carrier")).toBe(true);
    expect(canTransition("in_transit", "out_for_delivery", "carrier")).toBe(true);
    expect(canTransition("out_for_delivery", "delivered", "carrier")).toBe(true);

    // Invalid transition
    expect(canTransition("draft", "delivered", "buyer")).toBe(false);
  });

  it("lists allowed transitions for an actor", () => {
    const buyerActions = getAllowedTransitions("pending_payment", "buyer");
    expect(buyerActions).toContain("cancelled");

    const sellerActions = getAllowedTransitions("waiting_seller", "seller");
    expect(sellerActions).toContain("confirmed");
    expect(sellerActions).toContain("rejected");
  });

  it("constructs visual and structured timeline steps for all 3 locales", () => {
    const faTimeline = buildOrderTimeline("in_transit", "fa");
    expect(faTimeline.length).toBe(6);
    expect(faTimeline[0]!.status).toBe("completed");
    expect(faTimeline[4]!.status).toBe("current");
    expect(faTimeline[5]!.status).toBe("upcoming");

    const arTimeline = buildOrderTimeline("delivered", "ar");
    expect(arTimeline.every((step) => step.status === "completed")).toBe(true);

    const enTimeline = buildOrderTimeline("preparing", "en");
    expect(enTimeline.find((s) => s.status === "current")?.label).toBe("Preparing & Packing");
  });

  it("handles exceptional timeline flow properly", () => {
    const cancelledTimeline = buildOrderTimeline("cancelled", "fa", [
      { state: "draft", at: "2026-10-05T10:00:00Z" },
      { state: "cancelled", at: "2026-10-05T10:05:00Z" },
    ]);
    expect(cancelledTimeline.length).toBe(2);
    expect(cancelledTimeline[1]!.status).toBe("exception");
    expect(cancelledTimeline[1]!.label).toBe("لغو شده");
  });

  it("resolves next best actions for buyer and seller", () => {
    const payAction = resolveOrderNextAction("pending_payment", "buyer", "fa", "ord-123");
    expect(payAction?.actionId).toBe("retry_payment");
    expect(payAction?.tone).toBe("primary");

    const trackAction = resolveOrderNextAction("out_for_delivery", "buyer", "fa", "ord-123");
    expect(payAction?.actionId).toBe("retry_payment");
    expect(trackAction?.actionId).toBe("track_live");

    const sellerAccept = resolveOrderNextAction("waiting_seller", "seller", "en", "ord-123");
    expect(sellerAccept?.actionId).toBe("confirm_order");
    expect(sellerAccept?.title).toBe("Accept & Confirm Order");
  });
});
