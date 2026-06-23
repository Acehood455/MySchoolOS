import type { FastifyInstance } from "fastify";
import type { AcademicService } from "../academic/academic.service.js";
import { registerAcademicRoutes, type AcademicRouteOptions } from "../academic/academic.routes.js";
import type { AuthService } from "../auth/auth.service.js";
import { registerAuthRoutes } from "../auth/auth.routes.js";
import type { IdentityService } from "../identity/identity.service.js";
import { registerIdentityRoutes } from "../identity/identity.routes.js";
import type { ParentService } from "../parent/parent.service.js";
import { registerParentRoutes, type ParentRouteOptions } from "../parent/parent.routes.js";
import type { StaffService } from "../staff/staff.service.js";
import { registerStaffRoutes, type StaffRouteOptions } from "../staff/staff.routes.js";
import type { StudentService } from "../student/student.service.js";
import { registerStudentRoutes } from "../student/student.routes.js";
import type { SchoolService } from "../school/school.service.js";
import { registerSchoolRoutes, type SchoolRouteOptions } from "../school/school.routes.js";
import { registerHealthRoutes } from "./health.js";

export interface RegisterRoutesOptions {
  readonly academicService?: AcademicService;
  readonly authService?: AuthService;
  readonly cookieName?: string;
  readonly identityService?: IdentityService;
  readonly parentService?: ParentService;
  readonly staffService?: StaffService;
  readonly studentService?: StudentService;
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

  if (options.identityService) {
    await registerIdentityRoutes(app, {
      identityService: options.identityService
    });
  }

  if (options.staffService && options.schoolActorResolver) {
    await registerStaffRoutes(app, {
      staffService: options.staffService,
      actorResolver: options.schoolActorResolver as StaffRouteOptions["actorResolver"]
    });
  }

  if (options.parentService && options.schoolActorResolver) {
    await registerParentRoutes(app, {
      parentService: options.parentService,
      actorResolver: options.schoolActorResolver as ParentRouteOptions["actorResolver"]
    });
  }

  if (options.studentService && options.schoolActorResolver) {
    await registerStudentRoutes(app, {
      studentService: options.studentService,
      actorResolver: options.schoolActorResolver
    });
  }

  if (options.academicService && options.schoolActorResolver) {
    await registerAcademicRoutes(app, {
      academicService: options.academicService,
      actorResolver: options.schoolActorResolver as AcademicRouteOptions["actorResolver"]
    });
  }

  if (options.schoolService && options.schoolActorResolver) {
    await registerSchoolRoutes(app, {
      schoolService: options.schoolService,
      actorResolver: options.schoolActorResolver
    });
  }
}
