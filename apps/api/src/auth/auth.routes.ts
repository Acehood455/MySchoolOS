import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@myschoolos/shared";
import type { AuthService } from "./auth.service.js";
import {
  loginRequestSchema,
  logoutRequestSchema,
  parseAuthBody,
  passwordResetCompleteSchema,
  passwordResetRequestSchema
} from "./auth.schemas.js";

export interface AuthRouteOptions {
  readonly authService: AuthService;
  readonly cookieName: string;
}

function getTenantContext(request: FastifyRequest) {
  if (!request.tenantContext) {
    throw new AppError("Tenant context is required", {
      status: 401,
      code: "tenant_context_required"
    });
  }

  return request.tenantContext;
}

function getSessionToken(request: FastifyRequest, cookieName: string): string | null {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const token = cookieHeader.split(";").reduce<string | null>((current, part) => {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      return current;
    }

    const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
    const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());

    return key === cookieName ? value : current;
  }, null);

  return token;
}

function setAuthCookie(reply: FastifyReply, cookie: string): void {
  reply.header("Set-Cookie", cookie);
}

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const tenantContext = getTenantContext(request);
    const body = parseAuthBody(loginRequestSchema, request.body, "auth_login_invalid");
    const result = await options.authService.login({
      tenantContext,
      loginIdentifier: body.loginIdentifier,
      password: body.password
    });

    setAuthCookie(reply, result.setCookie);

    return {
      authContext: result.authContext
    };
  });

  app.get("/auth/session", async (request) => {
    const tenantContext = getTenantContext(request);
    const sessionToken = getSessionToken(request, options.cookieName);

    if (!sessionToken) {
      throw new AppError("Authentication required", {
        status: 401,
        code: "auth_session_missing"
      });
    }

    const result = await options.authService.validateSession({
      tenantContext,
      sessionToken
    });

    return {
      authenticated: true,
      authContext: result.authContext
    };
  });

  app.post("/auth/logout", async (request, reply) => {
    const tenantContext = getTenantContext(request);
    const body = parseAuthBody(logoutRequestSchema, request.body ?? {}, "auth_logout_invalid");
    const sessionToken = getSessionToken(request, options.cookieName) ?? "";
    const result = await options.authService.logout({
      tenantContext,
      sessionToken,
      reason: body.reason
    });

    setAuthCookie(reply, result.clearCookie);

    return {
      revoked: result.revoked
    };
  });

  app.post("/auth/password-reset/request", async (request) => {
    const tenantContext = getTenantContext(request);
    const body = parseAuthBody(passwordResetRequestSchema, request.body, "auth_password_reset_request_invalid");
    const result = await options.authService.requestPasswordReset({
      tenantContext,
      loginIdentifier: body.loginIdentifier
    });

    return result;
  });

  app.post("/auth/password-reset/complete", async (request) => {
    const tenantContext = getTenantContext(request);
    const body = parseAuthBody(passwordResetCompleteSchema, request.body, "auth_password_reset_complete_invalid");
    const result = await options.authService.completePasswordReset({
      tenantContext,
      resetToken: body.resetToken,
      newPassword: body.newPassword
    });

    return result;
  });
}
