import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { ScoreService } from "./score.service.js";
import {
  assessmentIdParamsSchema,
  bulkSubmitScoresRequestSchema,
  parseScoreBody,
  studentIdParamsSchema,
  submitScoreRequestSchema,
  updateScoreRequestSchema
} from "./score.schemas.js";

export interface ScoreRouteOptions {
  readonly scoreService: ScoreService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: ScoreRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerScoreRoutes(app: FastifyInstance, options: ScoreRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/assessments/:assessmentId/scores",
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
      const body = parseScoreBody(submitScoreRequestSchema, request.body ?? {}, "score_submit_invalid");

      const record = await options.scoreService.submitScore({
        actor,
        schoolId: params.schoolId ?? "",
        assessmentId: params.assessmentId ?? "",
        studentId: body.studentId,
        score: body.score
      });

      reply.code(201);
      return record;
    }
  );

  app.post(
    "/schools/:schoolId/assessments/:assessmentId/scores/bulk",
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
      const body = parseScoreBody(bulkSubmitScoresRequestSchema, request.body ?? {}, "score_bulk_submit_invalid");

      const records = await options.scoreService.bulkSubmitScores({
        actor,
        schoolId: params.schoolId ?? "",
        assessmentId: params.assessmentId ?? "",
        entries: body.entries
      });

      reply.code(201);
      return records;
    }
  );

  app.patch(
    "/schools/:schoolId/scores/:scoreId",
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
      const body = parseScoreBody(updateScoreRequestSchema, request.body ?? {}, "score_update_invalid");

      return options.scoreService.updateScore({
        actor,
        schoolId: params.schoolId ?? "",
        scoreId: params.scoreId ?? "",
        score: body.score
      });
    }
  );

  app.get(
    "/schools/:schoolId/scores/:scoreId",
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

      return options.scoreService.getScore(actor, params.schoolId ?? "", params.scoreId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/assessments/:assessmentId/scores",
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

      return options.scoreService.listScoresByAssessment({
        actor,
        schoolId: params.schoolId ?? "",
        assessmentId: parsed.data.assessmentId
      });
    }
  );

  app.get(
    "/schools/:schoolId/students/:studentId/scores",
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

      return options.scoreService.listScoresByStudent({
        actor,
        schoolId: params.schoolId ?? "",
        studentId: parsed.data.studentId
      });
    }
  );
}
