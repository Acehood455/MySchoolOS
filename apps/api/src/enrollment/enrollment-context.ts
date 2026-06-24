import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type EnrollmentStatus = "active" | "transferred" | "withdrawn" | "graduated" | "archived";
export type EnrollmentHistoryEventName =
  | "enrollment.created"
  | "enrollment.updated"
  | "enrollment.archived"
  | "student.promoted"
  | "student.transferred"
  | "student.class_changed";

export interface EnrollmentRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly studentId: string;
  readonly academicYearId: string;
  readonly classId: string;
  readonly admissionDate: Date;
  readonly enrollmentStatus: EnrollmentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EnrollmentHistoryRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly studentId: string;
  readonly academicYearId: string;
  readonly classId?: string;
  readonly eventName: EnrollmentHistoryEventName;
  readonly fromClassId?: string;
  readonly toClassId?: string;
  readonly movementDate?: Date;
  readonly reason?: string;
  readonly createdAt: Date;
  readonly createdBy: string;
}

export interface EnrollmentActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface EnrollmentAuditEvent {
  readonly eventName: EnrollmentHistoryEventName;
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "Enrollment" | "EnrollmentHistory";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface EnrollmentAuditSink {
  record(event: EnrollmentAuditEvent): Promise<void> | void;
}

