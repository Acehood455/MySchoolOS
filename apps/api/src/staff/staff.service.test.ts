import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryStaffRepository } from "./staff.repository.js";
import { registerStaffRoutes } from "./staff.routes.js";
import { StaffService } from "./staff.service.js";

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
  const repository = new InMemoryStaffRepository();
  const auditSink = { record: vi.fn() };
  const classes = new Map<string, { readonly id: string; readonly schoolId: string }>();
  const subjects = new Map<string, { readonly id: string; readonly schoolId: string }>();

  classes.set("class-1", { id: "class-1", schoolId: "school-1" });
  classes.set("class-foreign", { id: "class-foreign", schoolId: "school-2" });
  subjects.set("subject-1", { id: "subject-1", schoolId: "school-1" });
  subjects.set("subject-foreign", { id: "subject-foreign", schoolId: "school-2" });

  const service = new StaffService({
    repository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["staff-1", "staff-2", "class-assign-1", "class-assign-2", "subject-assign-1", "subject-assign-2"]),
    classResolver: (classId, schoolId) => {
      const record = classes.get(classId);
      return record && record.schoolId === schoolId ? record : null;
    },
    subjectResolver: (subjectId, schoolId) => {
      const record = subjects.get(subjectId);
      return record && record.schoolId === schoolId ? record : null;
    }
  });

  return {
    repository,
    auditSink,
    service
  };
}

describe("StaffService", () => {
  it("manages staff lifecycle transitions and emits audit events", async () => {
    const { service, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");

    const staff = await service.createStaff({
      actor,
      schoolId: "school-1",
      employeeNumber: "EMP-001",
      firstName: "Ada",
      lastName: "Okafor",
      roleType: "teacher",
      email: "ada@example.com",
      employmentDate: new Date("2026-09-01T00:00:00.000Z")
    });

    const updated = await service.updateStaff({
      actor,
      schoolId: "school-1",
      staffId: staff.id,
      firstName: "Adanna",
      status: "inactive"
    });

    const reactivated = await service.reactivateStaff(actor, "school-1", staff.id);
    const archived = await service.archiveStaff(actor, "school-1", staff.id);

    expect(updated.status).toBe("inactive");
    expect(reactivated.status).toBe("active");
    expect(archived.status).toBe("archived");

    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "staff.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "staff.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "staff.reactivated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "staff.archived" }));
  });

  it("enforces employee number uniqueness, tenant isolation, and invalid lifecycle transitions", async () => {
    const { service } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");

    const staff = await service.createStaff({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      employeeNumber: "EMP-001",
      firstName: "Ada",
      lastName: "Okafor",
      roleType: "teacher"
    });

    await expect(
      service.createStaff({
        actor: schoolOneAdmin,
        schoolId: "school-1",
        employeeNumber: "EMP-001",
        firstName: "Ife",
        lastName: "Adebayo",
        roleType: "administrator"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "staff_employee_conflict"
    });

    await expect(
      service.updateStaff({
        actor: schoolTwoAdmin,
        schoolId: "school-1",
        staffId: staff.id,
        firstName: "Intruder"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await service.archiveStaff(schoolOneAdmin, "school-1", staff.id);

    await expect(service.reactivateStaff(schoolOneAdmin, "school-1", staff.id)).rejects.toMatchObject({
      status: 409,
      code: "staff_lifecycle_invalid_transition"
    });
  });

  it("creates and removes teacher assignments while preventing duplicates", async () => {
    const { service, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");

    const teacher = await service.createStaff({
      actor,
      schoolId: "school-1",
      employeeNumber: "EMP-001",
      firstName: "Ada",
      lastName: "Okafor",
      roleType: "teacher"
    });

    const classAssignment = await service.assignTeacherToClass({
      actor,
      schoolId: "school-1",
      staffId: teacher.id,
      classId: "class-1"
    });

    const subjectAssignment = await service.assignTeacherToSubject({
      actor,
      schoolId: "school-1",
      staffId: teacher.id,
      subjectId: "subject-1"
    });

    await expect(
      service.assignTeacherToClass({
        actor,
        schoolId: "school-1",
        staffId: teacher.id,
        classId: "class-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "teacher_class_assignment_conflict"
    });

    await expect(
      service.assignTeacherToSubject({
        actor,
        schoolId: "school-1",
        staffId: teacher.id,
        subjectId: "subject-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "teacher_subject_assignment_conflict"
    });

    const removedClassAssignment = await service.removeTeacherClassAssignment(actor, "school-1", teacher.id, classAssignment.id);
    const removedSubjectAssignment = await service.removeTeacherSubjectAssignment(actor, "school-1", teacher.id, subjectAssignment.id);

    expect(removedClassAssignment.status).toBe("removed");
    expect(removedSubjectAssignment.status).toBe("removed");

    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "teacher.class.assigned" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "teacher.class.unassigned" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "teacher.subject.assigned" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "teacher.subject.unassigned" }));
  });

  it("rejects non-teacher assignments and cross-tenant assignment targets", async () => {
    const { service } = createService();
    const actor = createSchoolAdminActor("school-1");

    const adminStaff = await service.createStaff({
      actor,
      schoolId: "school-1",
      employeeNumber: "EMP-002",
      firstName: "Tunde",
      lastName: "Bello",
      roleType: "administrator"
    });

    await expect(
      service.assignTeacherToClass({
        actor,
        schoolId: "school-1",
        staffId: adminStaff.id,
        classId: "class-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "staff_assignment_invalid_role"
    });

    const teacher = await service.createStaff({
      actor,
      schoolId: "school-1",
      employeeNumber: "EMP-003",
      firstName: "Ada",
      lastName: "Okafor",
      roleType: "teacher"
    });

    await expect(
      service.assignTeacherToClass({
        actor,
        schoolId: "school-1",
        staffId: teacher.id,
        classId: "class-foreign"
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "teacher_class_assignment_class_not_found"
    });

    await expect(
      service.assignTeacherToSubject({
        actor,
        schoolId: "school-1",
        staffId: teacher.id,
        subjectId: "subject-foreign"
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "teacher_subject_assignment_subject_not_found"
    });
  });
});

describe("Staff routes", () => {
  it("supports staff workflows through the route layer", async () => {
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

    await registerStaffRoutes(app, {
      staffService: service,
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

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/schools/school-1/staff",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
          "x-csrf-token": "csrf-1"
        },
        payload: {
          employeeNumber: "EMP-001",
          firstName: "Ada",
          lastName: "Okafor",
          roleType: "teacher"
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const staffId = createResponse.json().id as string;

      const assignmentResponse = await app.inject({
        method: "POST",
        url: `/schools/school-1/staff/${staffId}/class-assignments`,
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
          "x-csrf-token": "csrf-1"
        },
        payload: {
          classId: "class-1"
        }
      });

      expect(assignmentResponse.statusCode).toBe(201);

      const listResponse = await app.inject({
        method: "GET",
        url: "/schools/school-1/staff",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1"
        }
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json()).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
