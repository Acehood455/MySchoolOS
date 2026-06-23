import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { StudentService } from "./student.service.js";
import {
  createStudentRequestSchema,
  parseStudentBody,
  parseStudentQuery,
  studentListQuerySchema,
  updateStudentRequestSchema
} from "./student.schemas.js";

export interface StudentRouteOptions {
  readonly studentService: StudentService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): { readonly schoolId?: string; readonly studentId?: string } {
  return request.params as { readonly schoolId?: string; readonly studentId?: string };
}

async function resolveActor(request: FastifyRequest, options: StudentRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerStudentRoutes(app: FastifyInstance, options: StudentRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/students",
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
      const body = parseStudentBody(createStudentRequestSchema, request.body ?? {}, "student_create_invalid");

      const student = await options.studentService.createStudent({
        actor,
        schoolId: params.schoolId ?? "",
        admissionNumber: body.admissionNumber,
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName,
        gender: body.gender,
        dateOfBirth: body.dateOfBirth,
        admissionDate: body.admissionDate,
        contactInformation: body.contactInformation,
        address: body.address,
        profilePhotoReference: body.profilePhotoReference,
        metadata: body.metadata
      });

      reply.code(201);
      return student;
    }
  );

  app.get(
    "/schools/:schoolId/students",
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
      const query = parseStudentQuery(studentListQuerySchema, request.query ?? {}, "student_list_invalid");

      return options.studentService.listStudents({
        actor,
        schoolId: params.schoolId ?? "",
        search: query.search,
        admissionNumber: query.admissionNumber,
        status: query.status
      });
    }
  );

  app.get(
    "/schools/:schoolId/students/:studentId",
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

      return options.studentService.retrieveStudent(actor, params.schoolId ?? "", params.studentId ?? "");
    }
  );

  app.patch(
    "/schools/:schoolId/students/:studentId",
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
      const body = parseStudentBody(updateStudentRequestSchema, request.body ?? {}, "student_update_invalid");

      return options.studentService.updateStudent({
        actor,
        schoolId: params.schoolId ?? "",
        studentId: params.studentId ?? "",
        admissionNumber: body.admissionNumber,
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName,
        gender: body.gender,
        dateOfBirth: body.dateOfBirth,
        admissionDate: body.admissionDate,
        contactInformation: body.contactInformation,
        address: body.address,
        profilePhotoReference: body.profilePhotoReference,
        status: body.status,
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/students/:studentId/archive",
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

      return options.studentService.archiveStudent(actor, params.schoolId ?? "", params.studentId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/students/:studentId/reactivate",
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

      return options.studentService.reactivateStudent(actor, params.schoolId ?? "", params.studentId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/students/:studentId/graduate",
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

      return options.studentService.graduateStudent(actor, params.schoolId ?? "", params.studentId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/students/:studentId/withdraw",
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

      return options.studentService.withdrawStudent(actor, params.schoolId ?? "", params.studentId ?? "");
    }
  );
}
