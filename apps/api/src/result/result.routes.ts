import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { ResultService } from "./result.service.js";
import {
  assessmentIdParamsSchema,
  classIdParamsSchema,
  computeResultRequestSchema,
  parseResultBody,
  studentIdParamsSchema,
  subjectIdParamsSchema,
  termIdParamsSchema
} from "./result.schemas.js";

export interface ResultRouteOptions {
  readonly resultService: ResultService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: ResultRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerResultRoutes(app: FastifyInstance, options: ResultRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/assessments/:assessmentId/results",
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
      const body = parseResultBody(computeResultRequestSchema, request.body ?? {}, "result_compute_invalid");

      const record = await options.resultService.computeStudentSubjectResult({
        actor,
        schoolId: params.schoolId ?? "",
        assessmentId: params.assessmentId ?? "",
        studentId: body.studentId
      });

      reply.code(201);
      return record;
    }
  );

  app.post(
    "/schools/:schoolId/assessments/:assessmentId/results/bulk",
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

      const records = await options.resultService.bulkComputeClassSubjectResults({
        actor,
        schoolId: params.schoolId ?? "",
        assessmentId: params.assessmentId ?? ""
      });

      reply.code(201);
      return records;
    }
  );

  app.post(
    "/schools/:schoolId/results/:resultId/recompute",
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

      return options.resultService.recomputeResult({
        actor,
        schoolId: params.schoolId ?? "",
        resultId: params.resultId ?? ""
      });
    }
  );

  app.get(
    "/schools/:schoolId/results/:resultId",
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

      return options.resultService.getResult(actor, params.schoolId ?? "", params.resultId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/assessments/:assessmentId/results",
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
      const parsed = assessmentIdParamsSchema.safeParse(params);

      if (!parsed.success) {
        throw new Error("Assessment context is required");
      }

      return options.resultService.listResultsByAssessment({
        actor,
        schoolId: params.schoolId ?? "",
        assessmentId: parsed.data.assessmentId
      });
    }
  );

  app.get(
    "/schools/:schoolId/classes/:classId/results",
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
      const parsed = classIdParamsSchema.safeParse(params);

      if (!parsed.success) {
        throw new Error("Class context is required");
      }

      return options.resultService.listResultsByClass({
        actor,
        schoolId: params.schoolId ?? "",
        classId: parsed.data.classId
      });
    }
  );

  app.get(
    "/schools/:schoolId/students/:studentId/results",
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
      const parsed = studentIdParamsSchema.safeParse(params);

      if (!parsed.success) {
        throw new Error("Student context is required");
      }

      return options.resultService.listResultsByStudent({
        actor,
        schoolId: params.schoolId ?? "",
        studentId: parsed.data.studentId
      });
    }
  );

  app.get(
    "/schools/:schoolId/subjects/:subjectId/results",
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
      const parsed = subjectIdParamsSchema.safeParse(params);

      if (!parsed.success) {
        throw new Error("Subject context is required");
      }

      return options.resultService.listResultsBySubject({
        actor,
        schoolId: params.schoolId ?? "",
        subjectId: parsed.data.subjectId
      });
    }
  );

  app.get(
    "/schools/:schoolId/terms/:termId/results",
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
      const parsed = termIdParamsSchema.safeParse(params);

      if (!parsed.success) {
        throw new Error("Term context is required");
      }

      return options.resultService.listResultsByTerm({
        actor,
        schoolId: params.schoolId ?? "",
        termId: parsed.data.termId
      });
    }
  );
}
