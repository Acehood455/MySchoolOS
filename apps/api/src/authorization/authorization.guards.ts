import { AppError } from "@myschoolos/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthorizationService } from "./authorization.service.js";
import type { FoundationPermission } from "@myschoolos/shared";

export function requireAuthorizationContext(request: FastifyRequest): asserts request is FastifyRequest & {
  authorizationContext: NonNullable<FastifyRequest["authorizationContext"]>;
} {
  if (!request.authorizationContext) {
    throw new AppError("Permission denied", {
      status: 403,
      code: "permission_denied"
    });
  }
}

export function createPermissionGuard(permission: FoundationPermission, authorizationService: AuthorizationService) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.authContext) {
      throw new AppError("Authentication required", {
        status: 401,
        code: "auth_required"
      });
    }

    if (!request.tenantContext) {
      throw new AppError("Tenant context is required", {
        status: 401,
        code: "tenant_context_required"
      });
    }

    const result = await authorizationService.authorize({
      authContext: request.authContext,
      tenantContext: request.tenantContext,
      permission
    });

    request.authorizationContext = result.authorizationContext;
  };
}
