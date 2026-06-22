import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { AcademicService } from "./academic.service.js";
import {
  createAcademicYearRequestSchema,
  createClassRequestSchema,
  createSubjectRequestSchema,
  createTermRequestSchema,
  listClassesQuerySchema,
  listTermsQuerySchema,
  parseAcademicBody,
  parseAcademicQuery,
  updateAcademicYearRequestSchema,
  updateClassRequestSchema,
  updateSubjectRequestSchema,
  updateTermRequestSchema
} from "./academic.schemas.js";

export interface AcademicRouteOptions {
  readonly academicService: AcademicService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: AcademicRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerAcademicRoutes(app: FastifyInstance, options: AcademicRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/academic-years",
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
      const body = parseAcademicBody(createAcademicYearRequestSchema, request.body ?? {}, "academic_year_create_invalid");

      const record = await options.academicService.createAcademicYear({
        actor,
        schoolId: params.schoolId ?? "",
        name: body.name,
        code: body.code,
        startDate: body.startDate,
        endDate: body.endDate,
        metadata: body.metadata
      });

      reply.code(201);
      return record;
    }
  );

  app.get(
    "/schools/:schoolId/academic-years",
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

      return options.academicService.listAcademicYears(actor, params.schoolId ?? "");
    }
  );

  app.patch(
    "/schools/:schoolId/academic-years/:academicYearId",
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
      const body = parseAcademicBody(updateAcademicYearRequestSchema, request.body ?? {}, "academic_year_update_invalid");

      return options.academicService.updateAcademicYear({
        actor,
        schoolId: params.schoolId ?? "",
        academicYearId: params.academicYearId ?? "",
        name: body.name,
        code: body.code,
        startDate: body.startDate,
        endDate: body.endDate,
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/activate",
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

      return options.academicService.activateAcademicYear(actor, params.schoolId ?? "", params.academicYearId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/close",
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

      return options.academicService.closeAcademicYear(actor, params.schoolId ?? "", params.academicYearId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/archive",
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

      return options.academicService.archiveAcademicYear(actor, params.schoolId ?? "", params.academicYearId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/terms",
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
      const body = parseAcademicBody(createTermRequestSchema, request.body ?? {}, "term_create_invalid");

      const record = await options.academicService.createTerm({
        actor,
        schoolId: params.schoolId ?? "",
        academicYearId: params.academicYearId ?? "",
        name: body.name,
        code: body.code,
        startDate: body.startDate,
        endDate: body.endDate,
        metadata: body.metadata
      });

      reply.code(201);
      return record;
    }
  );

  app.patch(
    "/schools/:schoolId/academic-years/:academicYearId/terms/:termId",
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
      const body = parseAcademicBody(updateTermRequestSchema, request.body ?? {}, "term_update_invalid");

      return options.academicService.updateTerm({
        actor,
        schoolId: params.schoolId ?? "",
        academicYearId: params.academicYearId ?? "",
        termId: params.termId ?? "",
        name: body.name,
        code: body.code,
        startDate: body.startDate,
        endDate: body.endDate,
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/terms/:termId/activate",
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

      return options.academicService.activateTerm(actor, params.schoolId ?? "", params.academicYearId ?? "", params.termId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/terms/:termId/close",
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

      return options.academicService.closeTerm(actor, params.schoolId ?? "", params.academicYearId ?? "", params.termId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/terms/:termId/archive",
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

      return options.academicService.archiveTerm(actor, params.schoolId ?? "", params.academicYearId ?? "", params.termId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/terms",
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
      const query = parseAcademicQuery(listTermsQuerySchema, request.query ?? {}, "term_list_invalid");

      return options.academicService.listTerms(actor, params.schoolId ?? "", query.academicYearId);
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/classes",
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
      const body = parseAcademicBody(createClassRequestSchema, request.body ?? {}, "class_create_invalid");

      const record = await options.academicService.createClass({
        actor,
        schoolId: params.schoolId ?? "",
        academicYearId: params.academicYearId ?? "",
        name: body.name,
        code: body.code,
        metadata: body.metadata
      });

      reply.code(201);
      return record;
    }
  );

  app.patch(
    "/schools/:schoolId/academic-years/:academicYearId/classes/:classId",
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
      const body = parseAcademicBody(updateClassRequestSchema, request.body ?? {}, "class_update_invalid");

      return options.academicService.updateClass({
        actor,
        schoolId: params.schoolId ?? "",
        academicYearId: params.academicYearId ?? "",
        classId: params.classId ?? "",
        name: body.name,
        code: body.code,
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/academic-years/:academicYearId/classes/:classId/archive",
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

      return options.academicService.archiveClass(actor, params.schoolId ?? "", params.academicYearId ?? "", params.classId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/classes",
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
      const query = parseAcademicQuery(listClassesQuerySchema, request.query ?? {}, "class_list_invalid");

      return options.academicService.listClasses(actor, params.schoolId ?? "", query.academicYearId);
    }
  );

  app.post(
    "/schools/:schoolId/subjects",
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
      const body = parseAcademicBody(createSubjectRequestSchema, request.body ?? {}, "subject_create_invalid");

      const record = await options.academicService.createSubject({
        actor,
        schoolId: params.schoolId ?? "",
        name: body.name,
        code: body.code,
        metadata: body.metadata
      });

      reply.code(201);
      return record;
    }
  );

  app.patch(
    "/schools/:schoolId/subjects/:subjectId",
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
      const body = parseAcademicBody(updateSubjectRequestSchema, request.body ?? {}, "subject_update_invalid");

      return options.academicService.updateSubject({
        actor,
        schoolId: params.schoolId ?? "",
        subjectId: params.subjectId ?? "",
        name: body.name,
        code: body.code,
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/subjects/:subjectId/archive",
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

      return options.academicService.archiveSubject(actor, params.schoolId ?? "", params.subjectId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/subjects",
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

      return options.academicService.listSubjects(actor, params.schoolId ?? "");
    }
  );
}
