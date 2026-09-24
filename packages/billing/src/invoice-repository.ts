import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type BillingInvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export interface BillingInvoiceRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null;
  readonly customerId: EntityId | null;
  readonly orderId: EntityId | null;
  readonly subscriptionId: EntityId | null;
  readonly invoiceNumber: string;
  readonly status: BillingInvoiceStatus;
  readonly currency: string;
  readonly subtotalMinor: number;
  readonly adjustmentTotalMinor: number;
  readonly taxTotalMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly amountDueMinor: number;
  readonly issueDate: string | null;
  readonly dueDate: string | null;
  readonly issuedAt: string | null;
  readonly paidAt: string | null;
  readonly voidedAt: string | null;
  readonly notes: string | null;
  readonly policyVersion: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BillingInvoiceLineRecord {
  readonly id: EntityId;
  readonly invoiceId: EntityId;
  readonly lineNumber: number;
  readonly descriptionSnapshot: string;
  readonly resourceType: string | null;
  readonly resourceId: EntityId | null;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly lineSubtotalMinor: number;
  readonly adjustmentTotalMinor: number;
  readonly taxMinor: number;
  readonly lineTotalMinor: number;
  readonly taxReference: string | null;
  readonly discountReference: string | null;
  readonly metadata: unknown;
}

export class BillingInvoiceRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async createDraft(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly invoiceNumber: string;
      readonly businessId?: EntityId;
      readonly customerId?: EntityId;
      readonly orderId?: EntityId;
      readonly subscriptionId?: EntityId;
      readonly currency: string;
      readonly policyVersion: string;
      readonly idempotencyKey: string;
      readonly correlationId: string;
      readonly notes?: string;
      readonly now: string;
    },
  ): Promise<BillingInvoiceRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    if (!input.invoiceNumber.trim()) throw new DatabaseError("Invoice number is required");
    if (!input.policyVersion.trim()) throw new DatabaseError("Invoice policy version is required");
    if (!input.idempotencyKey.trim()) throw new DatabaseError("Invoice idempotency key is required");
    if (!input.correlationId.trim()) throw new DatabaseError("Invoice correlation id is required");
    const existing = await this.database.first<BillingInvoiceRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, customer_id AS customerId, order_id AS orderId, subscription_id AS subscriptionId, invoice_number AS invoiceNumber, status, currency, subtotal_minor AS subtotalMinor, adjustment_total_minor AS adjustmentTotalMinor, tax_total_minor AS taxTotalMinor, total_minor AS totalMinor, amount_paid_minor AS amountPaidMinor, amount_due_minor AS amountDueMinor, issue_date AS issueDate, due_date AS dueDate, issued_at AS issuedAt, paid_at AS paidAt, voided_at AS voidedAt, notes, policy_version AS policyVersion, idempotency_key AS idempotencyKey, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt FROM billing_invoices WHERE organization_id = ? AND idempotency_key = ? LIMIT 1",
      organizationId, input.idempotencyKey,
    );
    if (existing) {
      if (existing.currency !== normalizeCurrency(input.currency) || existing.totalMinor !== 0) {
        throw new DatabaseError("Invoice idempotency key was reused with different financial input");
      }
      return existing;
    }
    await this.database.run(
      "INSERT INTO billing_invoices (id, organization_id, workspace_id, business_id, customer_id, order_id, subscription_id, invoice_number, status, currency, subtotal_minor, adjustment_total_minor, tax_total_minor, total_minor, amount_paid_minor, amount_due_minor, policy_version, idempotency_key, correlation_id, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?)",
      input.id, organizationId, context.workspaceId ?? null, input.businessId ?? null, input.customerId ?? null,
      input.orderId ?? null, input.subscriptionId ?? null, input.invoiceNumber.trim(), normalizeCurrency(input.currency),
      input.policyVersion.trim(), input.idempotencyKey.trim(), input.correlationId, input.notes?.trim() || null, input.now, input.now,
    );
    const invoice = await this.get(context, input.id);
    if (!invoice) throw new DatabaseError("Invoice not found after creation");
    return invoice;
  }

  async addLine(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly invoiceId: EntityId;
      readonly lineNumber: number;
      readonly descriptionSnapshot: string;
      readonly resourceType?: string;
      readonly resourceId?: EntityId;
      readonly quantity: number;
      readonly unitPriceMinor: number;
      readonly adjustmentTotalMinor?: number;
      readonly taxMinor?: number;
      readonly taxReference?: string;
      readonly discountReference?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
      readonly now: string;
    },
  ): Promise<BillingInvoiceLineRecord> {
    const invoice = await this.get(context, input.invoiceId);
    if (!invoice) throw new DatabaseError("Invoice not found");
    if (invoice.status !== "draft") throw new DatabaseError("Only draft invoices can receive lines");
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new DatabaseError("Invoice quantity must be a positive integer");
    if (!Number.isSafeInteger(input.unitPriceMinor) || input.unitPriceMinor < 0) throw new DatabaseError("Invoice unit price must be a non-negative integer minor-unit value");
    const adjustment = input.adjustmentTotalMinor ?? 0;
    const tax = input.taxMinor ?? 0;
    if (!Number.isSafeInteger(adjustment) || !Number.isSafeInteger(tax)) throw new DatabaseError("Invoice adjustments and tax must be integer minor-unit values");
    const subtotal = input.quantity * input.unitPriceMinor;
    const total = subtotal + adjustment + tax;
    if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(total) || total < 0) throw new DatabaseError("Invoice line total is outside the safe integer range");
    await this.database.transaction([
      {
        sql: "INSERT INTO billing_invoice_lines (id, invoice_id, line_number, description_snapshot, resource_type, resource_id, quantity, unit_price_minor, line_subtotal_minor, adjustment_total_minor, tax_minor, line_total_minor, tax_reference, discount_reference, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [input.id, input.invoiceId, input.lineNumber, input.descriptionSnapshot.trim(), input.resourceType?.trim() || null, input.resourceId ?? null, input.quantity, input.unitPriceMinor, subtotal, adjustment, tax, total, input.taxReference?.trim() || null, input.discountReference?.trim() || null, input.metadata ? JSON.stringify(input.metadata) : null, input.now, input.now],
      },
      {
        sql: "UPDATE billing_invoices SET subtotal_minor = subtotal_minor + ?, adjustment_total_minor = adjustment_total_minor + ?, tax_total_minor = tax_total_minor + ?, total_minor = total_minor + ?, amount_due_minor = amount_due_minor + ?, updated_at = ? WHERE id = ? AND status = 'draft'",
        params: [subtotal, adjustment, tax, total, total, input.now, input.invoiceId],
      },
    ]);
    const line = await this.database.first<BillingInvoiceLineRecord>(
      "SELECT id, invoice_id AS invoiceId, line_number AS lineNumber, description_snapshot AS descriptionSnapshot, resource_type AS resourceType, resource_id AS resourceId, quantity, unit_price_minor AS unitPriceMinor, line_subtotal_minor AS lineSubtotalMinor, adjustment_total_minor AS adjustmentTotalMinor, tax_minor AS taxMinor, line_total_minor AS lineTotalMinor, tax_reference AS taxReference, discount_reference AS discountReference, metadata_json AS metadataJson FROM billing_invoice_lines WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!line) throw new DatabaseError("Invoice line not found after creation");
    return parseLine(line);
  }

  async issue(
    context: RequestContext,
    invoiceId: EntityId,
    input: { readonly issueDate: string; readonly dueDate?: string; readonly now: string },
  ): Promise<BillingInvoiceRecord> {
    const invoice = await this.get(context, invoiceId);
    if (!invoice) throw new DatabaseError("Invoice not found");
    if (invoice.status !== "draft") throw new DatabaseError("Only draft invoices can be issued");
    if (invoice.totalMinor <= 0) throw new DatabaseError("Cannot issue an empty invoice");
    if (input.dueDate && input.dueDate < input.issueDate) throw new DatabaseError("Invoice due date cannot precede issue date");
    await this.database.run(
      "UPDATE billing_invoices SET status = 'issued', issue_date = ?, due_date = ?, issued_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'",
      input.issueDate, input.dueDate ?? null, input.now, input.now, invoiceId,
    );
    const updated = await this.get(context, invoiceId);
    if (!updated) throw new DatabaseError("Invoice not found after issue");
    return updated;
  }

  async recordPayment(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly invoiceId: EntityId;
      readonly paymentReference: string;
      readonly amountMinor: number;
      readonly currency: string;
      readonly appliedAt: string;
      readonly idempotencyKey: string;
      readonly correlationId: string;
      readonly now: string;
    },
  ): Promise<BillingInvoiceRecord> {
    const invoice = await this.get(context, input.invoiceId);
    if (!invoice) throw new DatabaseError("Invoice not found");
    const existingApplication = await this.database.first<{ readonly amountMinor: number; readonly currency: string }>(
      "SELECT amount_minor AS amountMinor, currency FROM billing_invoice_payment_applications WHERE organization_id = ? AND idempotency_key = ? LIMIT 1",
      invoice.organizationId, input.idempotencyKey.trim(),
    );
    if (existingApplication) {
      if (existingApplication.amountMinor !== input.amountMinor || existingApplication.currency !== normalizeCurrency(input.currency)) {
        throw new DatabaseError("Invoice payment idempotency key was reused with different financial input");
      }
      return invoice;
    }
    if (invoice.status === "draft" || invoice.status === "void" || invoice.status === "paid") {
      throw new DatabaseError("Invoice is not payable");
    }
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new DatabaseError("Invoice payment must be a positive integer minor-unit value");
    if (normalizeCurrency(input.currency) !== invoice.currency) throw new DatabaseError("Invoice payment currency does not match invoice currency");
    if (input.amountMinor > invoice.amountDueMinor) throw new DatabaseError("Invoice payment exceeds amount due");
    const newPaid = invoice.amountPaidMinor + input.amountMinor;
    const newDue = invoice.totalMinor - newPaid;
    const nextStatus: BillingInvoiceStatus = newDue === 0 ? "paid" : "partially_paid";
    await this.database.transaction([
      {
        sql: "INSERT INTO billing_invoice_payment_applications (id, invoice_id, organization_id, payment_reference, amount_minor, currency, applied_at, correlation_id, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [input.id, input.invoiceId, invoice.organizationId, input.paymentReference.trim(), input.amountMinor, invoice.currency, input.appliedAt, input.correlationId, input.idempotencyKey.trim(), input.now],
      },
      {
        sql: "UPDATE billing_invoices SET amount_paid_minor = ?, amount_due_minor = ?, status = ?, paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END, updated_at = ? WHERE id = ? AND status IN ('issued','partially_paid','overdue')",
        params: [newPaid, newDue, nextStatus, nextStatus, input.appliedAt, input.now, input.invoiceId],
      },
    ]);
    const updated = await this.get(context, input.invoiceId);
    if (!updated) throw new DatabaseError("Invoice not found after payment");
    return updated;
  }

  async markOverdue(context: RequestContext, invoiceId: EntityId, now: string): Promise<BillingInvoiceRecord> {
    const invoice = await this.get(context, invoiceId);
    if (!invoice) throw new DatabaseError("Invoice not found");
    if (invoice.status === "issued" && invoice.dueDate && invoice.dueDate < now) {
      await this.database.run("UPDATE billing_invoices SET status = 'overdue', updated_at = ? WHERE id = ? AND status = 'issued'", now, invoiceId);
    }
    const updated = await this.get(context, invoiceId);
    if (!updated) throw new DatabaseError("Invoice not found after overdue evaluation");
    return updated;
  }

  async void(context: RequestContext, invoiceId: EntityId, now: string): Promise<BillingInvoiceRecord> {
    const invoice = await this.get(context, invoiceId);
    if (!invoice) throw new DatabaseError("Invoice not found");
    if (invoice.status === "paid" || invoice.status === "void") throw new DatabaseError("Paid or already void invoice cannot be voided");
    if (invoice.amountPaidMinor > 0) throw new DatabaseError("Partially paid invoice requires financial reversal before voiding");
    await this.database.run("UPDATE billing_invoices SET status = 'void', voided_at = ?, updated_at = ? WHERE id = ? AND status IN ('issued','overdue')", now, now, invoiceId);
    const updated = await this.get(context, invoiceId);
    if (!updated) throw new DatabaseError("Invoice not found after void");
    return updated;
  }

  async list(
    context: RequestContext,
    input: { readonly limit?: number; readonly businessId?: EntityId; readonly customerId?: EntityId },
  ): Promise<readonly BillingInvoiceRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const clauses = ["organization_id = ?", "(workspace_id IS NULL OR workspace_id = ?)"];
    const params: Array<string | number | null> = [organizationId, context.workspaceId ?? null];
    if (input.businessId) { clauses.push("business_id = ?"); params.push(input.businessId); }
    if (input.customerId) { clauses.push("customer_id = ?"); params.push(input.customerId); }
    params.push(limit);
    return this.database.all<BillingInvoiceRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, customer_id AS customerId, order_id AS orderId, subscription_id AS subscriptionId, invoice_number AS invoiceNumber, status, currency, subtotal_minor AS subtotalMinor, adjustment_total_minor AS adjustmentTotalMinor, tax_total_minor AS taxTotalMinor, total_minor AS totalMinor, amount_paid_minor AS amountPaidMinor, amount_due_minor AS amountDueMinor, issue_date AS issueDate, due_date AS dueDate, issued_at AS issuedAt, paid_at AS paidAt, voided_at AS voidedAt, notes, policy_version AS policyVersion, idempotency_key AS idempotencyKey, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt FROM billing_invoices WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`,
      ...params,
    );
  }

  async get(context: RequestContext, invoiceId: EntityId): Promise<BillingInvoiceRecord | null> {
    return this.database.first<BillingInvoiceRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, customer_id AS customerId, order_id AS orderId, subscription_id AS subscriptionId, invoice_number AS invoiceNumber, status, currency, subtotal_minor AS subtotalMinor, adjustment_total_minor AS adjustmentTotalMinor, tax_total_minor AS taxTotalMinor, total_minor AS totalMinor, amount_paid_minor AS amountPaidMinor, amount_due_minor AS amountDueMinor, issue_date AS issueDate, due_date AS dueDate, issued_at AS issuedAt, paid_at AS paidAt, voided_at AS voidedAt, notes, policy_version AS policyVersion, idempotency_key AS idempotencyKey, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt FROM billing_invoices WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      invoiceId, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    );
  }

  async listLines(context: RequestContext, invoiceId: EntityId): Promise<readonly BillingInvoiceLineRecord[]> {
    const invoice = await this.get(context, invoiceId);
    if (!invoice) throw new DatabaseError("Invoice not found");
    const rows = await this.database.all<BillingInvoiceLineRecord & { metadataJson: string | null }>(
      "SELECT id, invoice_id AS invoiceId, line_number AS lineNumber, description_snapshot AS descriptionSnapshot, resource_type AS resourceType, resource_id AS resourceId, quantity, unit_price_minor AS unitPriceMinor, line_subtotal_minor AS lineSubtotalMinor, adjustment_total_minor AS adjustmentTotalMinor, tax_minor AS taxMinor, line_total_minor AS lineTotalMinor, tax_reference AS taxReference, discount_reference AS discountReference, metadata_json AS metadataJson FROM billing_invoice_lines WHERE invoice_id = ? ORDER BY line_number ASC",
      invoiceId,
    );
    return rows.map(parseLine);
  }
}

function parseLine(row: BillingInvoiceLineRecord & { readonly metadataJson?: string | null }): BillingInvoiceLineRecord {
  let metadata: unknown = null;
  if (row.metadataJson) {
    try { metadata = JSON.parse(row.metadataJson); } catch { throw new DatabaseError("Stored invoice line metadata is invalid"); }
  }
  return { ...row, metadata };
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new DatabaseError("Billing currency must be a 3-letter ISO currency code");
  return normalized;
}
