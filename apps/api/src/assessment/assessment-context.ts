import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type AssessmentType = "CA1" | "CA2" | "EXAM";
export type AssessmentStatus = "draft" | "open" | "closed" | "archived";

export interface AssessmentRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly termId: string;
  readonly classId: string;
  readonly subjectId: string;
  readonly assessmentType: AssessmentType;
  readonly title: string;
  readonly description?: string;
  readonly maxScore: number;
  readonly status: AssessmentStatus;
  readonly opensAt: Date;
  readonly closesAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AssessmentActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface AssessmentAuditEvent {
  readonly eventName: "assessment.created" | "assessment.updated" | "assessment.opened" | "assessment.closed" | "assessment.archived";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "Assessment";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AssessmentAuditSink {
  record(event: AssessmentAuditEvent): Promise<void> | void;
}
