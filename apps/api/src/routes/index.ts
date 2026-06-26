import type { FastifyInstance } from "fastify";
import type { AcademicService } from "../academic/academic.service.js";
import { registerAcademicRoutes, type AcademicRouteOptions } from "../academic/academic.routes.js";
import type { AuthService } from "../auth/auth.service.js";
import { registerAuthRoutes } from "../auth/auth.routes.js";
import type { AssessmentService } from "../assessment/assessment.service.js";
import { registerAssessmentRoutes, type AssessmentRouteOptions } from "../assessment/assessment.routes.js";
import type { AttendanceService } from "../attendance/attendance.service.js";
import { registerAttendanceRoutes, type AttendanceRouteOptions } from "../attendance/attendance.routes.js";
import type { GradingService } from "../grading/grading.service.js";
import { registerGradingRoutes, type GradingRouteOptions } from "../grading/grading.routes.js";
import type { ResultService } from "../result/result.service.js";
import { registerResultRoutes, type ResultRouteOptions } from "../result/result.routes.js";
import type { ScoreService } from "../score/score.service.js";
import { registerScoreRoutes, type ScoreRouteOptions } from "../score/score.routes.js";
import type { IdentityService } from "../identity/identity.service.js";
import { registerIdentityRoutes } from "../identity/identity.routes.js";
import type { EnrollmentService } from "../enrollment/enrollment.service.js";
import { registerEnrollmentRoutes, type EnrollmentRouteOptions } from "../enrollment/enrollment.routes.js";
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
  readonly assessmentService?: AssessmentService;
  readonly attendanceService?: AttendanceService;
  readonly gradingService?: GradingService;
  readonly resultService?: ResultService;
  readonly scoreService?: ScoreService;
  readonly identityService?: IdentityService;
  readonly enrollmentService?: EnrollmentService;
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

  if (options.assessmentService && options.schoolActorResolver) {
    await registerAssessmentRoutes(app, {
      assessmentService: options.assessmentService,
      actorResolver: options.schoolActorResolver as AssessmentRouteOptions["actorResolver"]
    });
  }

  if (options.gradingService && options.schoolActorResolver) {
    await registerGradingRoutes(app, {
      gradingService: options.gradingService,
      actorResolver: options.schoolActorResolver as GradingRouteOptions["actorResolver"]
    });
  }

  if (options.resultService && options.schoolActorResolver) {
    await registerResultRoutes(app, {
      resultService: options.resultService,
      actorResolver: options.schoolActorResolver as ResultRouteOptions["actorResolver"]
    });
  }

  if (options.scoreService && options.schoolActorResolver) {
    await registerScoreRoutes(app, {
      scoreService: options.scoreService,
      actorResolver: options.schoolActorResolver as ScoreRouteOptions["actorResolver"]
    });
  }

  if (options.attendanceService && options.schoolActorResolver) {
    await registerAttendanceRoutes(app, {
      attendanceService: options.attendanceService,
      actorResolver: options.schoolActorResolver as AttendanceRouteOptions["actorResolver"]
    });
  }

  if (options.enrollmentService && options.schoolActorResolver) {
    await registerEnrollmentRoutes(app, {
      enrollmentService: options.enrollmentService,
      actorResolver: options.schoolActorResolver as EnrollmentRouteOptions["actorResolver"]
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
