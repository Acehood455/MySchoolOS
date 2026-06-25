import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { GradingService } from "./grading.service.js";
import {
  createGradingPolicyRequestSchema,
  gradingPolicyIdParamsSchema,
  listGradingPoliciesQuerySchema,
  parseGradingPolicyBody,
  parseGradingPolicyQuery,
  updateGradingPolicyRequestSchema
} from "./grading.schemas.js";

export interface GradingRouteOptions {
  readonly gradingService: GradingService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: GradingRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerGradingRoutes(app: FastifyInstance, options: GradingRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/grading-policies",
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
      const body = parseGradingPolicyBody(createGradingPolicyRequestSchema, request.body ?? {}, "grading_policy_create_invalid");

      const record = await options.gradingService.createPolicy({
        actor,
        schoolId: params.schoolId ?? "",
        name: body.name,
        version: body.version,
        ca1Weight: body.ca1Weight,
        ca2Weight: body.ca2Weight,
        examWeight: body.examWeight,
        gradeBoundaries: body.gradeBoundaries,
        remarks: body.remarks,
        effectiveFrom: body.effectiveFrom
      });

      reply.code(201);
      return record;
    }
  );

  app.patch(
    "/schools/:schoolId/grading-policies/:policyId",
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
      const body = parseGradingPolicyBody(updateGradingPolicyRequestSchema, request.body ?? {}, "grading_policy_update_invalid");

      return options.gradingService.updatePolicy({
        actor,
        schoolId: params.schoolId ?? "",
        policyId: params.policyId ?? "",
        name: body.name,
        version: body.version,
        ca1Weight: body.ca1Weight,
        ca2Weight: body.ca2Weight,
        examWeight: body.examWeight,
        gradeBoundaries: body.gradeBoundaries,
        remarks: body.remarks,
        effectiveFrom: body.effectiveFrom
      });
    }
  );

  app.post(
    "/schools/:schoolId/grading-policies/:policyId/activate",
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

      return options.gradingService.activatePolicy(actor, params.schoolId ?? "", params.policyId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/grading-policies/:policyId/archive",
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

      return options.gradingService.archivePolicy(actor, params.schoolId ?? "", params.policyId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/grading-policies/active",
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

      return options.gradingService.getActivePolicy(actor, params.schoolId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/grading-policies/:policyId",
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

      return options.gradingService.getPolicy(actor, params.schoolId ?? "", params.policyId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/grading-policies",
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
      parseGradingPolicyQuery(listGradingPoliciesQuerySchema, request.query ?? {}, "grading_policy_list_invalid");

      return options.gradingService.listPolicies({
        actor,
        schoolId: params.schoolId ?? ""
      });
    }
  );
}
