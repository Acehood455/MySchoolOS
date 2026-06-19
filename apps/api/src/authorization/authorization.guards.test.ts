import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth-context.js";
import { registerTenantMiddleware } from "../tenant/tenant.middleware.js";
import type { AuthorizationRepository } from "./authorization-context.js";
import { createPermissionGuard } from "./authorization.guards.js";
import { AuthorizationService } from "./authorization.service.js";
import type { RoleAssignmentRecord } from "@myschoolos/shared";

function createAssignment(): RoleAssignmentRecord {
  return {
    id: "assignment-1",
    schoolId: "school-123",
    userId: "user-1",
    canonicalRole: "school_admin",
    status: "active",
    assignedAt: new Date("2026-06-19T00:00:00.000Z")
  };
}

function createAuthContext(): AuthContext {
  return {
    sessionId: "session-1" as AuthContext["sessionId"],
    userId: "user-1",
    schoolId: "school-123",
    expiresAt: new Date("2026-06-19T00:00:00.000Z"),
    loginIdentifier: "teacher@example.com",
    userStatus: "active"
  };
}

describe("permission guards", () => {
  it("attaches authorization context to protected routes", async () => {
    const auditSink = { record: vi.fn() };
    const repository: AuthorizationRepository = {
      async findRoleAssignments() {
        return [createAssignment()];
      }
    };
    const authorizationService = new AuthorizationService({
      repository,
      auditSink
    });
    const app = fastify();

    app.decorateRequest("authContext", null);
    app.decorateRequest("authorizationContext", null);

    await registerTenantMiddleware(app, {
      resolver: {
        async resolve() {
          return {
            schoolId: "school-123",
            host: "alpha.example.com",
            resolvedBy: "verified_custom_domain" as const,
            schoolDomainId: "domain-1"
          };
        }
      }
    });

    app.addHook("onRequest", async (request) => {
      request.authContext = createAuthContext();
    });

    app.get(
      "/protected",
      {
        preHandler: createPermissionGuard("tenant.read", authorizationService)
      },
      async (request) => ({
        roles: request.authorizationContext?.roles ?? []
      })
    );

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        host: "alpha.example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      roles: ["school_admin"]
    });
  });
});
