import fastify from "fastify";
import cors from "@fastify/cors";
import type { AcademicService } from "./academic/academic.service.js";
import type { AuthService } from "./auth/auth.service.js";
import type { IdentityService } from "./identity/identity.service.js";
import type { EnrollmentService } from "./enrollment/enrollment.service.js";
import type { ParentService } from "./parent/parent.service.js";
import type { StaffService } from "./staff/staff.service.js";
import type { StudentService } from "./student/student.service.js";
import { registerFoundationPlugin, type FoundationIntegrationOptions } from "./foundation/foundation.plugin.js";
import { registerRoutes } from "./routes/index.js";
import { toProblemDetails } from "./errors.js";
import { apiLogger } from "./logger.js";
import type { SchoolService } from "./school/school.service.js";
import type { SchoolRouteOptions } from "./school/school.routes.js";

export interface CreateAppOptions {
  readonly foundation?: FoundationIntegrationOptions;
  readonly academicService?: AcademicService;
  readonly authService?: AuthService;
  readonly cookieName?: string;
  readonly identityService?: IdentityService;
  readonly enrollmentService?: EnrollmentService;
  readonly parentService?: ParentService;
  readonly staffService?: StaffService;
  readonly studentService?: StudentService;
  readonly schoolService?: SchoolService;
  readonly schoolActorResolver?: SchoolRouteOptions["actorResolver"];
}

function resolveCorrelationId(header: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(header)) {
    return header[0] ?? fallback;
  }

  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }

  return fallback;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = fastify({
    logger: false
  });

  app.setErrorHandler((error, request, reply) => {
    const details = toProblemDetails(error, request.url);
    apiLogger
      .withContext({
        requestId: request.foundationContext?.requestId ?? request.id,
        correlationId: request.foundationContext?.correlationId ?? resolveCorrelationId(request.headers["x-correlation-id"], request.id),
        actorId: request.foundationContext?.actorId ?? null,
        tenantId: request.foundationContext?.tenantId ?? request.foundationContext?.tenantContext?.schoolId ?? null
      })
      .error("request.failed", {
        error: details,
        method: request.method,
        url: request.url,
        statusCode: details.status
      });
    void reply.status(details.status).send(details);
  });

  void app.register(cors, {
    origin: true
  });

  if (options.foundation) {
    void registerFoundationPlugin(app, {
      ...options.foundation,
      cookieName: options.cookieName ?? options.foundation.cookieName ?? "myschoolos_session"
    });
  }

  void app.register(registerRoutes, {
    academicService: options.academicService,
    authService: options.authService,
    cookieName: options.cookieName ?? "myschoolos_session",
    identityService: options.identityService,
    enrollmentService: options.enrollmentService,
    parentService: options.parentService,
    staffService: options.staffService,
    studentService: options.studentService,
    schoolService: options.schoolService,
    schoolActorResolver: options.schoolActorResolver
  });

  app.get("/", async () => ({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString()
  }));

  return app;
}

export async function startApp(port: number): Promise<void> {
  const app = createApp();

  await app.listen({ port, host: "0.0.0.0" });
  apiLogger.info("API listening", { port });
}
