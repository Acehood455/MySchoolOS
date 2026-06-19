import type { FastifyInstance } from "fastify";
import { AppError } from "@myschoolos/shared";
import type { AuthorizationService } from "./authorization.service.js";

export interface AuthorizationMiddlewareOptions {
  readonly authorizationService: AuthorizationService;
}

export async function registerAuthorizationMiddleware(app: FastifyInstance, options: AuthorizationMiddlewareOptions): Promise<void> {
  app.decorateRequest("authorizationContext", null);

  app.addHook("onRequest", async (request) => {
    if (!request.authContext) {
      request.authorizationContext = null;
      return;
    }

    if (!request.tenantContext) {
      throw new AppError("Tenant context is required for authorization", {
        status: 401,
        code: "tenant_context_required"
      });
    }

    const result = await options.authorizationService.resolveAuthorizationContext({
      authContext: request.authContext,
      tenantContext: request.tenantContext
    });

    request.authorizationContext = result;
  });
}
