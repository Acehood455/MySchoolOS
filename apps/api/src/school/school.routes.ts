import type { FastifyInstance, FastifyRequest } from "fastify";
import { canRolePerform, type FoundationPermission } from "@myschoolos/shared";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "./school-context.js";
import {
  addSchoolDomainRequestSchema,
  createSchoolRequestSchema,
  parseSchoolBody,
  updateSchoolRequestSchema,
  updateSchoolSettingsRequestSchema,
  updateSchoolThemeRequestSchema,
  verifySchoolDomainRequestSchema
} from "./school.schemas.js";
import type { SchoolService } from "./school.service.js";

export interface SchoolRouteOptions {
  readonly schoolService: SchoolService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): { readonly schoolId?: string; readonly domainId?: string } {
  return request.params as { readonly schoolId?: string; readonly domainId?: string };
}

function canAccessRoute(actor: SchoolActorContext, permission: FoundationPermission): boolean {
  return actor.roles.some((role) => canRolePerform(role, permission));
}

async function resolveActor(request: FastifyRequest, options: SchoolRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

function requireSuperAdmin(actor: SchoolActorContext): void {
  if (!actor.roles.includes("super_admin")) {
    throw new Error("Permission denied");
  }
}

export async function registerSchoolRoutes(app: FastifyInstance, options: SchoolRouteOptions): Promise<void> {
  app.post("/schools", async (request, reply) => {
    const actor = await resolveActor(request, options);
    const body = parseSchoolBody(createSchoolRequestSchema, request.body, "school_create_invalid");

    if (!canAccessRoute(actor, "school.manage")) {
      throw new Error("Permission denied");
    }

    requireSuperAdmin(actor);

    const school = await options.schoolService.createSchool({
      actor,
      name: body.name,
      legalName: body.legalName,
      code: body.code,
      description: body.description,
      metadata: body.metadata
    });

    reply.code(201);
    return school;
  });

  app.get(
    "/schools/:schoolId",
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
      return options.schoolService.getSchoolDetails(actor, params.schoolId ?? "");
    }
  );

  app.patch(
    "/schools/:schoolId",
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
      const body = parseSchoolBody(updateSchoolRequestSchema, request.body, "school_update_invalid");
      const params = getRouteParams(request);

      return options.schoolService.updateSchool({
        actor,
        schoolId: params.schoolId ?? "",
        ...body
      });
    }
  );

  app.post(
    "/schools/:schoolId/activate",
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
      return options.schoolService.activateSchool(actor, params.schoolId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/suspend",
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
      return options.schoolService.suspendSchool(actor, params.schoolId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/archive",
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
      return options.schoolService.archiveSchool(actor, params.schoolId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/settings",
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
      return options.schoolService.getSettings(actor, params.schoolId ?? "");
    }
  );

  app.patch(
    "/schools/:schoolId/settings",
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
      const body = parseSchoolBody(updateSchoolSettingsRequestSchema, request.body, "school_settings_update_invalid");
      const params = getRouteParams(request);

      return options.schoolService.updateSettings({
        actor,
        schoolId: params.schoolId ?? "",
        timezone: body.timezone,
        locale: body.locale,
        academicSessionDefaults: body.academicSessionDefaults,
        platformConfiguration: body.platformConfiguration,
        metadata: body.metadata
      });
    }
  );

  app.get(
    "/schools/:schoolId/theme",
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
      return options.schoolService.getTheme(actor, params.schoolId ?? "");
    }
  );

  app.patch(
    "/schools/:schoolId/theme",
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
      const body = parseSchoolBody(updateSchoolThemeRequestSchema, request.body, "school_theme_update_invalid");
      const params = getRouteParams(request);

      return options.schoolService.updateTheme({
        actor,
        schoolId: params.schoolId ?? "",
        logo: body.logo,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        brandingConfiguration: body.brandingConfiguration,
        metadata: body.metadata
      });
    }
  );

  app.get(
    "/schools/:schoolId/domains",
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
      return options.schoolService.listDomains(actor, params.schoolId ?? "");
    }
  );

  app.post(
    "/schools/:schoolId/domains",
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
      const body = parseSchoolBody(addSchoolDomainRequestSchema, request.body, "school_domain_add_invalid");
      const params = getRouteParams(request);

      const domain = await options.schoolService.addDomain({
        actor,
        schoolId: params.schoolId ?? "",
        host: body.host,
        hostType: body.hostType,
        subdomain: body.subdomain,
        metadata: body.metadata
      });

      reply.code(201);
      return domain;
    }
  );

  app.post(
    "/schools/:schoolId/domains/:domainId/verify",
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
      const body = parseSchoolBody(verifySchoolDomainRequestSchema, request.body, "school_domain_verify_invalid");
      const params = getRouteParams(request);

      return options.schoolService.verifyDomain({
        actor,
        schoolId: params.schoolId ?? "",
        domainId: params.domainId ?? "",
        verifiedBy: body.verifiedBy,
        metadata: body.metadata
      });
    }
  );

  app.post(
    "/schools/:schoolId/domains/:domainId/activate",
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
      return options.schoolService.activateDomain({
        actor,
        schoolId: params.schoolId ?? "",
        domainId: params.domainId ?? ""
      });
    }
  );

  app.post(
    "/schools/:schoolId/domains/:domainId/deactivate",
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
      return options.schoolService.deactivateDomain({
        actor,
        schoolId: params.schoolId ?? "",
        domainId: params.domainId ?? ""
      });
    }
  );
}
