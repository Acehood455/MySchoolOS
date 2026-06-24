import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireFoundationContext } from "../foundation/foundation-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { AttendanceService } from "./attendance.service.js";
import {
  attendanceByDateRequestSchema,
  attendanceSummaryRequestSchema,
  bulkAttendanceRequestSchema,
  listAttendanceRequestSchema,
  markAttendanceRequestSchema,
  parseAttendanceBody,
  parseAttendanceQuery,
  updateAttendanceRequestSchema
} from "./attendance.schemas.js";

export interface AttendanceRouteOptions {
  readonly attendanceService: AttendanceService;
  readonly actorResolver: (request: FastifyRequest) => Promise<SchoolActorContext | null> | SchoolActorContext | null;
}

function getRouteParams(request: FastifyRequest): Record<string, string | undefined> {
  return request.params as Record<string, string | undefined>;
}

async function resolveActor(request: FastifyRequest, options: AttendanceRouteOptions): Promise<SchoolActorContext> {
  const actor = await options.actorResolver(request);

  if (!actor) {
    throw new Error("Actor context is required");
  }

  return actor;
}

export async function registerAttendanceRoutes(app: FastifyInstance, options: AttendanceRouteOptions): Promise<void> {
  app.post(
    "/schools/:schoolId/attendance",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request, reply) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseAttendanceBody(markAttendanceRequestSchema, request.body ?? {}, "attendance_mark_invalid");

      const record = await options.attendanceService.markAttendance({
        actor,
        schoolId: params.schoolId ?? "",
        enrollmentId: body.enrollmentId,
        academicYearId: body.academicYearId,
        termId: body.termId,
        classId: body.classId,
        attendanceDate: body.attendanceDate,
        status: body.status,
        remarks: body.remarks
      });

      reply.code(201);
      return record;
    }
  );

  app.patch(
    "/schools/:schoolId/attendance/:attendanceId",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseAttendanceBody(updateAttendanceRequestSchema, request.body ?? {}, "attendance_update_invalid");

      return options.attendanceService.updateAttendance({
        actor,
        schoolId: params.schoolId ?? "",
        attendanceId: params.attendanceId ?? "",
        attendanceDate: body.attendanceDate,
        status: body.status,
        remarks: body.remarks
      });
    }
  );

  app.get(
    "/schools/:schoolId/attendance/:attendanceId",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.attendanceService.getAttendance(actor, params.schoolId ?? "", params.attendanceId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/attendance",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const query = parseAttendanceQuery(listAttendanceRequestSchema, request.query ?? {}, "attendance_list_invalid");

      return options.attendanceService.listAttendance({
        actor,
        schoolId: params.schoolId ?? "",
        enrollmentId: query.enrollmentId,
        studentId: query.studentId,
        academicYearId: query.academicYearId,
        termId: query.termId,
        classId: query.classId,
        attendanceDate: query.attendanceDate,
        status: query.status
      });
    }
  );

  app.post(
    "/schools/:schoolId/classes/:classId/attendance/bulk",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request, reply) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const body = parseAttendanceBody(bulkAttendanceRequestSchema, request.body ?? {}, "attendance_bulk_invalid");

      const records = await options.attendanceService.markClassAttendance({
        actor,
        schoolId: params.schoolId ?? "",
        academicYearId: body.academicYearId,
        termId: body.termId,
        classId: params.classId ?? "",
        attendanceDate: body.attendanceDate,
        entries: body.entries
      });

      reply.code(201);
      return records;
    }
  );

  app.get(
    "/schools/:schoolId/students/:studentId/attendance-history",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.attendanceService.getStudentAttendanceHistory(actor, params.schoolId ?? "", params.studentId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/classes/:classId/attendance-history",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);

      return options.attendanceService.getClassAttendanceHistory(actor, params.schoolId ?? "", params.classId ?? "");
    }
  );

  app.get(
    "/schools/:schoolId/attendance/by-date",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const query = parseAttendanceQuery(attendanceByDateRequestSchema, request.query ?? {}, "attendance_by_date_invalid");

      return options.attendanceService.getAttendanceByDate(actor, params.schoolId ?? "", query.attendanceDate, query.classId);
    }
  );

  app.get(
    "/schools/:schoolId/attendance/summary",
    {
      config: {
        foundation: {
          resolveTenant: true,
          authenticate: true
        }
      }
    },
    async (request) => {
      requireFoundationContext(request);
      const actor = await resolveActor(request, options);
      const params = getRouteParams(request);
      const query = parseAttendanceQuery(attendanceSummaryRequestSchema, request.query ?? {}, "attendance_summary_invalid");

      return options.attendanceService.getAttendanceSummary({
        actor,
        schoolId: params.schoolId ?? "",
        studentId: query.studentId,
        classId: query.classId,
        academicYearId: query.academicYearId,
        termId: query.termId
      });
    }
  );
}
