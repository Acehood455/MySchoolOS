import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import { InMemoryAcademicRepository } from "../academic/academic.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryStudentRepository } from "../student/student.repository.js";
import { InMemoryEnrollmentRepository } from "./enrollment.repository.js";
import { registerEnrollmentRoutes } from "./enrollment.routes.js";
import { EnrollmentService } from "./enrollment.service.js";

function createClock(): Date {
  return new Date("2026-06-20T00:00:00.000Z");
}

function createSequenceFactory(values: string[]) {
  return (prefix: string) => {
    const value = values.shift();

    if (!value) {
      throw new Error("No value available");
    }

    return `${prefix}_${value}`;
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
  const repository = new InMemoryEnrollmentRepository();
  const studentRepository = new InMemoryStudentRepository();
  const academicRepository = new InMemoryAcademicRepository();
  const auditSink = { record: vi.fn() };
  const service = new EnrollmentService({
    repository,
    studentRepository,
    academicRepository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["enrollment-1", "enrollment-2", "history-1", "history-2", "history-3", "history-4"])
  });

  return {
    repository,
    studentRepository,
    academicRepository,
    auditSink,
    service
  };
}

async function seedAcademicData(academicRepository: InMemoryAcademicRepository, schoolId: string) {
  await academicRepository.createAcademicYear({
    id: "year-1",
    schoolId,
    name: "2026/2027",
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: new Date("2027-07-31T00:00:00.000Z"),
    status: "open",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    openedAt: createClock()
  });

  await academicRepository.createClass({
    id: "class-1",
    schoolId,
    academicYearId: "year-1",
    name: "Primary 1",
    status: "active",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    teacherAssignmentIds: []
  });

  await academicRepository.createClass({
    id: "class-2",
    schoolId,
    academicYearId: "year-1",
    name: "Primary 2",
    status: "active",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    teacherAssignmentIds: []
  });
}

describe("EnrollmentService", () => {
  it("creates enrollments, emits audit events, and enforces uniqueness", async () => {
    const { service, studentRepository, academicRepository, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");

    const student = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    const enrollment = await service.createEnrollment({
      actor,
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: new Date("2026-09-01T00:00:00.000Z")
    });

    await expect(
      service.createEnrollment({
        actor,
        schoolId: "school-1",
        studentId: student.id,
        academicYearId: "year-1",
        classId: "class-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "enrollment_active_conflict"
    });

    expect(enrollment.enrollmentStatus).toBe("active");
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "enrollment.created" }));
  });

  it("enforces tenant isolation and lifecycle transitions", async () => {
    const { service, studentRepository, academicRepository } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");
    await seedAcademicData(academicRepository, "school-1");

    const student = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: schoolOneAdmin.actorId,
      activatedAt: createClock()
    });

    const enrollment = await service.createEnrollment({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1"
    });

    await expect(
      service.getEnrollment(schoolTwoAdmin, "school-1", enrollment.id)
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await service.archiveEnrollment(schoolOneAdmin, "school-1", enrollment.id);

    await expect(
      service.updateEnrollment({
        actor: schoolOneAdmin,
        schoolId: "school-1",
        enrollmentId: enrollment.id,
        enrollmentStatus: "active"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "enrollment_lifecycle_invalid_transition"
    });
  });

  it("records immutable movement history for promotion, transfer, and class change", async () => {
    const { service, studentRepository, academicRepository } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");

    const student = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    const enrollment = await service.createEnrollment({
      actor,
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1"
    });

    const promoted = await service.promoteStudent({
      actor,
      schoolId: "school-1",
      enrollmentId: enrollment.id,
      toClassId: "class-2",
      reason: "Next grade"
    });

    const moved = await service.moveStudentBetweenClasses({
      actor,
      schoolId: "school-1",
      enrollmentId: enrollment.id,
      toClassId: "class-1",
      reason: "Schedule correction"
    });

    const transferred = await service.transferStudent({
      actor,
      schoolId: "school-1",
      enrollmentId: enrollment.id,
      toClassId: "class-2",
      reason: "School transfer"
    });

    const historyByStudent = await service.listStudentEnrollmentHistory(actor, "school-1", student.id);
    const historyByClass = await service.listClassEnrollmentHistory(actor, "school-1", "class-2");

    expect(promoted.classId).toBe("class-2");
    expect(moved.classId).toBe("class-1");
    expect(transferred.enrollmentStatus).toBe("transferred");
    expect(historyByStudent.length).toBeGreaterThanOrEqual(4);
    expect(historyByStudent.some((record) => record.eventName === "student.promoted")).toBe(true);
    expect(historyByClass.some((record) => record.eventName === "student.transferred")).toBe(true);
  });

  it("rejects archived students and cross-tenant class enrollments", async () => {
    const { service, studentRepository, academicRepository } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");

    const archivedStudent = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "archived",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    await expect(
      service.createEnrollment({
        actor,
        schoolId: "school-1",
        studentId: archivedStudent.id,
        academicYearId: "year-1",
        classId: "class-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "enrollment_student_archived"
    });

    const activeStudent = await studentRepository.createStudent({
      id: "student-2",
      schoolId: "school-1",
      admissionNumber: "ADM-002",
      firstName: "Ife",
      lastName: "Adebayo",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    await expect(
      service.createEnrollment({
        actor,
        schoolId: "school-1",
        studentId: activeStudent.id,
        academicYearId: "year-1",
        classId: "foreign-class"
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "class_not_found"
    });

    await academicRepository.createClass({
      id: "foreign-class",
      schoolId: "school-2",
      academicYearId: "foreign-year",
      name: "Foreign",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: "school-admin-2",
      teacherAssignmentIds: []
    });

    await expect(
      service.createEnrollment({
        actor,
        schoolId: "school-1",
        studentId: activeStudent.id,
        academicYearId: "year-1",
        classId: "foreign-class"
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "class_not_found"
    });
  });
});

describe("Enrollment routes", () => {
  it("supports enrollment workflows through the route layer", async () => {
    const { service, studentRepository, academicRepository } = createService();
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

    await seedAcademicData(academicRepository, "school-1");
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

    await registerEnrollmentRoutes(app, {
      enrollmentService: service,
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

    const student = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: authContext.userId,
      activatedAt: createClock()
    });

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/schools/school-1/enrollments",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
          "x-csrf-token": "csrf-1"
        },
        payload: {
          studentId: student.id,
          academicYearId: "year-1",
          classId: "class-1"
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const enrollmentId = createResponse.json().id as string;

      const moveResponse = await app.inject({
        method: "POST",
        url: `/schools/school-1/enrollments/${enrollmentId}/move`,
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
          "x-csrf-token": "csrf-1"
        },
        payload: {
          toClassId: "class-2",
          reason: "Correction"
        }
      });

      expect(moveResponse.statusCode).toBe(200);

      const historyResponse = await app.inject({
        method: "GET",
        url: `/schools/school-1/students/${student.id}/enrollment-history`,
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1"
        }
      });

      expect(historyResponse.statusCode).toBe(200);
      expect(historyResponse.json().length).toBeGreaterThanOrEqual(2);

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

      await registerEnrollmentRoutes(teacherDeniedApp, {
        enrollmentService: service,
        actorResolver: () => createTeacherActor("school-1")
      });

      const deniedResponse = await teacherDeniedApp.inject({
        method: "POST",
        url: "/schools/school-1/enrollments",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1"
        },
        payload: {
          studentId: student.id,
          academicYearId: "year-1",
          classId: "class-1"
        }
      });

      expect(deniedResponse.statusCode).toBe(403);
      expect(deniedResponse.json()).toMatchObject({
        code: "permission_denied"
      });
    } finally {
      await app.close();
    }
  });
});
