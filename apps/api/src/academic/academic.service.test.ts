import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryAcademicRepository } from "./academic.repository.js";
import { registerAcademicRoutes } from "./academic.routes.js";
import { AcademicService } from "./academic.service.js";

function createClock(): Date {
  return new Date("2026-06-20T00:00:00.000Z");
}

function createSchoolAdminActor(schoolId: string, overrides: Partial<SchoolActorContext> = {}): SchoolActorContext {
  return {
    actorId: "school-admin-1",
    roles: ["school_admin"],
    schoolId,
    ...overrides
  };
}

function createTeacherActor(schoolId: string): SchoolActorContext {
  return {
    actorId: "teacher-1",
    roles: ["teacher"],
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

function createService() {
  const repository = new InMemoryAcademicRepository();
  const auditSink = { record: vi.fn() };
  const service = new AcademicService({
    repository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["year-1", "term-1", "class-1", "subject-1"])
  });

  return {
    repository,
    auditSink,
    service
  };
}

describe("AcademicService", () => {
  it("enforces academic year, term, class, and subject lifecycles with audit events", async () => {
    const { service, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");

    const academicYear = await service.createAcademicYear({
      actor,
      schoolId: "school-1",
      name: "2026/2027 Academic Year",
      code: "AY-2026-2027",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-07-31T00:00:00.000Z")
    });

    const updatedAcademicYear = await service.updateAcademicYear({
      actor,
      schoolId: "school-1",
      academicYearId: academicYear.id,
      name: "2026/2027 Session",
      code: "AY-2026-2027"
    });

    const openAcademicYear = await service.activateAcademicYear(actor, "school-1", academicYear.id);

    const term = await service.createTerm({
      actor,
      schoolId: "school-1",
      academicYearId: academicYear.id,
      name: "First Term",
      code: "T1",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-12-15T00:00:00.000Z")
    });

    const updatedTerm = await service.updateTerm({
      actor,
      schoolId: "school-1",
      academicYearId: academicYear.id,
      termId: term.id,
      name: "Term One",
      code: "T1"
    });

    const openTerm = await service.activateTerm(actor, "school-1", academicYear.id, term.id);
    const closedTerm = await service.closeTerm(actor, "school-1", academicYear.id, term.id);
    const archivedTerm = await service.archiveTerm(actor, "school-1", academicYear.id, term.id);

    const classRecord = await service.createClass({
      actor,
      schoolId: "school-1",
      academicYearId: academicYear.id,
      name: "JSS1",
      code: "JSS1"
    });

    const updatedClass = await service.updateClass({
      actor,
      schoolId: "school-1",
      academicYearId: academicYear.id,
      classId: classRecord.id,
      name: "JSS 1",
      code: "JSS1"
    });

    const archivedClass = await service.archiveClass(actor, "school-1", academicYear.id, classRecord.id);

    const subject = await service.createSubject({
      actor,
      schoolId: "school-1",
      name: "Mathematics",
      code: "MATH"
    });

    const updatedSubject = await service.updateSubject({
      actor,
      schoolId: "school-1",
      subjectId: subject.id,
      name: "Core Mathematics",
      code: "MATH"
    });

    const archivedSubject = await service.archiveSubject(actor, "school-1", subject.id);
    const closedAcademicYear = await service.closeAcademicYear(actor, "school-1", academicYear.id);
    const archivedAcademicYear = await service.archiveAcademicYear(actor, "school-1", academicYear.id);

    expect(updatedAcademicYear.status).toBe("planned");
    expect(openAcademicYear.status).toBe("open");
    expect(updatedTerm.status).toBe("planned");
    expect(openTerm.status).toBe("open");
    expect(closedTerm.status).toBe("closed");
    expect(archivedTerm.status).toBe("archived");
    expect(updatedClass.status).toBe("draft");
    expect(archivedClass.status).toBe("archived");
    expect(updatedSubject.status).toBe("draft");
    expect(archivedSubject.status).toBe("archived");
    expect(closedAcademicYear.status).toBe("closed");
    expect(archivedAcademicYear.status).toBe("archived");

    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "academic_year.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "academic_year.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "academic_year.activated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "academic_year.closed" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "academic_year.archived" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "term.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "term.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "term.activated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "term.closed" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "term.archived" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "class.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "class.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "class.archived" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "subject.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "subject.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "subject.archived" }));
  });

  it("enforces tenant isolation and authorization boundaries", async () => {
    const { service } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");

    const academicYear = await service.createAcademicYear({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      name: "2026/2027 Academic Year",
      code: "AY-2026-2027",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-07-31T00:00:00.000Z")
    });

    await expect(
      service.updateAcademicYear({
        actor: schoolTwoAdmin,
        schoolId: "school-1",
        academicYearId: academicYear.id,
        name: "Intrusion"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.listClasses(createTeacherActor("school-1"), "school-1")
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.activateAcademicYear(schoolOneAdmin, "school-2", academicYear.id)
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });
  });
});

describe("Academic routes", () => {
  it("supports academic structure workflows through the route layer", async () => {
    const { service } = createService();
    const app = fastify();
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

    await registerAcademicRoutes(app, {
      academicService: service,
      actorResolver: (request) => {
        const context = request.foundationContext;

        if (!context?.authorizationContext || !context.tenantContext) {
          return null;
        }

        return {
          actorId: context.authContext?.userId ?? "unknown",
          roles: context.authorizationContext.roles,
          schoolId: context.tenantContext.schoolId
        };
      }
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/schools/school-1/academic-years",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      },
      payload: {
        name: "2026/2027 Academic Year",
        code: "AY-2026-2027",
        startDate: "2026-09-01",
        endDate: "2027-07-31"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const academicYearId = createResponse.json().id as string;

    const teacherDeniedApp = fastify();

    await registerFoundationPlugin(teacherDeniedApp, {
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
            roles: ["teacher"] as const,
            roleAssignments: [],
            invalidRoleAssignments: []
          };
        }
      },
      cookieName: "myschoolos_session"
    });

    await registerAcademicRoutes(teacherDeniedApp, {
      academicService: service,
      actorResolver: () => createTeacherActor("school-1")
    });

    const deniedResponse = await teacherDeniedApp.inject({
      method: "GET",
      url: "/schools/school-1/academic-years",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1"
      }
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(deniedResponse.json()).toMatchObject({
      code: "permission_denied"
    });

    const crossTenantResponse = await app.inject({
      method: "PATCH",
      url: `/schools/school-2/academic-years/${academicYearId}`,
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      },
      payload: {
        name: "Cross Tenant Attempt"
      }
    });

    expect(crossTenantResponse.statusCode).toBe(403);
    expect(crossTenantResponse.json()).toMatchObject({
      code: "permission_denied"
    });
  });

  it("lists terms with Zod-validated query parameters", async () => {
    const { service } = createService();
    const app = fastify();
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

    await registerAcademicRoutes(app, {
      academicService: service,
      actorResolver: () => createSchoolAdminActor("school-1")
    });

    const academicYear = await service.createAcademicYear({
      actor: createSchoolAdminActor("school-1"),
      schoolId: "school-1",
      name: "2026/2027 Academic Year",
      code: "AY-2026-2027",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-07-31T00:00:00.000Z")
    });

    const response = await app.inject({
      method: "GET",
      url: `/schools/school-1/terms?academicYearId=${academicYear.id}`,
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
