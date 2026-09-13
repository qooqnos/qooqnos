/**
 * Common types for services layer
 */

export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  workspace?: WorkspaceContext;
  traceId?: string;
}

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  tier: 'free' | 'pro' | 'enterprise';
}

export interface ServiceOptions {
  logEnabled?: boolean;
  auditEnabled?: boolean;
  validateTenant?: boolean;
}
