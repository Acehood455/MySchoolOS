import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth-context.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import type { AuthorizationRepository } from "./authorization-context.js";
import { AuthorizationService } from "./authorization.service.js";
import type { RoleAssignmentRecord } from "@myschoolos/shared";

function createAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    sessionId: "session-1" as AuthContext["sessionId"],
    userId: "user-1",
    schoolId: "school-123",
    expiresAt: new Date("2026-06-19T00:00:00.000Z"),
    loginIdentifier: "teacher@example.com",
    userStatus: "active",
    ...overrides
  };
}

function createTenantContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    schoolId: "school-123",
    host: "alpha.example.com",
    resolvedBy: "verified_custom_domain",
    schoolDomainId: "domain-1",
    ...overrides
  };
}

function createAssignment(overrides: Partial<RoleAssignmentRecord> = {}): RoleAssignmentRecord {
  return {
    id: "assignment-1",
    schoolId: "school-123",
    userId: "user-1",
    canonicalRole: "school_admin",
    status: "active",
    assignedAt: new Date("2026-06-19T00:00:00.000Z"),
    ...overrides
  };
}

describe("AuthorizationService", () => {
  it("resolves tenant-scoped role assignments and authorizes matching permissions", async () => {
    const auditSink = { record: vi.fn() };
    const repository: AuthorizationRepository = {
      async findRoleAssignments(userId, schoolId) {
        return userId === "user-1" && schoolId === "school-123" ? [createAssignment()] : [];
      }
    };
    const service = new AuthorizationService({
      repository,
      auditSink
    });

    const result = await service.authorize({
      authContext: createAuthContext(),
      tenantContext: createTenantContext(),
      permission: "school.manage"
    });

    expect(result.permitted).toBe(true);
    expect(result.authorizationContext.roles).toEqual(["school_admin"]);
    expect(auditSink.record).not.toHaveBeenCalled();
  });

  it("denies unauthorized actions and audits the failure", async () => {
    const auditSink = { record: vi.fn() };
    const repository: AuthorizationRepository = {
      async findRoleAssignments() {
        return [];
      }
    };
    const service = new AuthorizationService({
      repository,
      auditSink
    });

    await expect(
      service.authorize({
        authContext: createAuthContext(),
        tenantContext: createTenantContext(),
        permission: "role.assign"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "permission.denied",
        reason: "no_role_assignment",
        permission: "role.assign",
        schoolId: "school-123",
        userId: "user-1"
      })
    );
  });

  it("denies tenant mismatches and audits them", async () => {
    const auditSink = { record: vi.fn() };
    const repository: AuthorizationRepository = {
      async findRoleAssignments() {
        return [createAssignment()];
      }
    };
    const service = new AuthorizationService({
      repository,
      auditSink
    });

    await expect(
      service.authorize({
        authContext: createAuthContext({ schoolId: "school-999" }),
        tenantContext: createTenantContext(),
        permission: "school.manage"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "permission.denied",
        reason: "tenant_mismatch",
        schoolId: "school-123",
        userId: "user-1"
      })
    );
  });
});
