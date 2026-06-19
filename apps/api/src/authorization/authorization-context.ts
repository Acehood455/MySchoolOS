import type { FastifyRequest } from "fastify";
import type { AuthSessionContext, FoundationPermission, RoleAssignmentRecord } from "@myschoolos/shared";
import type { AuthContext } from "../auth/auth-context.js";
import type { TenantContext } from "../tenant/tenant-context.js";

export interface AuthorizationContext {
  readonly userId: string;
  readonly schoolId: string;
  readonly roles: readonly RoleAssignmentRecord["canonicalRole"][];
  readonly roleAssignments: readonly RoleAssignmentRecord[];
  readonly invalidRoleAssignments: readonly RoleAssignmentRecord[];
}

export interface AuthorizationAuditEvent {
  readonly eventName: "permission.denied";
  readonly schoolId: string;
  readonly userId?: string;
  readonly sessionId?: AuthSessionContext["sessionId"];
  readonly permission: FoundationPermission;
  readonly reason: "tenant_mismatch" | "no_role_assignment" | "invalid_role_assignment" | "forbidden";
  readonly roles?: readonly RoleAssignmentRecord["canonicalRole"][];
  readonly details?: Record<string, unknown>;
}

export interface AuthorizationAuditSink {
  record(event: AuthorizationAuditEvent): Promise<void> | void;
}

export interface AuthorizationRepository {
  findRoleAssignments(userId: string, schoolId: string): Promise<readonly RoleAssignmentRecord[]>;
}

export interface AuthorizationServiceOptions {
  readonly repository: AuthorizationRepository;
  readonly auditSink?: AuthorizationAuditSink;
  readonly clock?: () => Date;
}

export interface ResolveAuthorizationInput {
  readonly authContext: AuthContext;
  readonly tenantContext: TenantContext;
}

export interface ResolveAuthorizationResult {
  readonly authorizationContext: AuthorizationContext;
}

export interface AuthorizeInput extends ResolveAuthorizationInput {
  readonly permission: FoundationPermission;
}

export interface AuthorizeResult extends ResolveAuthorizationResult {
  readonly permitted: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    authorizationContext: AuthorizationContext | null;
  }
}

export function hasAuthorizationContext(
  request: FastifyRequest
): request is FastifyRequest & { authorizationContext: AuthorizationContext } {
  return request.authorizationContext !== null;
}
