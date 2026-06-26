import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { ReportService } from "./report.service.js";
import {
  generateReportCardRequestSchema,
  listReportCardsQuerySchema,
  parseReportCardBody,
  parseReportCardQuery,
  regenerateReportCardRequestSchema,
  reportCardIdParamsSchema
} from "./report.schemas.js";

export interface ReportRouteOptions {
  readonly reportService: ReportService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: ReportRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerReportRoutes(app: FastifyInstance, options: ReportRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/reports",
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
      const body = parseReportCardBody(generateReportCardRequestSchema, request.body ?? {}, "report_card_generate_invalid");

      const report = await options.reportService.generateReport({
        actor,
        schoolId: params.schoolId ?? "",
        studentId: body.studentId,
        classId: body.classId,
        academicYearId: body.academicYearId,
        termId: body.termId,
        teacherComments: body.teacherComments,
        principalComments: body.principalComments
      });

      reply.code(201);
      return report;
    }
  );

  app.post(
    "/schools/:schoolId/reports/:reportId/regenerate",
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
      const body = parseReportCardBody(regenerateReportCardRequestSchema, request.body ?? {}, "report_card_regenerate_invalid");

      return options.reportService.regenerateReport({
        actor,
        schoolId: params.schoolId ?? "",
        reportId: params.reportId ?? "",
        teacherComments: body.teacherComments,
        principalComments: body.principalComments
      });
    }
  );

  app.post(
    "/schools/:schoolId/reports/:reportId/publish",
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

      return options.reportService.publishReport({
        actor,
        schoolId: params.schoolId ?? "",
        reportId: params.reportId ?? ""
      });
    }
  );

  app.post(
    "/schools/:schoolId/reports/:reportId/unpublish",
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

      return options.reportService.unpublishReport({
        actor,
        schoolId: params.schoolId ?? "",
        reportId: params.reportId ?? ""
      });
    }
  );

  app.get(
    "/schools/:schoolId/reports/:reportId",
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

      return options.reportService.getReport({
        actor,
        schoolId: params.schoolId ?? "",
        reportId: params.reportId ?? ""
      });
    }
  );

  app.get(
    "/schools/:schoolId/reports",
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
      const query = parseReportCardQuery(listReportCardsQuerySchema, request.query ?? {}, "report_card_list_invalid");

      return options.reportService.listReports({
        actor,
        schoolId: params.schoolId ?? "",
        studentId: query.studentId,
        classId: query.classId,
        academicYearId: query.academicYearId,
        termId: query.termId,
        status: query.status
      });
    }
  );
}
