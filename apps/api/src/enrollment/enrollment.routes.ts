import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { EnrollmentService } from "./enrollment.service.js";
import {
  createEnrollmentRequestSchema,
  enrollmentListRequestSchema,
  movementRequestSchema,
  parseEnrollmentBody,
  parseEnrollmentQuery,
  updateEnrollmentRequestSchema
} from "./enrollment.schemas.js";

export interface EnrollmentRouteOptions {
  readonly enrollmentService: EnrollmentService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: EnrollmentRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerEnrollmentRoutes(app: FastifyInstance, options: EnrollmentRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/enrollments",
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
      const body = parseEnrollmentBody(createEnrollmentRequestSchema, request.body ?? {}, "enrollment_create_invalid");

      const enrollment = await options.enrollmentService.createEnrollment({
        actor,
        schoolId: params.schoolId ?? "",
        studentId: body.studentId,
        academicYearId: body.academicYearId,
        classId: body.classId,
        admissionDate: body.admissionDate,
        enrollmentStatus: body.enrollmentStatus
      });

      reply.code(201);
      return enrollment;
    }
  );

  app.get(
    "/schools/:schoolId/enrollments",
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
      const query = parseEnrollmentQuery(enrollmentListRequestSchema, request.query ?? {}, "enrollment_list_invalid");

      return options.enrollmentService.listEnrollments({
        actor,
        schoolId: params.schoolId ?? "",
        studentId: query.studentId,
        academicYearId: query.academicYearId,
        classId: query.classId,
        enrollmentStatus: query.enrollmentStatus
      });
    }
  );

  app.get(
    "/schools/:schoolId/enrollments/:enrollmentId",
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

      return options.enrollmentService.getEnrollment(actor, params.schoolId ?? "", params.enrollmentId ?? "");
    }
  );

  app.patch(
    "/schools/:schoolId/enrollments/:enrollmentId",
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
      const body = parseEnrollmentBody(updateEnrollmentRequestSchema, request.body ?? {}, "enrollment_update_invalid");

      return options.enrollmentService.updateEnrollment({
        actor,
        schoolId: params.schoolId ?? "",
        enrollmentId: params.enrollmentId ?? "",
        admissionDate: body.admissionDate,
        enrollmentStatus: body.enrollmentStatus
      });
    }
  );

  app.post(
    "/schools/:schoolId/enrollments/:enrollmentId/archive",
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

      return options.enrollmentService.archiveEnrollment(actor, params.schoolId ?? "", params.enrollmentId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/enrollments/:enrollmentId/promote",
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
      const body = parseEnrollmentBody(movementRequestSchema, request.body ?? {}, "enrollment_promote_invalid");

      return options.enrollmentService.promoteStudent({
        actor,
        schoolId: params.schoolId ?? "",
        enrollmentId: params.enrollmentId ?? "",
        toClassId: body.toClassId,
        movementDate: body.movementDate,
        reason: body.reason
      });
    }
  );

  app.post(
    "/schools/:schoolId/enrollments/:enrollmentId/transfer",
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
      const body = parseEnrollmentBody(movementRequestSchema, request.body ?? {}, "enrollment_transfer_invalid");

      return options.enrollmentService.transferStudent({
        actor,
        schoolId: params.schoolId ?? "",
        enrollmentId: params.enrollmentId ?? "",
        toClassId: body.toClassId,
        movementDate: body.movementDate,
        reason: body.reason
      });
    }
  );

  app.post(
    "/schools/:schoolId/enrollments/:enrollmentId/move",
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
      const body = parseEnrollmentBody(movementRequestSchema, request.body ?? {}, "enrollment_move_invalid");

      return options.enrollmentService.moveStudentBetweenClasses({
        actor,
        schoolId: params.schoolId ?? "",
        enrollmentId: params.enrollmentId ?? "",
        toClassId: body.toClassId,
        movementDate: body.movementDate,
        reason: body.reason
      });
    }
  );

  app.get(
    "/schools/:schoolId/students/:studentId/enrollment-history",
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

      return options.enrollmentService.listStudentEnrollmentHistory(actor, params.schoolId ?? "", params.studentId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/classes/:classId/enrollment-history",
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

      return options.enrollmentService.listClassEnrollmentHistory(actor, params.schoolId ?? "", params.classId ?? "");
    }
  );
}

