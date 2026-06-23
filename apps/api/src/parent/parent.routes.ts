import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { ParentService } from "./parent.service.js";
import {
  createParentRequestSchema,
  parseParentBody,
  parseParentQuery,
  parentListQuerySchema,
  updateParentRequestSchema
} from "./parent.schemas.js";

export interface ParentRouteOptions {
  readonly parentService: ParentService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: ParentRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerParentRoutes(app: FastifyInstance, options: ParentRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/parents",
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
      const body = parseParentBody(createParentRequestSchema, request.body ?? {}, "parent_create_invalid");

      const parent = await options.parentService.createParent({
        actor,
        schoolId: params.schoolId ?? "",
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName,
        email: body.email,
        phone: body.phone,
        address: body.address,
        occupation: body.occupation,
        relationshipType: body.relationshipType
      });

      reply.code(201);
      return parent;
    }
  );

  app.get(
    "/schools/:schoolId/parents",
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
      const query = parseParentQuery(parentListQuerySchema, request.query ?? {}, "parent_list_invalid");

      return options.parentService.listParents({
        actor,
        schoolId: params.schoolId ?? "",
        status: query.status
      });
    }
  );

  app.get(
    "/schools/:schoolId/parents/:parentId",
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

      return options.parentService.getParent(actor, params.schoolId ?? "", params.parentId ?? "");
    }
  );

  app.patch(
    "/schools/:schoolId/parents/:parentId",
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
      const body = parseParentBody(updateParentRequestSchema, request.body ?? {}, "parent_update_invalid");

      return options.parentService.updateParent({
        actor,
        schoolId: params.schoolId ?? "",
        parentId: params.parentId ?? "",
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName,
        email: body.email,
        phone: body.phone,
        address: body.address,
        occupation: body.occupation,
        relationshipType: body.relationshipType,
        status: body.status
      });
    }
  );

  app.post(
    "/schools/:schoolId/parents/:parentId/archive",
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

      return options.parentService.archiveParent(actor, params.schoolId ?? "", params.parentId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/parents/:parentId/reactivate",
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

      return options.parentService.reactivateParent(actor, params.schoolId ?? "", params.parentId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/parents/:parentId/students/:studentId/link",
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

      const link = await options.parentService.linkParentToStudent({
        actor,
        schoolId: params.schoolId ?? "",
        parentId: params.parentId ?? "",
        studentId: params.studentId ?? ""
      });

      reply.code(201);
      return link;
    }
  );

  app.post(
    "/schools/:schoolId/parents/:parentId/students/:studentId/unlink",
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

      return options.parentService.unlinkParentFromStudent({
        actor,
        schoolId: params.schoolId ?? "",
        parentId: params.parentId ?? "",
        studentId: params.studentId ?? ""
      });
    }
  );

  app.get(
    "/schools/:schoolId/parents/:parentId/students",
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

      return options.parentService.listLinksForParent(actor, params.schoolId ?? "", params.parentId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/students/:studentId/parents",
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

      return options.parentService.listLinksForStudent(actor, params.schoolId ?? "", params.studentId ?? "");
    }
  );
}

