import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { StaffService } from "./staff.service.js";
import {
  createStaffRequestSchema,
  createTeacherClassAssignmentRequestSchema,
  createTeacherSubjectAssignmentRequestSchema,
  parseStaffBody,
  parseStaffQuery,
  staffListQuerySchema,
  updateStaffRequestSchema
} from "./staff.schemas.js";

export interface StaffRouteOptions {
  readonly staffService: StaffService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: StaffRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerStaffRoutes(app: FastifyInstance, options: StaffRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/staff",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request, reply) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseStaffBody(createStaffRequestSchema, request.body ?? {}, "staff_create_invalid");

      const staff = await options.staffService.createStaff({
        actor,
        schoolId: params.schoolId ?? "",
        employeeNumber: body.employeeNumber,
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName,
        email: body.email,
        phone: body.phone,
        gender: body.gender,
        dateOfBirth: body.dateOfBirth,
        employmentDate: body.employmentDate,
        roleType: body.roleType,
        metadata: body.metadata
      });

      reply.code(201);
      return staff;
    }
  );

  app.get(
    "/schools/:schoolId/staff",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const query = parseStaffQuery(staffListQuerySchema, request.query ?? {}, "staff_list_invalid");

      const records = await options.staffService.listStaff(actor, params.schoolId ?? "");
      return query.status ? records.filter((record) => record.status === query.status) : records;
    }
  );

  app.get(
    "/schools/:schoolId/staff/:staffId",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.staffService.getStaff(actor, params.schoolId ?? "", params.staffId ?? "");
    }
  );

  app.patch(
    "/schools/:schoolId/staff/:staffId",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseStaffBody(updateStaffRequestSchema, request.body ?? {}, "staff_update_invalid");

      return options.staffService.updateStaff({
        actor,
        schoolId: params.schoolId ?? "",
        staffId: params.staffId ?? "",
        employeeNumber: body.employeeNumber,
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName,
        email: body.email,
        phone: body.phone,
        gender: body.gender,
        dateOfBirth: body.dateOfBirth,
        employmentDate: body.employmentDate,
        roleType: body.roleType,
        status: body.status,
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/staff/:staffId/archive",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.staffService.archiveStaff(actor, params.schoolId ?? "", params.staffId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/staff/:staffId/reactivate",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.staffService.reactivateStaff(actor, params.schoolId ?? "", params.staffId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/staff/:staffId/class-assignments",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request, reply) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseStaffBody(createTeacherClassAssignmentRequestSchema, request.body ?? {}, "teacher_class_assignment_create_invalid");

      const assignment = await options.staffService.assignTeacherToClass({
        actor,
        schoolId: params.schoolId ?? "",
        staffId: params.staffId ?? "",
        classId: body.classId
      });

      reply.code(201);
      return assignment;
    }
  );

  app.get(
    "/schools/:schoolId/staff/:staffId/class-assignments",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.staffService.listTeacherClassAssignments(actor, params.schoolId ?? "", params.staffId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/staff/:staffId/class-assignments/:assignmentId/unassign",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.staffService.removeTeacherClassAssignment(
        actor,
        params.schoolId ?? "",
        params.staffId ?? "",
        params.assignmentId ?? ""
      );
    }
  );

  app.post(
    "/schools/:schoolId/staff/:staffId/subject-assignments",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request, reply) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseStaffBody(createTeacherSubjectAssignmentRequestSchema, request.body ?? {}, "teacher_subject_assignment_create_invalid");

      const assignment = await options.staffService.assignTeacherToSubject({
        actor,
        schoolId: params.schoolId ?? "",
        staffId: params.staffId ?? "",
        subjectId: body.subjectId
      });

      reply.code(201);
      return assignment;
    }
  );

  app.get(
    "/schools/:schoolId/staff/:staffId/subject-assignments",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.staffService.listTeacherSubjectAssignments(actor, params.schoolId ?? "", params.staffId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/staff/:staffId/subject-assignments/:assignmentId/unassign",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "school.manage"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.staffService.removeTeacherSubjectAssignment(
        actor,
        params.schoolId ?? "",
        params.staffId ?? "",
        params.assignmentId ?? ""
      );
    }
  );
}
