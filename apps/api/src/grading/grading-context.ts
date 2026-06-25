import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type GradingPolicyStatus = "draft" | "active" | "archived";

export interface GradeBoundaryRecord {
  readonly grade: string;
  readonly minScore: number;
  readonly maxScore: number;
  readonly remark?: string;
}

export interface GradingPolicyRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly name: string;
  readonly version: string;
  readonly ca1Weight: number;
  readonly ca2Weight: number;
  readonly examWeight: number;
  readonly gradeBoundaries: readonly GradeBoundaryRecord[];
  readonly remarks?: string;
  readonly status: GradingPolicyStatus;
  readonly effectiveFrom: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GradingPolicyActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface GradingPolicyAuditEvent {
  readonly eventName:
    | "grading_policy.created"
    | "grading_policy.updated"
    | "grading_policy.activated"
    | "grading_policy.archived";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "GradingPolicy";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface GradingPolicyAuditSink {
  record(event: GradingPolicyAuditEvent): Promise<void> | void;
}
