import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export interface ScoreRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly assessmentId: string;
  readonly studentId: string;
  readonly score: number;
  readonly submittedBy: string;
  readonly submittedAt: Date;
  readonly updatedAt: Date;
}

export interface ScoreActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface ScoreAuditEvent {
  readonly eventName: "score.submitted" | "score.bulk_submitted" | "score.updated";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "Score" | "ScoreBulk";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ScoreAuditSink {
  record(event: ScoreAuditEvent): Promise<void> | void;
}
