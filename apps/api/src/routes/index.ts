import type { FastifyInstance } from "fastify";
import type { AuthService } from "../auth/auth.service.js";
import { registerAuthRoutes } from "../auth/auth.routes.js";
import type { SchoolService } from "../school/school.service.js";
import { registerSchoolRoutes, type SchoolRouteOptions } from "../school/school.routes.js";
import { registerHealthRoutes } from "./health.js";

export interface RegisterRoutesOptions {
  readonly authService?: AuthService;
  readonly cookieName?: string;
  readonly schoolService?: SchoolService;
  readonly schoolActorResolver?: SchoolRouteOptions["actorResolver"];
}

export async function registerRoutes(app: FastifyInstance, options: RegisterRoutesOptions = {}): Promise<void> {
  await registerHealthRoutes(app);

  if (options.authService) {
    await registerAuthRoutes(app, {
      authService: options.authService,
      cookieName: options.cookieName ?? "myschoolos_session"
    });
  }

  if (options.schoolService && options.schoolActorResolver) {
    await registerSchoolRoutes(app, {
      schoolService: options.schoolService,
      actorResolver: options.schoolActorResolver
    });
  }
}
