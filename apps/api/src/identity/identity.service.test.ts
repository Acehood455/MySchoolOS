import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryIdentityRepository } from "./identity.repository.js";
import { IdentityService } from "./identity.service.js";
import { registerIdentityRoutes } from "./identity.routes.js";

function createClock(): Date {
  return new Date("2026-06-20T00:00:00.000Z");
}

function createActor(schoolId: string, roles: SchoolActorContext["roles"], actorId = "actor-1"): SchoolActorContext {
  return {
    actorId,
    roles,
    schoolId
  };
}

function createSequenceFactory(values: string[]) {
  return () => {
    const value = values.shift();

    if (!value) {
      throw new Error("No value available");
    }

    return value;
  };
}

function createAuditSink() {
  return { record: vi.fn() };
}

async function createService(overrides: Partial<ConstructorParameters<typeof IdentityService>[0]> = {}) {
  const repository = new InMemoryIdentityRepository();
  const auditSink = createAuditSink();
  const sessionRevoker = vi.fn();
  const service = new IdentityService({
    repository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory([
      "user-1",
      "user-2",
      "invitation-1",
      "invitation-2",
      "assignment-1",
      "assignment-2",
      "assignment-3"
    ]),
    invitationTokenFactory: createSequenceFactory(["invite-token-1", "invite-token-2"]),
    invitationTtlMs: 60_000,
    sessionRevoker,
    ...overrides
  });

  return {
    repository,
    auditSink,
    sessionRevoker,
    service
  };
}

describe("IdentityService", () => {
  it("manages the user lifecycle, invitations, and audits", async () => {
    const { service, auditSink, sessionRevoker } = await createService();
    const actor = createActor("school-1", ["school_admin"], "school-admin-1");

    const created = await service.createUser({
      actor,
      schoolId: "school-1",
      loginIdentifier: "teacher@example.com",
      displayName: "Teacher One"
    });

    expect(created.status).toBe("active");

    const invited = await service.inviteUser({
      actor,
      schoolId: "school-1",
      loginIdentifier: "parent@example.com",
      displayName: "Parent One"
    });

    expect(invited.user.status).toBe("invited");
    expect(invited.invitation.status).toBe("sent");
    expect(invited.invitationToken).toBe("invite-token-1");

    const resent = await service.resendInvitation({
      actor,
      schoolId: "school-1",
      invitationId: invited.invitation.id
    });

    expect(resent.invitation.resendCount).toBe(1);
    expect(resent.invitationToken).toBe("invite-token-2");

    const suspended = await service.suspendUser({
      actor,
      schoolId: "school-1",
      userId: created.id
    });

    expect(suspended.status).toBe("suspended");

    const reactivated = await service.reactivateUser({
      actor,
      schoolId: "school-1",
      userId: created.id
    });

    expect(reactivated.status).toBe("active");

    const deactivated = await service.deactivateUser({
      actor,
      schoolId: "school-1",
      userId: created.id
    });

    expect(deactivated.status).toBe("deactivated");
    expect(sessionRevoker).toHaveBeenCalledWith("user-1", "school-1", "user_suspended");
    expect(sessionRevoker).toHaveBeenCalledWith("user-1", "school-1", "user_deactivated");

    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "user.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "user.invited" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "user.suspended" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "user.activated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "user.deactivated" }));
  });

  it("enforces tenant isolation and role assignment rules", async () => {
    const { service } = await createService();
    const schoolOneAdmin = createActor("school-1", ["school_admin"], "school-admin-1");
    const schoolTwoAdmin = createActor("school-2", ["school_admin"], "school-admin-2");

    const user = await service.createUser({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      loginIdentifier: "teacher@example.com",
      displayName: "Teacher One"
    });

    await expect(
      service.createUser({
        actor: schoolTwoAdmin,
        schoolId: "school-1",
        loginIdentifier: "intruder@example.com",
        displayName: "Intruder"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.deactivateUser({
        actor: schoolOneAdmin,
        schoolId: "school-2",
        userId: user.id
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.assignRole({
        actor: schoolOneAdmin,
        schoolId: "school-1",
        userId: user.id,
        canonicalRole: "super_admin"
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "identity_role_invalid"
    });
  });

  it("assigns, lists, and removes tenant role assignments", async () => {
    const { service } = await createService();
    const actor = createActor("school-1", ["school_admin"], "school-admin-1");

    const user = await service.createUser({
      actor,
      schoolId: "school-1",
      loginIdentifier: "teacher@example.com",
      displayName: "Teacher One"
    });

    const assignment = await service.assignRole({
      actor,
      schoolId: "school-1",
      userId: user.id,
      canonicalRole: "teacher"
    });

    expect(assignment.status).toBe("active");

    const listed = await service.listRoleAssignments(actor, "school-1");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.canonicalRole).toBe("teacher");

    const removed = await service.removeRole({
      actor,
      schoolId: "school-1",
      userId: user.id,
      canonicalRole: "teacher"
    });

    expect(removed.status).toBe("revoked");
  });
});

describe("Identity routes", () => {
  it("supports the identity management workflow through the API routes", async () => {
    const { service } = await createService();
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve() {
          return {
            schoolId: "school-1",
            host: "alpha.example.com",
            resolvedBy: "verified_custom_domain" as const,
            schoolDomainId: "domain-1"
          };
        }
      },
      authService: {
        async validateSession() {
          return {
            authContext: {
              sessionId: "session-1" as never,
              userId: "school-admin-1",
              schoolId: "school-1",
              expiresAt: createClock(),
              loginIdentifier: "admin@example.com",
              userStatus: "active" as const
            }
          };
        }
      },
      authorizationService: {
        async resolveAuthorizationContext() {
          return {
            userId: "school-admin-1",
            schoolId: "school-1",
            roles: ["school_admin"] as const,
            roleAssignments: [
              {
                id: "assignment-1",
                schoolId: "school-1",
                userId: "school-admin-1",
                canonicalRole: "school_admin",
                status: "active",
                assignedAt: createClock()
              }
            ],
            invalidRoleAssignments: []
          };
        }
      },
      cookieName: "myschoolos_session"
    });

    await registerIdentityRoutes(app, {
      identityService: service
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/schools/school-1/users",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      },
      payload: {
        loginIdentifier: "teacher@example.com",
        displayName: "Teacher One"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      loginIdentifier: "teacher@example.com",
      status: "active"
    });

    const inviteResponse = await app.inject({
      method: "POST",
      url: "/schools/school-1/invitations",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      },
      payload: {
        loginIdentifier: "parent@example.com",
        displayName: "Parent One"
      }
    });

    expect(inviteResponse.statusCode).toBe(201);
    expect(inviteResponse.json()).toMatchObject({
      user: {
        loginIdentifier: "parent@example.com",
        status: "invited"
      },
      invitation: {
        status: "sent"
      },
      invitationToken: "invite-token-1"
    });

    const createdUser = await service.createUser({
      actor: createActor("school-1", ["school_admin"]),
      schoolId: "school-1",
      loginIdentifier: "staff@example.com",
      displayName: "Staff One"
    });

    const assignResponse = await app.inject({
      method: "POST",
      url: `/schools/school-1/users/${createdUser.id}/roles`,
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      },
      payload: {
        canonicalRole: "teacher"
      }
    });

    expect(assignResponse.statusCode).toBe(201);
    expect(assignResponse.json()).toMatchObject({
      userId: createdUser.id,
      canonicalRole: "teacher",
      status: "active"
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/schools/school-1/role-assignments",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1"
      }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);

    const removeResponse = await app.inject({
      method: "DELETE",
      url: `/schools/school-1/users/${createdUser.id}/roles/teacher`,
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      }
    });

    expect(removeResponse.statusCode).toBe(200);
    expect(removeResponse.json()).toMatchObject({
      userId: createdUser.id,
      canonicalRole: "teacher",
      status: "revoked"
    });
  });
});
