import { AppError, canRolePerform, type FoundationPermission } from "@myschoolos/shared";
import type { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthService } from "../auth/auth.service.js";
import { parseCookieHeader } from "../auth/session.service.js";
import type { AuthorizationService } from "../authorization/authorization.service.js";
import type { TenantResolutionService } from "../tenant/tenant-resolution.service.js";
import type { FoundationRequestContext } from "./foundation-context.js";

export interface FoundationIntegrationOptions {
  readonly tenantResolver?: Pick<TenantResolutionService, "resolve">;
  readonly authService?: Pick<AuthService, "validateSession">;
  readonly authorizationService?: Pick<AuthorizationService, "resolveAuthorizationContext">;
  readonly auditService?: AuditService;
  readonly cookieName?: string;
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
    tenantContext: null,
    actorId: null,
    authContext: null,
    authorizationContext: null,
    roleAssignments: [],
    sessionToken: null
  };
}

function routeFoundationConfig(routeOptions: RouteOptions) {
  return routeOptions.config?.foundation;
}

type FoundationHook = (request: FastifyRequest, reply: unknown) => Promise<void>;

function mergePreHandlers(existing: unknown, injected: FoundationHook[]): FoundationHook[] {
  const preHandlers = Array.isArray(existing) ? [...existing] : existing ? [existing as FoundationHook] : [];

  return [...injected, ...preHandlers];
}

function getSessionToken(request: FastifyRequest, cookieName: string): string | null {
  const cookies = parseCookieHeader(request.headers.cookie);
  return cookies[cookieName] ?? null;
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

  const tenantContext = await options.tenantResolver.resolve(request.headers.host);

  request.foundationContext = {
    ...(request.foundationContext ?? createBaseContext(request)),
    tenantId: tenantContext.schoolId,
    tenantContext
  };
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

function normalizeRouteConfig(routeOptions: RouteOptions): {
  readonly resolveTenant: boolean;
  readonly authenticate: boolean;
  readonly permission?: FoundationPermission;
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
    audit: foundation?.audit
  };
}

export async function registerFoundationPlugin(
  app: FastifyInstance,
  options: FoundationIntegrationOptions = {}
): Promise<void> {
  app.decorateRequest("foundationContext", null);

  app.addHook("onRequest", async (request) => {
    request.foundationContext = createBaseContext(request);
  });

  app.addHook("onRoute", (routeOptions) => {
    const foundation = normalizeRouteConfig(routeOptions);

    if (!foundation.resolveTenant && !foundation.authenticate && !foundation.permission && !foundation.audit) {
      return;
    }

    const injectedPreHandlers: FoundationHook[] = [];

    if (foundation.resolveTenant || foundation.authenticate || foundation.permission) {
      injectedPreHandlers.push(async (request) => {
        const current = request.foundationContext;

        if (current?.tenantContext) {
          return;
        }

        await resolveTenant(request, options);
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
      injectedPreHandlers.push(async (request) => {
        const current = request.foundationContext;

        if (current?.authorizationContext) {
          return;
        }

        await authorizeRequest(request, options, foundation.permission);
      });
    }

    routeOptions.preHandler = mergePreHandlers(routeOptions.preHandler, injectedPreHandlers);
  });

  app.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode < 400) {
      await recordRouteAudit(options, request, "success");
    }
  });

  app.addHook("onError", async (request, _reply, _error) => {
    await recordRouteAudit(options, request, "failure");
  });
}
