/**
 * Base Service Class
 * Provides common functionality for all domain services
 */

import type { TenantContext } from '../types.js';
import type { Result } from './result.js';

export abstract class DomainService {
  protected abstract validateTenantAccess(
    tenantId: string,
    context: TenantContext
  ): Result<void>;

  protected async ensurePermission(
    context: TenantContext,
    resource: string,
    action: string
  ): Promise<Result<void>> {
    if (context.tenantId !== context.tenantId) {
      return {
        isFailure: true,
        isSuccess: false,
        error: new Error('Tenant mismatch'),
      };
    }

    return { isSuccess: true, isFailure: false, value: undefined };
  }

  protected async logAudit(
    context: TenantContext,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    // Audit logging will be implemented with Logger
    console.log(`[AUDIT] ${action}`, {
      tenantId: context.tenantId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      details,
    });
  }
}
