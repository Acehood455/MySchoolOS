import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import { InMemoryStudentRepository } from "../student/student.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryParentRepository } from "./parent.repository.js";
import { registerParentRoutes } from "./parent.routes.js";
import { ParentService } from "./parent.service.js";

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
  const repository = new InMemoryParentRepository();
  const studentRepository = new InMemoryStudentRepository();
  const auditSink = { record: vi.fn() };
  const service = new ParentService({
    repository,
    studentRepository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["parent-1", "parent-2", "link-1", "link-2", "link-3"])
  });

  return {
    repository,
    studentRepository,
    auditSink,
    service
  };
}

describe("ParentService", () => {
  it("manages parent lifecycle and link audit events", async () => {
    const { service, auditSink, studentRepository } = createService();
    const actor = createSchoolAdminActor("school-1");

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

    const parent = await service.createParent({
      actor,
      schoolId: "school-1",
      firstName: "Grace",
      lastName: "Okafor",
      email: "grace@example.com",
      phone: "+234 800 000 0000",
      address: "1 School Lane",
      occupation: "Trader",
      relationshipType: "mother"
    });

    const updated = await service.updateParent({
      actor,
      schoolId: "school-1",
      parentId: parent.id,
      firstName: "Gracey",
      status: "inactive"
    });

    const reactivated = await service.reactivateParent(actor, "school-1", parent.id);
    const linked = await service.linkParentToStudent({
      actor,
      schoolId: "school-1",
      parentId: parent.id,
      studentId: student.id
    });
    const unlinked = await service.unlinkParentFromStudent({
      actor,
      schoolId: "school-1",
      parentId: parent.id,
      studentId: student.id
    });
    const archived = await service.archiveParent(actor, "school-1", parent.id);

    expect(updated.status).toBe("inactive");
    expect(reactivated.status).toBe("active");
    expect(linked.status).toBe("active");
    expect(unlinked.status).toBe("archived");
    expect(archived.status).toBe("archived");

    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "parent.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "parent.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "parent.reactivated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "parent.student.linked" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "parent.student.unlinked" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "parent.archived" }));
  });

  it("enforces tenant isolation, lifecycle transitions, and duplicate prevention", async () => {
    const { service, studentRepository } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");

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

    const parent = await service.createParent({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      firstName: "Grace",
      lastName: "Okafor",
      email: "grace@example.com",
      relationshipType: "mother"
    });

    await expect(
      service.createParent({
        actor: schoolOneAdmin,
        schoolId: "school-1",
        firstName: "Ife",
        lastName: "Adebayo",
        email: "GRACE@EXAMPLE.COM",
        relationshipType: "guardian"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "parent_email_conflict"
    });

    await expect(service.getParent(schoolTwoAdmin, "school-1", parent.id)).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await service.updateParent({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      parentId: parent.id,
      status: "inactive"
    });

    await expect(service.reactivateParent(schoolOneAdmin, "school-1", parent.id)).resolves.toMatchObject({
      status: "active"
    });

    await service.archiveParent(schoolOneAdmin, "school-1", parent.id);

    await expect(
      service.updateParent({
        actor: schoolOneAdmin,
        schoolId: "school-1",
        parentId: parent.id,
        firstName: "Blocked"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "parent_archived"
    });

    await expect(
      service.linkParentToStudent({
        actor: schoolOneAdmin,
        schoolId: "school-1",
        parentId: parent.id,
        studentId: student.id
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "parent_link_invalid_state"
    });
  });

  it("links parents to students and prevents duplicate active links", async () => {
    const { service, studentRepository } = createService();
    const actor = createSchoolAdminActor("school-1");

    const parent = await service.createParent({
      actor,
      schoolId: "school-1",
      firstName: "Grace",
      lastName: "Okafor",
      relationshipType: "mother"
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
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    const link = await service.linkParentToStudent({
      actor,
      schoolId: "school-1",
      parentId: parent.id,
      studentId: student.id
    });

    await expect(
      service.linkParentToStudent({
        actor,
        schoolId: "school-1",
        parentId: parent.id,
        studentId: student.id
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "parent_student_link_conflict"
    });

    const linksForParent = await service.listLinksForParent(actor, "school-1", parent.id);
    const linksForStudent = await service.listLinksForStudent(actor, "school-1", student.id);

    expect(link.status).toBe("active");
    expect(linksForParent).toHaveLength(1);
    expect(linksForStudent).toHaveLength(1);
  });

  it("rejects archived student links and only allows inactive parents to reactivate", async () => {
    const { service, studentRepository } = createService();
    const actor = createSchoolAdminActor("school-1");

    const parent = await service.createParent({
      actor,
      schoolId: "school-1",
      firstName: "Grace",
      lastName: "Okafor",
      relationshipType: "mother"
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
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    await service.archiveParent(actor, "school-1", parent.id);

    await expect(
      service.linkParentToStudent({
        actor,
        schoolId: "school-1",
        parentId: parent.id,
        studentId: student.id
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "parent_link_invalid_state"
    });

    const archivedStudent = await studentRepository.createStudent({
      id: "student-archived",
      schoolId: "school-1",
      admissionNumber: "ADM-002",
      firstName: "Tola",
      lastName: "Adewale",
      status: "archived",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    const activeParent = await service.createParent({
      actor,
      schoolId: "school-1",
      firstName: "Ayo",
      lastName: "Okon",
      relationshipType: "guardian"
    });

    await expect(
      service.linkParentToStudent({
        actor,
        schoolId: "school-1",
        parentId: activeParent.id,
        studentId: archivedStudent.id
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "parent_link_invalid_state"
    });

    const foreignStudent = await studentRepository.createStudent({
      id: "student-foreign",
      schoolId: "school-2",
      admissionNumber: "ADM-003",
      firstName: "Timi",
      lastName: "Bello",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    await expect(
      service.linkParentToStudent({
        actor,
        schoolId: "school-1",
        parentId: activeParent.id,
        studentId: foreignStudent.id
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "student_not_found"
    });

    await expect(service.reactivateParent(actor, "school-1", parent.id)).rejects.toMatchObject({
      status: 409,
      code: "parent_lifecycle_invalid_transition"
    });
  });
});

describe("Parent routes", () => {
  it("supports parent management and links through the route layer", async () => {
    const { service, studentRepository } = createService();
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

    await registerParentRoutes(app, {
      parentService: service,
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
        url: "/schools/school-1/parents",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
          "x-csrf-token": "csrf-1"
        },
        payload: {
          firstName: "Grace",
          lastName: "Okafor",
          email: "grace@example.com",
          relationshipType: "mother"
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const parentId = createResponse.json().id as string;

      const linkResponse = await app.inject({
        method: "POST",
        url: `/schools/school-1/parents/${parentId}/students/${student.id}/link`,
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1; myschoolos_csrf=csrf-1",
          "x-csrf-token": "csrf-1"
        }
      });

      expect(linkResponse.statusCode).toBe(201);

      const listResponse = await app.inject({
        method: "GET",
        url: "/schools/school-1/parents",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1"
        }
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json()).toHaveLength(1);

      const parentLinksResponse = await app.inject({
        method: "GET",
        url: `/schools/school-1/parents/${parentId}/students`,
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1"
        }
      });

      expect(parentLinksResponse.statusCode).toBe(200);
      expect(parentLinksResponse.json()).toHaveLength(1);

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

      await registerParentRoutes(teacherDeniedApp, {
        parentService: service,
        actorResolver: () => createTeacherActor("school-1")
      });

      const deniedResponse = await teacherDeniedApp.inject({
        method: "POST",
        url: "/schools/school-1/parents",
        headers: {
          host: "alpha.example.com",
          cookie: "myschoolos_session=session-1"
        },
        payload: {
          firstName: "Ife",
          lastName: "Adebayo",
          relationshipType: "guardian"
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
