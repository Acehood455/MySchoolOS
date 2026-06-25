import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { AssessmentService } from "./assessment.service.js";
import {
  createAssessmentRequestSchema,
  listAssessmentsRequestSchema,
  parseAssessmentBody,
  parseAssessmentQuery,
  updateAssessmentRequestSchema
} from "./assessment.schemas.js";

export interface AssessmentRouteOptions {
  readonly assessmentService: AssessmentService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: AssessmentRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerAssessmentRoutes(app: FastifyInstance, options: AssessmentRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/assessments",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "tenant.read"
        }
      }
    },
    async (request, reply) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseAssessmentBody(createAssessmentRequestSchema, request.body ?? {}, "assessment_create_invalid");

      const record = await options.assessmentService.createAssessment({
        actor,
        schoolId: params.schoolId ?? "",
        academicYearId: body.academicYearId,
        termId: body.termId,
        classId: body.classId,
        subjectId: body.subjectId,
        assessmentType: body.assessmentType,
        title: body.title,
        description: body.description,
        maxScore: body.maxScore,
        opensAt: body.opensAt,
        closesAt: body.closesAt
      });

      reply.code(201);
      return record;
    }
  );

  app.patch(
    "/schools/:schoolId/assessments/:assessmentId",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "tenant.read"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseAssessmentBody(updateAssessmentRequestSchema, request.body ?? {}, "assessment_update_invalid");

      return options.assessmentService.updateAssessment({
        actor,
        schoolId: params.schoolId ?? "",
        assessmentId: params.assessmentId ?? "",
        title: body.title,
        description: body.description,
        maxScore: body.maxScore,
        opensAt: body.opensAt,
        closesAt: body.closesAt
      });
    }
  );

  app.post(
    "/schools/:schoolId/assessments/:assessmentId/open",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "tenant.read"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.assessmentService.openAssessment(actor, params.schoolId ?? "", params.assessmentId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/assessments/:assessmentId/close",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "tenant.read"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.assessmentService.closeAssessment(actor, params.schoolId ?? "", params.assessmentId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/assessments/:assessmentId/archive",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "tenant.read"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.assessmentService.archiveAssessment(actor, params.schoolId ?? "", params.assessmentId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/assessments/:assessmentId",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "tenant.read"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.assessmentService.getAssessment(actor, params.schoolId ?? "", params.assessmentId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/assessments",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "tenant.read"
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const query = parseAssessmentQuery(listAssessmentsRequestSchema, request.query ?? {}, "assessment_list_invalid");

      return options.assessmentService.listAssessments({
        actor,
        schoolId: params.schoolId ?? "",
        academicYearId: query.academicYearId,
        termId: query.termId,
        classId: query.classId,
        subjectId: query.subjectId,
        assessmentType: query.assessmentType,
        status: query.status
      });
    }
  );
}
