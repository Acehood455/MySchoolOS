import { AppError } from "@myschoolos/shared";
import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { TenantResolutionService } from "../tenant/tenant-resolution.service.js";
import type { TenantResolutionRepository } from "../tenant/tenant-context.js";
import { registerFoundationPlugin } from "./foundation.plugin.js";
import type { AuthContext } from "../auth/auth-context.js";
import type { AuthorizationContext } from "../authorization/authorization-context.js";

function createTenantContext() {
  return {
    schoolId: "school-123",
    host: "alpha.example.com",
    resolvedBy: "verified_custom_domain" as const,
    schoolDomainId: "domain-1"
  };
}

describe("foundation plugin", () => {
  it("runs tenant resolution, authentication, authorization, route execution, and audit in order", async () => {
    const order: string[] = [];
    const auditEvents: Array<Record<string, unknown>> = [];
    const tenantContext = createTenantContext();
    const authContext: AuthContext = {
      sessionId: "session-1" as never,
      userId: "user-1",
      schoolId: tenantContext.schoolId,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      loginIdentifier: "teacher@example.com",
      userStatus: "active"
    };
    const authorizationContext: AuthorizationContext = {
      userId: authContext.userId,
      schoolId: tenantContext.schoolId,
      roles: ["school_admin"],
      roleAssignments: [
        {
          id: "assignment-1",
          schoolId: tenantContext.schoolId,
          userId: authContext.userId,
          canonicalRole: "school_admin",
          status: "active",
          assignedAt: new Date("2026-01-01T00:00:00.000Z")
        }
      ],
      invalidRoleAssignments: []
    };
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve(host) {
          order.push("tenant");
          expect(host).toBe("alpha.example.com");
          return tenantContext;
        }
      },
      authService: {
        async validateSession(input) {
          order.push("auth");
          expect(input.tenantContext).toBe(tenantContext);
          expect(input.sessionToken).toBe("session-token-1");
          return { authContext };
        }
      },
      authorizationService: {
        async resolveAuthorizationContext(input) {
          order.push("authorization");
          expect(input.authContext).toBe(authContext);
          expect(input.tenantContext).toBe(tenantContext);
          return authorizationContext;
        }
      },
      auditService: {
        async record(event) {
          order.push("audit");
          auditEvents.push(event as unknown as Record<string, unknown>);
          return event as never;
        }
      },
      cookieName: "myschoolos_session"
    });

    app.get(
      "/protected",
      {
        config: {
          foundation: {
            resolveTenant: true,
            authenticate: true,
            permission: "tenant.read",
            audit: {
              eventName: "foundation.route.executed",
              resourceType: "Protected resource",
              resourceId: "route-1"
            }
          }
        }
      },
      async (request) => {
        order.push("route");

        expect(request.foundationContext?.tenantContext).toBe(tenantContext);
        expect(request.foundationContext?.authContext).toBe(authContext);
        expect(request.foundationContext?.authorizationContext).toBe(authorizationContext);
        expect(request.foundationContext?.roleAssignments).toEqual(authorizationContext.roleAssignments);

        return {
          ok: true,
          requestId: request.foundationContext?.requestId,
          correlationId: request.foundationContext?.correlationId
        };
      }
    );

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        host: "alpha.example.com",
        "x-correlation-id": "corr-123",
        cookie: "myschoolos_session=session-token-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      correlationId: "corr-123"
    });
    expect(order).toEqual(["tenant", "auth", "authorization", "route", "audit"]);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      eventName: "foundation.route.executed",
      actorType: "user",
      actorId: "user-1",
      schoolId: "school-123",
      resourceType: "Protected resource",
      resourceId: "route-1",
      outcome: "success"
    });
  });

  it("audits failed tenant resolution before route execution", async () => {
    const auditEvents: Array<Record<string, unknown>> = [];
    const repository: TenantResolutionRepository = {
      async findDomainsByHost() {
        return [];
      },
      async findDomainsBySubdomain() {
        return [];
      }
    };
    const tenantResolver = new TenantResolutionService({
      repository,
      subdomainBaseHost: "example.com",
      auditSink: {
        async record(event) {
          auditEvents.push(event as unknown as Record<string, unknown>);
        }
      }
    });
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver,
      cookieName: "myschoolos_session"
    });

    app.get(
      "/needs-tenant",
      {
        config: {
          foundation: {
            resolveTenant: true
          }
        }
      },
      async () => ({
        ok: true
      })
    );

    const response = await app.inject({
      method: "GET",
      url: "/needs-tenant",
      headers: {
        host: "unknown.example.com"
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "tenant_not_found"
    });
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        eventName: "tenant.resolution.failed",
        host: "unknown.example.com",
        reason: "unresolved"
      })
    );
  });

  it("audits failed authentication when a protected route has no session cookie", async () => {
    const auditEvents: Array<Record<string, unknown>> = [];
    const tenantContext = createTenantContext();
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve() {
          return tenantContext;
        }
      },
      authService: {
        async validateSession() {
          throw new Error("validateSession should not be called when the cookie is missing");
        }
      },
      auditService: {
        async record(event) {
          auditEvents.push(event as unknown as Record<string, unknown>);
          return event as never;
        }
      },
      cookieName: "myschoolos_session"
    });

    app.get(
      "/needs-auth",
      {
        config: {
          foundation: {
            resolveTenant: true,
            authenticate: true
          }
        }
      },
      async () => ({
        ok: true
      })
    );

    const response = await app.inject({
      method: "GET",
      url: "/needs-auth",
      headers: {
        host: "alpha.example.com"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: "auth_session_missing"
    });
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        eventName: "auth.session.validation_failed",
        actorType: "system",
        schoolId: "school-123",
        resourceType: "Session",
        outcome: "failure",
        reason: "missing_session"
      })
    );
  });

  it("audits authorization denials and prevents the route from executing", async () => {
    const order: string[] = [];
    const auditEvents: Array<Record<string, unknown>> = [];
    const tenantContext = createTenantContext();
    const authContext: AuthContext = {
      sessionId: "session-1" as never,
      userId: "user-1",
      schoolId: tenantContext.schoolId,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      loginIdentifier: "teacher@example.com",
      userStatus: "active"
    };
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve(host) {
          order.push("tenant");
          expect(host).toBe("alpha.example.com");
          return tenantContext;
        }
      },
      authService: {
        async validateSession(input) {
          order.push("auth");
          expect(input.tenantContext).toBe(tenantContext);
          expect(input.sessionToken).toBe("session-token-1");
          return { authContext };
        }
      },
      authorizationService: {
        async resolveAuthorizationContext(input) {
          order.push("authorization");
          expect(input.authContext).toBe(authContext);
          expect(input.tenantContext).toBe(tenantContext);
          return {
            userId: authContext.userId,
            schoolId: tenantContext.schoolId,
            roles: [],
            roleAssignments: [],
            invalidRoleAssignments: []
          };
        }
      },
      auditService: {
        async record(event) {
          order.push("audit");
          auditEvents.push(event as unknown as Record<string, unknown>);
          return event as never;
        }
      },
      cookieName: "myschoolos_session"
    });

    app.get(
      "/forbidden",
      {
        config: {
          foundation: {
            resolveTenant: true,
            authenticate: true,
            permission: "role.assign"
          }
        }
      },
      async () => {
        order.push("route");

        return {
          ok: true
        };
      }
    );

    const response = await app.inject({
      method: "GET",
      url: "/forbidden",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-token-1"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "permission_denied"
    });
    expect(order).toEqual(["tenant", "auth", "authorization", "audit"]);
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        eventName: "permission.denied",
        actorType: "user",
        actorId: "user-1",
        schoolId: "school-123",
        resourceType: "Protected resource",
        outcome: "failure",
        reason: "forbidden",
        metadata: expect.objectContaining({
          permission: "role.assign"
        })
      })
    );
  });

  it("audits failed tenant resolution through the shared audit service", async () => {
    const auditEvents: Array<Record<string, unknown>> = [];
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve() {
          throw new AppError("Tenant Not Found", {
            status: 404,
            code: "tenant_not_found"
          });
        }
      },
      auditService: {
        async record(event) {
          auditEvents.push(event as unknown as Record<string, unknown>);
          return event as never;
        }
      },
      cookieName: "myschoolos_session"
    });

    app.get(
      "/needs-tenant",
      {
        config: {
          foundation: {
            resolveTenant: true
          }
        }
      },
      async () => ({
        ok: true
      })
    );

    const response = await app.inject({
      method: "GET",
      url: "/needs-tenant",
      headers: {
        host: "unknown.example.com"
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "tenant_not_found"
    });
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        eventName: "tenant.resolution.failed",
        actorType: "system",
        resourceType: "SchoolDomain",
        outcome: "failure",
        reason: "tenant_not_found"
      })
    );
  });
});
