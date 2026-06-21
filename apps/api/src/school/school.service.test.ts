import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import { InMemorySchoolRepository } from "./school.repository.js";
import { SchoolService } from "./school.service.js";
import { registerSchoolRoutes } from "./school.routes.js";
import type { SchoolActorContext } from "./school-context.js";

function createClock() {
  return new Date("2026-06-20T00:00:00.000Z");
}

function createSuperAdminActor(overrides: Partial<SchoolActorContext> = {}): SchoolActorContext {
  return {
    actorId: "platform-1",
    roles: ["super_admin"],
    schoolId: null,
    ...overrides
  };
}

function createSchoolAdminActor(schoolId: string, overrides: Partial<SchoolActorContext> = {}): SchoolActorContext {
  return {
    actorId: "school-admin-1",
    roles: ["school_admin"],
    schoolId,
    ...overrides
  };
}

describe("SchoolService", () => {
  it("enforces the school lifecycle transitions", async () => {
    const repository = new InMemorySchoolRepository();
    const auditSink = { record: vi.fn() };
    const service = new SchoolService({
      repository,
      auditSink,
      clock: createClock,
      idFactory: () => "school-1"
    });

    const created = await service.createSchool({
      actor: createSuperAdminActor(),
      name: "Alpha Academy"
    });

    expect(created.status).toBe("pending");

    await expect(service.activateSchool(createSuperAdminActor(), created.id)).resolves.toMatchObject({
      status: "active"
    });
    await expect(service.suspendSchool(createSuperAdminActor(), created.id)).resolves.toMatchObject({
      status: "suspended"
    });
    await expect(service.archiveSchool(createSuperAdminActor(), created.id)).resolves.toMatchObject({
      status: "archived"
    });
    await expect(service.activateSchool(createSuperAdminActor(), created.id)).rejects.toMatchObject({
      status: 409,
      code: "school_lifecycle_invalid_transition"
    });

    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.created"
      })
    );
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.activated"
      })
    );
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.suspended"
      })
    );
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.archived"
      })
    );
  });

  it("rejects unauthorized school creation and cross-school access", async () => {
    const repository = new InMemorySchoolRepository();
    const service = new SchoolService({
      repository,
      clock: createClock,
      idFactory: () => "school-1"
    });

    await expect(
      service.createSchool({
        actor: createSchoolAdminActor("school-1"),
        name: "Alpha Academy"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    const school = await repository.createSchool({
      id: "school-1",
      name: "Alpha Academy",
      status: "pending",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: "platform-1"
    });

    expect(school.id).toBe("school-1");

    await expect(
      service.updateSettings({
        actor: createSchoolAdminActor("school-1"),
        schoolId: "school-2",
        timezone: "Africa/Lagos",
        locale: "en-NG",
        academicSessionDefaults: {},
        platformConfiguration: {}
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });
  });

  it("records audit events for settings, theme, and domain changes", async () => {
    const repository = new InMemorySchoolRepository();
    const auditSink = { record: vi.fn() };
    const service = new SchoolService({
      repository,
      auditSink,
      clock: createClock,
      idFactory: () => "domain-1"
    });

    await repository.createSchool({
      id: "school-1",
      name: "Alpha Academy",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: "platform-1"
    });

    await service.updateSettings({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      timezone: "Africa/Lagos",
      locale: "en-NG",
      academicSessionDefaults: {
        startMonth: 9
      },
      platformConfiguration: {
        allowPublicAnnouncements: false
      }
    });

    await service.updateTheme({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      logo: "https://cdn.example.com/logo.svg",
      primaryColor: "#112233",
      secondaryColor: "#445566",
      brandingConfiguration: {
        footerText: "Alpha Academy"
      }
    });

    const domain = await service.addDomain({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      host: "alpha.example.com",
      hostType: "custom_domain"
    });

    await service.verifyDomain({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      domainId: domain.id,
      verifiedBy: "school-admin-1"
    });

    await service.activateDomain({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      domainId: domain.id
    });

    await service.deactivateDomain({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      domainId: domain.id
    });

    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.settings.updated"
      })
    );
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.theme.updated"
      })
    );
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.domain.created"
      })
    );
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.domain.verified"
      })
    );
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.domain.activated"
      })
    );
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "school.domain.deactivated"
      })
    );
  });

  it("prevents duplicate host mappings and orders domains for resolution", async () => {
    const domainIds = ["domain-1", "domain-2", "domain-3"];
    const repository = new InMemorySchoolRepository();
    const service = new SchoolService({
      repository,
      clock: createClock,
      idFactory: () => {
        const id = domainIds.shift();

        if (!id) {
          throw new Error("No domain id available");
        }

        return id;
      }
    });

    await repository.createSchool({
      id: "school-1",
      name: "Alpha Academy",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: "platform-1"
    });
    await repository.createSchool({
      id: "school-2",
      name: "Beta Academy",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: "platform-1"
    });

    await service.addDomain({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      host: "alpha.example.com",
      hostType: "custom_domain"
    });

    const verifiedDomain = await service.verifyDomain({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      domainId: "domain-1",
      verifiedBy: "school-admin-1"
    });

    await expect(
      service.addDomain({
        actor: createSchoolAdminActor("school-2"),
        schoolId: "school-2",
        host: "alpha.example.com",
        hostType: "custom_domain"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "school_domain_conflict"
    });

    const subdomain = await service.addDomain({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      host: "alpha.example.org",
      hostType: "subdomain",
      subdomain: "alpha"
    });

    const domains = await service.listDomains(createSchoolAdminActor("school-1"), "school-1");

    expect(domains[0]?.hostType).toBe("custom_domain");
    expect(domains[0]?.verificationStatus).toBe("verified");
    expect(domains[1]?.id).toBe(subdomain.id);
    expect(verifiedDomain.verificationStatus).toBe("verified");
  });
});

describe("School routes", () => {
  it("supports tenant-scoped school updates through the Fastify route layer", async () => {
    const repository = new InMemorySchoolRepository();
    const auditSink = { record: vi.fn() };
    const service = new SchoolService({
      repository,
      auditSink,
      clock: createClock,
      idFactory: () => "school-1"
    });
    const tenantContext = {
      schoolId: "school-1",
      host: "alpha.example.com",
      resolvedBy: "verified_custom_domain" as const,
      schoolDomainId: "domain-1"
    };
    const authContext = {
      sessionId: "session-1" as never,
      userId: "school-admin-1",
      schoolId: "school-1",
      expiresAt: createClock(),
      loginIdentifier: "admin@example.com",
      userStatus: "active" as const
    };

    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve() {
          return tenantContext;
        }
      },
      authService: {
        async validateSession() {
          return { authContext };
        }
      },
      authorizationService: {
        async resolveAuthorizationContext() {
          return {
            userId: authContext.userId,
            schoolId: tenantContext.schoolId,
            roles: ["school_admin"] as const,
            roleAssignments: [
              {
                id: "assignment-1",
                schoolId: tenantContext.schoolId,
                userId: authContext.userId,
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

    await registerSchoolRoutes(app, {
      schoolService: service,
      actorResolver: (request) => {
        const context = request.foundationContext;

        if (!context?.authContext) {
          return {
            actorId: "platform-1",
            roles: ["super_admin"] as const,
            schoolId: null
          } as SchoolActorContext;
        }

        return {
          actorId: context.authContext.userId,
          roles: ["school_admin"] as const,
          schoolId: context.tenantContext?.schoolId ?? null
        } as SchoolActorContext;
      }
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/schools",
      payload: {
        name: "Alpha Academy"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      id: "school-1",
      name: "Alpha Academy",
      status: "pending"
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/schools/school-1/settings",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      },
      payload: {
        timezone: "Africa/Lagos",
        locale: "en-NG",
        academicSessionDefaults: {
          startMonth: 9
        },
        platformConfiguration: {
          allowPublicAnnouncements: true
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schoolId: "school-1",
      timezone: "Africa/Lagos",
      locale: "en-NG"
    });
  });
});
