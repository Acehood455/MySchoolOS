import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { InMemoryAcademicRepository } from "../academic/academic.repository.js";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import { InMemoryEnrollmentRepository } from "../enrollment/enrollment.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryStudentRepository } from "../student/student.repository.js";
import { InMemoryAttendanceRepository } from "./attendance.repository.js";
import { registerAttendanceRoutes } from "./attendance.routes.js";
import { AttendanceService } from "./attendance.service.js";
import { InMemoryStaffRepository } from "../staff/staff.repository.js";

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

async function seedAcademicData(repository: InMemoryAcademicRepository, schoolId: string) {
  await repository.createAcademicYear({
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

  await repository.createTerm({
    id: "term-1",
    schoolId,
    academicYearId: "year-1",
    name: "Term 1",
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: new Date("2026-12-15T00:00:00.000Z"),
    status: "open",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    openedAt: createClock()
  });

  await repository.createClass({
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

  await repository.createClass({
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

function createService() {
  const attendanceRepository = new InMemoryAttendanceRepository();
  const enrollmentRepository = new InMemoryEnrollmentRepository();
  const studentRepository = new InMemoryStudentRepository();
  const academicRepository = new InMemoryAcademicRepository();
  const staffRepository = new InMemoryStaffRepository();
  const auditSink = { record: vi.fn() };
  const service = new AttendanceService({
    repository: attendanceRepository,
    enrollmentRepository,
    studentRepository,
    academicRepository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["attendance-1", "attendance-2", "attendance-3", "attendance-4", "attendance-5", "attendance-6"]),
    teacherAssignmentResolver: async ({ actorId, schoolId, classId }) => {
      const assignments = await staffRepository.findTeacherClassAssignmentsBySchoolId(schoolId);
      return assignments.some((assignment) => assignment.staffId === actorId && assignment.classId === classId && assignment.status === "active");
    }
  });

  return {
    attendanceRepository,
    enrollmentRepository,
    studentRepository,
    academicRepository,
    staffRepository,
    auditSink,
    service
  };
}

describe("AttendanceService", () => {
  it("marks attendance and enforces duplicate prevention and audit events", async () => {
    const { service, enrollmentRepository, studentRepository, academicRepository, auditSink } = createService();
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

    await enrollmentRepository.createEnrollment({
      id: "enrollment-1",
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    const record = await service.markAttendance({
      actor,
      schoolId: "school-1",
      enrollmentId: "enrollment-1",
      academicYearId: "year-1",
      termId: "term-1",
      classId: "class-1",
      attendanceDate: new Date("2026-09-05T00:00:00.000Z"),
      status: "present"
    });

    await expect(
      service.markAttendance({
        actor,
        schoolId: "school-1",
        enrollmentId: "enrollment-1",
        academicYearId: "year-1",
        termId: "term-1",
        classId: "class-1",
        attendanceDate: new Date("2026-09-05T00:00:00.000Z"),
        status: "present"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "attendance_duplicate"
    });

    expect(record.status).toBe("present");
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "attendance.marked" }));
  });

  it("enforces tenant isolation, archived enrollment rules, and term boundaries", async () => {
    const { service, enrollmentRepository, studentRepository, academicRepository } = createService();
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

    await enrollmentRepository.createEnrollment({
      id: "enrollment-1",
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "archived",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    await expect(
      service.markAttendance({
        actor: schoolOneAdmin,
        schoolId: "school-1",
        enrollmentId: "enrollment-1",
        academicYearId: "year-1",
        termId: "term-1",
        classId: "class-1",
        attendanceDate: new Date("2026-09-05T00:00:00.000Z"),
        status: "present"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "attendance_enrollment_inactive"
    });

    await expect(
      service.getAttendance(schoolTwoAdmin, "school-1", "attendance-missing")
    ).rejects.toMatchObject({
      status: 404,
      code: "attendance_not_found"
    });
  });

  it("supports bulk attendance, summaries, and class-restricted teacher access", async () => {
    const { service, enrollmentRepository, studentRepository, academicRepository, staffRepository } = createService();
    const admin = createSchoolAdminActor("school-1");
    const teacher = createTeacherActor("school-1");
    await seedAcademicData(academicRepository, "school-1");

    await staffRepository.createStaff({
      id: admin.actorId,
      schoolId: "school-1",
      employeeNumber: "EMP-001",
      firstName: "Tola",
      lastName: "Bello",
      roleType: "teacher",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: admin.actorId,
      activatedAt: createClock()
    });

    await staffRepository.createTeacherClassAssignment({
      id: "assignment-1",
      schoolId: "school-1",
      staffId: teacher.actorId,
      classId: "class-1",
      status: "active",
      assignedAt: createClock(),
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: admin.actorId
    });

    const studentOne = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: admin.actorId,
      activatedAt: createClock()
    });

    const studentTwo = await studentRepository.createStudent({
      id: "student-2",
      schoolId: "school-1",
      admissionNumber: "ADM-002",
      firstName: "Ife",
      lastName: "Adebayo",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: admin.actorId,
      activatedAt: createClock()
    });

    await enrollmentRepository.createEnrollment({
      id: "enrollment-1",
      schoolId: "school-1",
      studentId: studentOne.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    await enrollmentRepository.createEnrollment({
      id: "enrollment-2",
      schoolId: "school-1",
      studentId: studentTwo.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    const bulk = await service.markClassAttendance({
      actor: admin,
      schoolId: "school-1",
      academicYearId: "year-1",
      termId: "term-1",
      classId: "class-1",
      attendanceDate: new Date("2026-09-08T00:00:00.000Z"),
      entries: [
        { enrollmentId: "enrollment-1", status: "present" },
        { enrollmentId: "enrollment-2", status: "late" }
      ]
    });

    const summary = await service.getAttendanceSummary({
      actor: admin,
      schoolId: "school-1",
      classId: "class-1",
      academicYearId: "year-1",
      termId: "term-1"
    });

    const teacherHistory = await service.getClassAttendanceHistory(teacher, "school-1", "class-1");

    expect(bulk).toHaveLength(2);
    expect(summary.totalDays).toBe(2);
    expect(summary.presentDays).toBe(1);
    expect(summary.lateDays).toBe(1);
    expect(summary.attendancePercentage).toBe(100);
    expect(teacherHistory).toHaveLength(2);
  });
});

describe("Attendance routes", () => {
  it("supports attendance workflows through the route layer", async () => {
    const { service, enrollmentRepository, studentRepository, academicRepository, staffRepository } = createService();
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

    await registerAttendanceRoutes(app, {
      attendanceService: service,
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

    await enrollmentRepository.createEnrollment({
      id: "enrollment-1",
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    await staffRepository.createStaff({
      id: authContext.userId,
      schoolId: "school-1",
      employeeNumber: "EMP-001",
      firstName: "Tola",
      lastName: "Bello",
      roleType: "teacher",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: authContext.userId,
      activatedAt: createClock()
    });

    await staffRepository.createTeacherClassAssignment({
      id: "assignment-1",
      schoolId: "school-1",
      staffId: authContext.userId,
      classId: "class-1",
      status: "active",
      assignedAt: createClock(),
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: authContext.userId
    });

    try {
      const markResponse = await app.inject({
        method: "POST",
        url: "/schools/school-1/attendance",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
          "x-csrf-token": "csrf-1"
        },
        payload: {
          enrollmentId: "enrollment-1",
          academicYearId: "year-1",
          termId: "term-1",
          classId: "class-1",
          attendanceDate: "2026-09-05",
          status: "present"
        }
      });

      expect(markResponse.statusCode).toBe(201);

      const summaryResponse = await app.inject({
        method: "GET",
        url: "/schools/school-1/attendance/summary?classId=class-1&academicYearId=year-1&termId=term-1",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1"
        }
      });

      expect(summaryResponse.statusCode).toBe(200);
      expect(summaryResponse.json()).toMatchObject({
        totalDays: 1,
        presentDays: 1
      });
    } finally {
      await app.close();
    }
  });
});
