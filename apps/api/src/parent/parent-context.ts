import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type ParentRelationshipType = "father" | "mother" | "guardian" | "sponsor" | "other";
export type ParentStatus = "active" | "inactive" | "archived";
export type ParentStudentLinkStatus = "active" | "archived";

export interface ParentRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: string;
  readonly occupation?: string;
  readonly relationshipType: ParentRelationshipType;
  readonly status: ParentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ParentStudentLinkRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly parentId: string;
  readonly studentId: string;
  readonly status: ParentStudentLinkStatus;
  readonly linkedAt: Date;
  readonly unlinkedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly unlinkedBy?: string;
}

export interface ParentActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface ParentLifecycleAuditEvent {
  readonly eventName:
    | "parent.created"
    | "parent.updated"
    | "parent.archived"
    | "parent.reactivated"
    | "parent.student.linked"
    | "parent.student.unlinked";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "Parent" | "ParentStudentLink";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ParentAuditSink {
  record(event: ParentLifecycleAuditEvent): Promise<void> | void;
}

