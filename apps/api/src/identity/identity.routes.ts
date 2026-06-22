import type { FastifyInstance, FastifyRequest } from "fastify";
import type { IdentityService } from "./identity.service.js";
import {
  createUserSchema,
  inviteUserSchema,
  identityCanonicalRoleSchema,
  parseIdentityBody,
  resendInvitationSchema,
  roleAssignmentSchema,
  userLifecycleSchema
} from "./identity.schemas.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { AppError, canRolePerform, type FoundationPermission } from "@myschoolos/shared";
import { requireFoundationContext } from "../foundation/foundation-context.js";

export interface IdentityRouteOptions {
  readonly identityService: IdentityService;
}

function getRouteParams(request: FastifyRequest): { readonly schoolId?: string; readonly userId?: string; readonly invitationId?: string } {
  return request.params as { readonly schoolId?: string; readonly userId?: string; readonly invitationId?: string };
}

function canAccessRoute(actor: SchoolActorContext, permission: FoundationPermission): boolean {
  return actor.roles.some((role) => canRolePerform(role, permission));
}

function resolveActor(request: FastifyRequest): SchoolActorContext {
  requireFoundationContext(request);
  const context = request.foundationContext;

  if (!context?.authContext || !context.authorizationContext || !context.tenantContext) {
    throw new Error("Identity routes require authenticated foundation context");
  }

  return {
    actorId: context.authContext.userId,
    roles: context.authorizationContext.roles,
    schoolId: context.tenantContext.schoolId
  };
}

export async function registerIdentityRoutes(app: FastifyInstance, options: IdentityRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/users",
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
      const actor = resolveActor(request);
      const body = parseIdentityBody(createUserSchema, request.body ?? {}, "identity_user_create_invalid");
      const params = getRouteParams(request);

      if (!canAccessRoute(actor, "school.manage")) {
        throw new Error("Permission denied");
      }

      const user = await options.identityService.createUser({
        actor,
        schoolId: params.schoolId ?? "",
        loginIdentifier: body.loginIdentifier,
        displayName: body.displayName,
        metadata: body.metadata
      });

      reply.code(201);
      return user;
    }
  );

  app.post(
    "/schools/:schoolId/invitations",
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
      const actor = resolveActor(request);
      const body = parseIdentityBody(inviteUserSchema, request.body ?? {}, "identity_invitation_create_invalid");
      const params = getRouteParams(request);

      if (!canAccessRoute(actor, "school.manage")) {
        throw new Error("Permission denied");
      }

      const result = await options.identityService.inviteUser({
        actor,
        schoolId: params.schoolId ?? "",
        loginIdentifier: body.loginIdentifier,
        displayName: body.displayName,
        metadata: body.metadata
      });

      reply.code(201);
      return result;
    }
  );

  app.post(
    "/schools/:schoolId/invitations/:invitationId/resend",
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
      const actor = resolveActor(request);
      const body = parseIdentityBody(resendInvitationSchema, request.body ?? {}, "identity_invitation_resend_invalid");
      const params = getRouteParams(request);

      return options.identityService.resendInvitation({
        actor,
        schoolId: params.schoolId ?? "",
        invitationId: params.invitationId ?? "",
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/users/:userId/suspend",
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
      const actor = resolveActor(request);
      const body = parseIdentityBody(userLifecycleSchema, request.body ?? {}, "identity_user_suspend_invalid");
      const params = getRouteParams(request);

      return options.identityService.suspendUser({
        actor,
        schoolId: params.schoolId ?? "",
        userId: params.userId ?? "",
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/users/:userId/deactivate",
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
      const actor = resolveActor(request);
      const body = parseIdentityBody(userLifecycleSchema, request.body ?? {}, "identity_user_deactivate_invalid");
      const params = getRouteParams(request);

      return options.identityService.deactivateUser({
        actor,
        schoolId: params.schoolId ?? "",
        userId: params.userId ?? "",
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/users/:userId/reactivate",
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
      const actor = resolveActor(request);
      const body = parseIdentityBody(userLifecycleSchema, request.body ?? {}, "identity_user_reactivate_invalid");
      const params = getRouteParams(request);

      return options.identityService.reactivateUser({
        actor,
        schoolId: params.schoolId ?? "",
        userId: params.userId ?? "",
        metadata: body.metadata
      });
    }
  );

  app.get(
    "/schools/:schoolId/role-assignments",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "role.assign"
        }
      }
    },
    async (request) => {
      const actor = resolveActor(request);
      const params = getRouteParams(request);
      return options.identityService.listRoleAssignments(actor, params.schoolId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/users/:userId/roles",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "role.assign"
        }
      }
    },
    async (request, reply) => {
      const actor = resolveActor(request);
      const body = parseIdentityBody(roleAssignmentSchema, request.body ?? {}, "identity_role_assign_invalid");
      const params = getRouteParams(request);

      const assignment = await options.identityService.assignRole({
        actor,
        schoolId: params.schoolId ?? "",
        userId: params.userId ?? "",
        canonicalRole: body.canonicalRole,
        metadata: body.metadata
      });

      reply.code(201);
      return assignment;
    }
  );

  app.delete(
    "/schools/:schoolId/users/:userId/roles/:canonicalRole",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true,
          permission: "role.revoke"
        }
      }
    },
    async (request) => {
      const actor = resolveActor(request);
      const params = request.params as { readonly schoolId?: string; readonly userId?: string; readonly canonicalRole?: string };
      const role = identityCanonicalRoleSchema.safeParse(params.canonicalRole);

      if (!role.success) {
        throw new AppError("Canonical role is required", {
          status: 400,
          code: "identity_role_invalid"
        });
      }

      return options.identityService.removeRole({
        actor,
        schoolId: params.schoolId ?? "",
        userId: params.userId ?? "",
        canonicalRole: role.data
      });
    }
  );
}
