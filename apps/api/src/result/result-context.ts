import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type ResultStatus = "draft" | "computed" | "reviewed" | "published";

export interface ResultRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly studentId: string;
  readonly classId: string;
  readonly subjectId: string;
  readonly academicYearId: string;
  readonly termId: string;
  readonly gradingPolicyId: string;
  readonly ca1Score: number;
  readonly ca2Score: number;
  readonly examScore: number;
  readonly continuousAssessmentTotal: number;
  readonly finalScore: number;
  readonly grade: string;
  readonly remark?: string;
  readonly status: ResultStatus;
  readonly computedAt: Date;
  readonly updatedAt: Date;
}

export interface ResultActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface ResultAuditEvent {
  readonly eventName: "result.computed" | "result.bulk_computed" | "result.recomputed";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "AssessmentResult" | "AssessmentResultBulk";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ResultAuditSink {
  record(event: ResultAuditEvent): Promise<void> | void;
}
