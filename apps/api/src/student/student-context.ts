import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type StudentStatus = "active" | "inactive" | "graduated" | "withdrawn" | "archived";
export type StudentGender = "male" | "female" | "other" | "unspecified";

export interface StudentProfileRecord {
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName?: string;
  readonly gender?: StudentGender;
  readonly dateOfBirth?: Date;
  readonly contactInformation?: Readonly<Record<string, unknown>>;
  readonly address?: Readonly<Record<string, unknown>>;
  readonly profilePhotoReference?: string;
}

export interface StudentRecord extends StudentProfileRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly admissionNumber: string;
  readonly admissionDate?: Date;
  readonly status: StudentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly activatedAt?: Date;
  readonly inactivatedAt?: Date;
  readonly graduatedAt?: Date;
  readonly withdrawnAt?: Date;
  readonly archivedAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StudentActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface StudentLifecycleAuditEvent {
  readonly eventName:
    | "student.created"
    | "student.updated"
    | "student.archived"
    | "student.reactivated"
    | "student.graduated"
    | "student.withdrawn";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "Student";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface StudentAuditSink {
  record(event: StudentLifecycleAuditEvent): Promise<void> | void;
}
