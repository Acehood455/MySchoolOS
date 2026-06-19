import { AppError, canRolePerform, type FoundationPermission } from "@myschoolos/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthService } from "../auth/auth.service.js";
import { parseCookieHeader } from "../auth/session.service.js";
import type { AuthorizationService } from "../authorization/authorization.service.js";
import type { TenantResolutionService } from "../tenant/tenant-resolution.service.js";
import { hasResolvedFoundationContext, type FoundationRequestContext, type FoundationRouteConfig } from "./foundation-context.js";
import { createLogger } from "@myschoolos/observability";

export interface FoundationIntegrationOptions {
  readonly tenantResolver?: Pick<TenantResolutionService, "resolve">;
  readonly authService?: Pick<AuthService, "validateSession">;
  readonly authorizationService?: Pick<AuthorizationService, "resolveAuthorizationContext">;
  readonly auditService?: Pick<AuditService, "record">;
  readonly cookieName?: string;
  readonly csrfCookieName?: string;
}

interface ThrottleBucket {
  readonly count: number;
  readonly windowEndsAt: number;
}

function getCorrelationId(request: FastifyRequest): string {
  const header = request.headers["x-correlation-id"];

  if (Array.isArray(header)) {
    return header[0] ?? request.id;
  }

  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }

  return request.id;
}

function createBaseContext(request: FastifyRequest): FoundationRequestContext {
  return {
    requestId: request.id,
    correlationId: getCorrelationId(request),
    tenantId: null,
    actorId: null,
    roleAssignments: [],
    sessionToken: null,
    tenantContext: null,
    authContext: null,
    authorizationContext: null,
  };
}

function createRequestLogger(request: FastifyRequest) {
  const context = request.foundationContext ?? createBaseContext(request);

  return createLogger("api.foundation", {
    requestId: context.requestId,
    correlationId: context.correlationId,
    actorId: context.actorId,
    tenantId: context.tenantId ?? context.tenantContext?.schoolId ?? null
  });
}

function routeFoundationConfig(routeOptions: { config?: FoundationRouteConfig }) {
  return routeOptions.config?.foundation;
}

type FoundationHook = (request: FastifyRequest, reply: unknown) => Promise<void>;

interface SecurityRouteContext {
  readonly throttle?: "general" | "login" | "password_reset";
  readonly csrfRequired: boolean;
}

function mergePreHandlers(existing: unknown, injected: FoundationHook[]): FoundationHook[] {
  const preHandlers = Array.isArray(existing) ? [...existing] : existing ? [existing as FoundationHook] : [];

  return [...injected, ...preHandlers];
}

function getSessionToken(request: FastifyRequest, cookieName: string): string | null {
  const cookies = parseCookieHeader(request.headers.cookie);
  return cookies[cookieName] ?? null;
}

function getRequestIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() ?? request.ip;
  }

  return request.ip;
}

function getCsrfToken(request: FastifyRequest, cookieName: string): string | null {
  const header = request.headers["x-csrf-token"];
  const cookies = parseCookieHeader(request.headers.cookie);
  const cookieToken = cookies[cookieName] ?? null;

  if (typeof header !== "string" || !header.trim() || !cookieToken) {
    return null;
  }

  return header.trim() === cookieToken ? cookieToken : null;
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function checkBucket(
  bucketStore: Map<string, ThrottleBucket>,
  key: string,
  maxRequests: number,
  windowMs: number,
  now: number
): { readonly allowed: boolean; readonly retryAfterSeconds?: number } {
  const bucket = bucketStore.get(key);

  if (!bucket || bucket.windowEndsAt <= now) {
    bucketStore.set(key, {
      count: 1,
      windowEndsAt: now + windowMs
    });

    return { allowed: true };
  }

  if (bucket.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.windowEndsAt - now) / 1000))
    };
  }

  bucketStore.set(key, {
    count: bucket.count + 1,
    windowEndsAt: bucket.windowEndsAt
  });

  return { allowed: true };
}

async function recordAuthFailure(
  options: FoundationIntegrationOptions,
  request: FastifyRequest,
  reason: string,
  tenantId?: string | null
): Promise<void> {
  if (!options.auditService) {
    return;
  }

  await options.auditService.record({
    eventName: "auth.session.validation_failed",
    actorType: "system",
    schoolId: tenantId ?? undefined,
    resourceType: "Session",
    severity: "medium",
    outcome: "failure",
    requestId: request.id,
    reason,
    metadata: {
      correlationId: request.headers["x-correlation-id"] ?? request.id
    }
  });
}

async function recordTenantResolutionFailure(
  options: FoundationIntegrationOptions,
  request: FastifyRequest,
  reason: string,
  tenantId?: string | null
): Promise<void> {
  if (!options.auditService) {
    return;
  }

  await options.auditService.record({
    eventName: "tenant.resolution.failed",
    actorType: "system",
    schoolId: tenantId ?? undefined,
    resourceType: "SchoolDomain",
    severity: "medium",
    outcome: "failure",
    requestId: request.id,
    reason,
    metadata: {
      correlationId: request.headers["x-correlation-id"] ?? request.id,
      host: request.headers.host
    }
  });
}

async function recordRouteAudit(
  options: FoundationIntegrationOptions,
  request: FastifyRequest,
  outcome: "success" | "failure"
): Promise<void> {
  const foundation = routeFoundationConfig(request.routeOptions);

  if (!foundation?.audit || !options.auditService) {
    return;
  }

  const context = request.foundationContext;
  const tenantId = context?.tenantId ?? context?.tenantContext?.schoolId;
  const actorId = context?.actorId ?? context?.authContext?.userId;

  await options.auditService.record({
    eventName: foundation.audit.eventName,
    actorType: actorId ? "user" : "system",
    actorId: actorId ?? undefined,
    schoolId: tenantId ?? undefined,
    resourceType: foundation.audit.resourceType,
    resourceId: foundation.audit.resourceId,
    severity: outcome === "success" ? "low" : "medium",
    outcome,
    requestId: request.id,
    metadata: {
      correlationId: context?.correlationId ?? request.id,
      route: request.routeOptions.method && request.routeOptions.url ? `${request.routeOptions.method} ${request.routeOptions.url}` : undefined
    }
  });
}

async function resolveTenant(request: FastifyRequest, options: FoundationIntegrationOptions): Promise<void> {
  if (!options.tenantResolver) {
    throw new AppError("Tenant resolution is not configured", {
      status: 500,
      code: "tenant_resolution_unavailable"
    });
  }

  try {
    const tenantContext = await options.tenantResolver.resolve(request.headers.host);

    request.foundationContext = {
      ...(request.foundationContext ?? createBaseContext(request)),
      tenantId: tenantContext.schoolId,
      tenantContext
    };
  } catch (error) {
    const context = request.foundationContext ?? createBaseContext(request);

    await recordTenantResolutionFailure(
      options,
      request,
      error instanceof AppError ? error.code : "tenant_resolution_failed",
      context.tenantId
    );

    throw error;
  }
}

async function authenticateRequest(request: FastifyRequest, options: FoundationIntegrationOptions): Promise<void> {
  if (!options.authService) {
    throw new AppError("Authentication is not configured", {
      status: 500,
      code: "authentication_unavailable"
    });
  }

  const context = request.foundationContext;

  if (!context?.tenantContext) {
    throw new AppError("Tenant context is required for authentication", {
      status: 401,
      code: "tenant_context_required"
    });
  }

  const cookieName = options.cookieName ?? "myschoolos_session";
  const sessionToken = getSessionToken(request, cookieName);

  if (!sessionToken) {
    await recordAuthFailure(options, request, "missing_session", context.tenantId);

    throw new AppError("Authentication required", {
      status: 401,
      code: "auth_session_missing"
    });
  }

  const validation = await options.authService.validateSession({
    tenantContext: context.tenantContext,
    sessionToken
  });

  request.foundationContext = {
    ...context,
    actorId: validation.authContext.userId,
    authContext: validation.authContext,
    sessionToken
  };
}

async function authorizeRequest(
  request: FastifyRequest,
  options: FoundationIntegrationOptions,
  permission: FoundationPermission
): Promise<void> {
  if (!options.authorizationService) {
    throw new AppError("Authorization is not configured", {
      status: 500,
      code: "authorization_unavailable"
    });
  }

  const context = request.foundationContext;

  if (!context?.tenantContext || !context.authContext) {
    throw new AppError("Authentication is required", {
      status: 401,
      code: "auth_session_required"
    });
  }

  const result = await options.authorizationService.resolveAuthorizationContext({
    authContext: context.authContext,
    tenantContext: context.tenantContext
  });

  const permitted = result.roleAssignments.some(
    (assignment) => assignment.status === "active" && canRolePerform(assignment.canonicalRole, permission)
  );

  request.foundationContext = {
    ...context,
    authorizationContext: result,
    roleAssignments: result.roleAssignments
  };

  if (!permitted || result.invalidRoleAssignments.length > 0) {
    await options.auditService?.record({
      eventName: "permission.denied",
      actorType: "user",
      actorId: context.authContext.userId,
      schoolId: context.tenantContext.schoolId,
      resourceType: "Protected resource",
      severity: "medium",
      outcome: "failure",
      requestId: request.id,
      reason: !permitted ? "forbidden" : "invalid_role_assignment",
      metadata: {
        permission,
        correlationId: context.correlationId
      }
    });

    throw new AppError("Permission denied", {
      status: 403,
      code: "permission_denied"
    });
  }
}

function normalizeRouteConfig(routeOptions: { config?: FoundationRouteConfig }): {
  readonly resolveTenant: boolean;
  readonly authenticate: boolean;
  readonly permission?: FoundationPermission;
  readonly security?: SecurityRouteContext;
  readonly audit?: {
    readonly eventName: string;
    readonly resourceType: string;
    readonly resourceId?: string;
  };
} {
  const foundation = routeOptions.config?.foundation;

  return {
    resolveTenant: foundation?.resolveTenant ?? false,
    authenticate: foundation?.authenticate ?? false,
    permission: foundation?.permission,
    security: {
      throttle: foundation?.security?.throttle,
      csrfRequired: foundation?.security?.csrf ?? false
    },
    audit: foundation?.audit
  };
}

export async function registerFoundationPlugin(
  app: FastifyInstance,
  options: FoundationIntegrationOptions = {}
): Promise<void> {
  const globalThrottleBuckets = new Map<string, ThrottleBucket>();
  const loginThrottleBuckets = new Map<string, ThrottleBucket>();
  const passwordResetThrottleBuckets = new Map<string, ThrottleBucket>();

  app.decorateRequest("foundationContext", null);

  app.addHook("onRequest", async (request) => {
    request.foundationContext = createBaseContext(request);
    createRequestLogger(request).info("request.received", {
      method: request.method,
      url: request.url
    });

    const rateLimitResult = checkBucket(globalThrottleBuckets, `request:${getRequestIp(request)}`, 300, 60_000, Date.now());

    if (!rateLimitResult.allowed) {
      throw new AppError("Too many requests", {
        status: 429,
        code: "rate_limited",
        details: {
          retryAfterSeconds: rateLimitResult.retryAfterSeconds
        }
      });
    }
  });

  app.addHook("onRoute", (routeOptions) => {
    const foundation = normalizeRouteConfig(routeOptions);
    const routeMethod = String(Array.isArray(routeOptions.method) ? routeOptions.method[0] ?? "GET" : routeOptions.method ?? "GET");

    if (!foundation.resolveTenant && !foundation.authenticate && !foundation.permission && !foundation.audit) {
      return;
    }

    const injectedPreHandlers: FoundationHook[] = [];
    const security = foundation.security;

    if (foundation.resolveTenant || foundation.authenticate || foundation.permission) {
      injectedPreHandlers.push(async (request) => {
        const current = request.foundationContext;

        if (hasResolvedFoundationContext(current)) {
          return;
        }

        await resolveTenant(request, options);
      });
    }

    if (security?.throttle) {
      injectedPreHandlers.push(async (request) => {
        const now = Date.now();
        const ip = getRequestIp(request);
        const routePath = String(Array.isArray(routeOptions.url) ? routeOptions.url[0] ?? request.url : routeOptions.url ?? request.url);
        const bucketStore =
          security.throttle === "login"
            ? loginThrottleBuckets
            : security.throttle === "password_reset"
              ? passwordResetThrottleBuckets
              : globalThrottleBuckets;
        const limit = security.throttle === "login" ? 5 : security.throttle === "password_reset" ? 6 : 60;
        const windowMs = security.throttle === "login" ? 15 * 60_000 : security.throttle === "password_reset" ? 15 * 60_000 : 60_000;
        const rateLimitResult = checkBucket(bucketStore, `${security.throttle}:${ip}:${routeMethod}:${routePath}`, limit, windowMs, now);

        if (!rateLimitResult.allowed) {
          throw new AppError("Too many requests", {
            status: 429,
            code: "rate_limited",
            details: {
              retryAfterSeconds: rateLimitResult.retryAfterSeconds
            }
          });
        }
      });
    }

    if (foundation.authenticate || foundation.permission) {
      injectedPreHandlers.push(async (request) => {
        const current = request.foundationContext;

        if (current?.authContext) {
          return;
        }

        await authenticateRequest(request, options);
      });
    }

    if (foundation.permission) {
      const permission = foundation.permission;

      injectedPreHandlers.push(async (request) => {
        const current = request.foundationContext;

        if (current?.authorizationContext) {
          return;
        }

        await authorizeRequest(request, options, permission);
      });
    }

    if ((security?.csrfRequired || (foundation.authenticate || foundation.permission)) && isUnsafeMethod(routeMethod)) {
      injectedPreHandlers.push(async (request) => {
        const token = getCsrfToken(request, options.csrfCookieName ?? "myschoolos_csrf");

        if (!token) {
          throw new AppError("CSRF token is required", {
            status: 403,
            code: "csrf_token_invalid"
          });
        }
      });
    }

    routeOptions.preHandler = mergePreHandlers(routeOptions.preHandler, injectedPreHandlers);
  });

  app.addHook("onSend", async (_request, reply: FastifyReply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header("Cache-Control", "no-store");

    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    createRequestLogger(request).info("request.completed", {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode
    });

    if (reply.statusCode < 400) {
      await recordRouteAudit(options, request, "success");
    }
  });
}
