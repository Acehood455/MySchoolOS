import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryStudentRepository } from "./student.repository.js";
import { registerStudentRoutes } from "./student.routes.js";
import { StudentService } from "./student.service.js";

function createClock(): Date {
  return new Date("2026-06-20T00:00:00.000Z");
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

function createService() {
  const repository = new InMemoryStudentRepository();
  const auditSink = { record: vi.fn() };
  const service = new StudentService({
    repository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["student-1", "student-2", "student-3", "student-4"])
  });

  return {
    repository,
    auditSink,
    service
  };
}

describe("StudentService", () => {
  it("manages student lifecycle transitions and audit events", async () => {
    const { service, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");

    const student = await service.createStudent({
      actor,
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      gender: "female",
      dateOfBirth: new Date("2012-03-01T00:00:00.000Z"),
      admissionDate: new Date("2026-09-01T00:00:00.000Z"),
      contactInformation: {
        phone: "08012345678"
      },
      address: {
        line1: "1 School Lane"
      },
      profilePhotoReference: "photo-1"
    });

    const updated = await service.updateStudent({
      actor,
      schoolId: "school-1",
      studentId: student.id,
      firstName: "Adanna",
      status: "inactive"
    });

    const reactivated = await service.reactivateStudent(actor, "school-1", student.id);
    const graduated = await service.graduateStudent(actor, "school-1", student.id);

    const withdrawnStudent = await service.createStudent({
      actor,
      schoolId: "school-1",
      admissionNumber: "ADM-002",
      firstName: "Tunde",
      lastName: "Bello",
      admissionDate: new Date("2026-09-01T00:00:00.000Z")
    });

    const withdrawn = await service.withdrawStudent(actor, "school-1", withdrawnStudent.id);
    const archived = await service.archiveStudent(actor, "school-1", withdrawnStudent.id);

    expect(updated.status).toBe("inactive");
    expect(reactivated.status).toBe("active");
    expect(graduated.status).toBe("graduated");
    expect(withdrawn.status).toBe("withdrawn");
    expect(archived.status).toBe("archived");

    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "student.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "student.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "student.reactivated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "student.graduated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "student.withdrawn" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "student.archived" }));
  });

  it("enforces admission uniqueness, tenant isolation, and invalid transitions", async () => {
    const { service } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");

    const student = await service.createStudent({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor"
    });

    await expect(
      service.createStudent({
        actor: schoolOneAdmin,
        schoolId: "school-1",
        admissionNumber: "ADM-001",
        firstName: "Ife",
        lastName: "Adebayo"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "student_admission_conflict"
    });

    await expect(
      service.updateStudent({
        actor: schoolTwoAdmin,
        schoolId: "school-1",
        studentId: student.id,
        firstName: "Intruder"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await service.archiveStudent(schoolOneAdmin, "school-1", student.id);

    await expect(service.reactivateStudent(schoolOneAdmin, "school-1", student.id)).rejects.toMatchObject({
      status: 409,
      code: "student_lifecycle_invalid_transition"
    });
  });

  it("searches, filters, and lists students", async () => {
    const { service } = createService();
    const actor = createSchoolAdminActor("school-1");

    const active = await service.createStudent({
      actor,
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor"
    });

    const inactive = await service.createStudent({
      actor,
      schoolId: "school-1",
      admissionNumber: "ADM-002",
      firstName: "Ife",
      lastName: "Adebayo"
    });

    await service.updateStudent({
      actor,
      schoolId: "school-1",
      studentId: inactive.id,
      status: "inactive"
    });

    const listed = await service.listStudents({
      actor,
      schoolId: "school-1",
      search: "ada"
    });

    const filteredByStatus = await service.listStudents({
      actor,
      schoolId: "school-1",
      status: "inactive"
    });

    const filteredByAdmission = await service.listStudents({
      actor,
      schoolId: "school-1",
      admissionNumber: "ADM-001"
    });

    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(active.id);
    expect(filteredByStatus).toHaveLength(1);
    expect(filteredByStatus[0]?.id).toBe(inactive.id);
    expect(filteredByAdmission).toHaveLength(1);
    expect(filteredByAdmission[0]?.id).toBe(active.id);
  });
});

describe("Student routes", () => {
  it("supports the student management workflow through the route layer", async () => {
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

    await registerStudentRoutes(app, {
      studentService: service,
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
      url: "/schools/school-1/students",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      },
      payload: {
        admissionNumber: "ADM-001",
        firstName: "Ada",
        lastName: "Okafor",
        admissionDate: "2026-09-01"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const studentId = createResponse.json().id as string;

    const listResponse = await app.inject({
      method: "GET",
      url: "/schools/school-1/students?search=ada",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1"
      }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);

    const retrieveResponse = await app.inject({
      method: "GET",
      url: `/schools/school-1/students/${studentId}`,
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1"
      }
    });

    expect(retrieveResponse.statusCode).toBe(200);
    expect(retrieveResponse.json()).toMatchObject({
      admissionNumber: "ADM-001",
      firstName: "Ada"
    });

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

    await registerStudentRoutes(teacherDeniedApp, {
      studentService: service,
      actorResolver: () => createTeacherActor("school-1")
    });

    const deniedResponse = await teacherDeniedApp.inject({
      method: "POST",
      url: "/schools/school-1/students",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1"
      },
      payload: {
        admissionNumber: "ADM-002",
        firstName: "Ife",
        lastName: "Adebayo"
      }
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(deniedResponse.json()).toMatchObject({
      code: "permission_denied"
    });

    const crossTenantResponse = await app.inject({
      method: "PATCH",
      url: `/schools/school-2/students/${studentId}`,
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
        "x-csrf-token": "csrf-1"
      },
      payload: {
        firstName: "Cross Tenant"
      }
    });

    expect(crossTenantResponse.statusCode).toBe(403);
    expect(crossTenantResponse.json()).toMatchObject({
      code: "permission_denied"
    });
  });
});
