import type { FastifyInstance } from "fastify";
import { AppError } from "@myschoolos/shared";
import { AuthService } from "./auth.service.js";
import type { AuthContext } from "./auth-context.js";
import { parseCookieHeader } from "./session.service.js";

export interface AuthMiddlewareOptions {
  readonly authService: AuthService;
  readonly cookieName: string;
}

export async function registerAuthMiddleware(app: FastifyInstance, options: AuthMiddlewareOptions): Promise<void> {
  app.decorateRequest("authContext", null);

  app.addHook("onRequest", async (request) => {
    const cookies = parseCookieHeader(request.headers.cookie);
    const sessionToken = cookies[options.cookieName];

    if (!sessionToken) {
      request.authContext = null;
      return;
    }

    const tenantContext = request.tenantContext;

    if (!tenantContext) {
      throw new AppError("Tenant context is required for authentication", {
        status: 401,
        code: "tenant_context_required"
      });
    }

    const validated = await options.authService.validateSession({
      tenantContext,
      sessionToken
    });

    request.authContext = validated.authContext;
  });
}

export function requireAuthContext(authContext: AuthContext | null): asserts authContext is AuthContext {
  if (!authContext) {
    throw new Error("Authentication is required");
  }
}
