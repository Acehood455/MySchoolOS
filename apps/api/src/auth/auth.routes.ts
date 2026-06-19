import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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

function setAuthCookie(reply: FastifyReply, cookie: string): void {
  reply.header("Set-Cookie", cookie);
}

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  app.post(
    "/auth/login",
    {
      config: {
        foundation: {
          resolveTenant: true
        }
      }
    },
    async (request, reply) => {
      const foundationContext = request.foundationContext!;
      const body = parseAuthBody(loginRequestSchema, request.body, "auth_login_invalid");
      const result = await options.authService.login({
        tenantContext: foundationContext.tenantContext!,
        loginIdentifier: body.loginIdentifier,
        password: body.password
      });

      setAuthCookie(reply, result.setCookie);

      return {
        authContext: result.authContext
      };
    }
  );

  app.get(
    "/auth/session",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request) => {
      const foundationContext = request.foundationContext!;

      return {
        authenticated: true,
        authContext: foundationContext.authContext!
      };
    }
  );

  app.post(
    "/auth/logout",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request, reply) => {
      const foundationContext = request.foundationContext!;
      const body = parseAuthBody(logoutRequestSchema, request.body ?? {}, "auth_logout_invalid");
      const result = await options.authService.logout({
        tenantContext: foundationContext.tenantContext!,
        sessionToken: foundationContext.sessionToken!,
        reason: body.reason
      });

      setAuthCookie(reply, result.clearCookie);

      return {
        revoked: result.revoked
      };
    }
  );

  app.post(
    "/auth/password-reset/request",
    {
      config: {
        foundation: {
          resolveTenant: true
        }
      }
    },
    async (request) => {
      const foundationContext = request.foundationContext!;
      const body = parseAuthBody(passwordResetRequestSchema, request.body, "auth_password_reset_request_invalid");
      const result = await options.authService.requestPasswordReset({
        tenantContext: foundationContext.tenantContext!,
        loginIdentifier: body.loginIdentifier
      });

      return result;
    }
  );

  app.post(
    "/auth/password-reset/complete",
    {
      config: {
        foundation: {
          resolveTenant: true
        }
      }
    },
    async (request) => {
      const foundationContext = request.foundationContext!;
      const body = parseAuthBody(passwordResetCompleteSchema, request.body, "auth_password_reset_complete_invalid");
      const result = await options.authService.completePasswordReset({
        tenantContext: foundationContext.tenantContext!,
        resetToken: body.resetToken,
        newPassword: body.newPassword
      });

      return result;
    }
  );
}
