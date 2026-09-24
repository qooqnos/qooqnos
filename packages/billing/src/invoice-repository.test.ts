import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { BillingInvoiceRepository } from "./invoice-repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "billing",
    operation: "billing.invoice.manage",
    locale: "en",
    timezone: "UTC",
  };
}

function repositoryWithInvoice(status: "draft" | "issued" | "paid" | "overdue", totalMinor = 1500, amountPaidMinor = 0) {
  let preparedQuery = "";
  const statement: D1PreparedStatementLike = {
    bind() { return this; },
    async first<T>() {
      if (preparedQuery.includes("billing_invoice_payment_applications")) return null;
      return {
        id: "invoice-1",
        organizationId: "tenant-1",
        workspaceId: "workspace-1",
        businessId: "business-1",
        customerId: "customer-1",
        orderId: "order-1",
        subscriptionId: null,
        invoiceNumber: "INV-2026-0001",
        status,
        currency: "USD",
        subtotalMinor: totalMinor,
        adjustmentTotalMinor: 0,
        taxTotalMinor: 0,
        totalMinor,
        amountPaidMinor,
        amountDueMinor: totalMinor - amountPaidMinor,
        issueDate: "2026-09-24",
        dueDate: "2026-10-24",
        issuedAt: "2026-09-24T10:00:00.000Z",
        paidAt: status === "paid" ? "2026-09-24T11:00:00.000Z" : null,
        voidedAt: null,
        notes: null,
        policyVersion: "v1",
        idempotencyKey: "invoice-key-1",
        correlationId: "corr-1",
        createdAt: "2026-09-24T10:00:00.000Z",
        updatedAt: "2026-09-24T10:00:00.000Z",
      } as T;
    },
    async all<T>() { return { results: [] as T[] }; },
    async run() { return { success: true, meta: { changes: 1 } }; },
  };
  const raw: D1DatabaseLike = {
    prepare(query: string) { preparedQuery = query; return statement; },
    async batch() { return []; },
  };
  return new BillingInvoiceRepository(new D1Database(raw));
}

describe("BillingInvoiceRepository", () => {
  it("rejects issuing an empty invoice", async () => {
    const repository = repositoryWithInvoice("draft", 0);
    await expect(repository.issue(context(), brandId<"EntityId">("invoice-1"), {
      issueDate: "2026-09-24",
      now: "2026-09-24T10:00:00.000Z",
    })).rejects.toThrow("empty invoice");
  });

  it("rejects payment in the wrong currency", async () => {
    const repository = repositoryWithInvoice("issued", 1500);
    await expect(repository.recordPayment(context(), {
      id: brandId<"EntityId">("application-1"),
      invoiceId: brandId<"EntityId">("invoice-1"),
      paymentReference: "payment-1",
      amountMinor: 500,
      currency: "EUR",
      appliedAt: "2026-09-24T11:00:00.000Z",
      idempotencyKey: "payment-key-1",
      correlationId: "corr-2",
      now: "2026-09-24T11:00:00.000Z",
    })).rejects.toThrow("currency");
  });

  it("does not allow a payment to exceed amount due", async () => {
    const repository = repositoryWithInvoice("issued", 1500, 1000);
    await expect(repository.recordPayment(context(), {
      id: brandId<"EntityId">("application-1"),
      invoiceId: brandId<"EntityId">("invoice-1"),
      paymentReference: "payment-1",
      amountMinor: 501,
      currency: "USD",
      appliedAt: "2026-09-24T11:00:00.000Z",
      idempotencyKey: "payment-key-1",
      correlationId: "corr-2",
      now: "2026-09-24T11:00:00.000Z",
    })).rejects.toThrow("exceeds amount due");
  });

  it("does not allow voiding an invoice after payment has been applied", async () => {
    const repository = repositoryWithInvoice("issued", 1500, 500);
    await expect(repository.void(context(), brandId<"EntityId">("invoice-1"), "2026-09-24T12:00:00.000Z"))
      .rejects.toThrow("financial reversal");
  });
});
