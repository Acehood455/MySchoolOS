import type { FastifyRequest } from "fastify";
import type { AuthContext } from "../auth/auth-context.js";
import type { AuthorizationContext } from "../authorization/authorization-context.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import type { FoundationPermission, RoleAssignmentRecord } from "@myschoolos/shared";

export interface FoundationRequestContext {
  requestId: string;
  correlationId: string;
  tenantId: string | null;
  tenantContext: TenantContext | null;
  actorId: string | null;
  authContext: AuthContext | null;
  authorizationContext: AuthorizationContext | null;
  roleAssignments: readonly RoleAssignmentRecord[];
  sessionToken: string | null;
}

export interface FoundationRouteConfig {
  readonly foundation?: {
    readonly resolveTenant?: boolean;
    readonly authenticate?: boolean;
    readonly permission?: FoundationPermission;
    readonly audit?: {
      readonly eventName: string;
      readonly resourceType: string;
      readonly resourceId?: string;
    };
  };
}

declare module "fastify" {
  interface FastifyRequest {
    foundationContext: FoundationRequestContext | null;
  }

  interface FastifyContextConfig {
    foundation?: FoundationRouteConfig["foundation"];
  }
}

export function requireFoundationContext(
  request: FastifyRequest
): asserts request is FastifyRequest & { foundationContext: FoundationRequestContext } {
  if (!request.foundationContext) {
    throw new Error("Foundation context is required");
  }
}
