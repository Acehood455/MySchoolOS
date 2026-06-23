import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type StaffRoleType = "teacher" | "administrator" | "accountant" | "receptionist" | "librarian" | "other";
export type StaffStatus = "active" | "inactive" | "archived";

export interface StaffRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly employeeNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly gender?: string;
  readonly dateOfBirth?: Date;
  readonly employmentDate?: Date;
  readonly roleType: StaffRoleType;
  readonly status: StaffStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly activatedAt?: Date;
  readonly inactivatedAt?: Date;
  readonly archivedAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type StaffAssignmentStatus = "active" | "removed";

export interface TeacherClassAssignmentRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly staffId: string;
  readonly classId: string;
  readonly status: StaffAssignmentStatus;
  readonly assignedAt: Date;
  readonly removedAt?: Date;
  readonly removedBy?: string;
  readonly removalReason?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TeacherSubjectAssignmentRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly staffId: string;
  readonly subjectId: string;
  readonly status: StaffAssignmentStatus;
  readonly assignedAt: Date;
  readonly removedAt?: Date;
  readonly removedBy?: string;
  readonly removalReason?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StaffActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface StaffLifecycleAuditEvent {
  readonly eventName:
    | "staff.created"
    | "staff.updated"
    | "staff.archived"
    | "staff.reactivated"
    | "teacher.class.assigned"
    | "teacher.class.unassigned"
    | "teacher.subject.assigned"
    | "teacher.subject.unassigned";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "Staff" | "TeacherClassAssignment" | "TeacherSubjectAssignment";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface StaffAuditSink {
  record(event: StaffLifecycleAuditEvent): Promise<void> | void;
}

export interface TenantScopedRecord {
  readonly schoolId: string;
}

export interface TeacherClassTarget extends TenantScopedRecord {
  readonly id: string;
}

export interface TeacherSubjectTarget extends TenantScopedRecord {
  readonly id: string;
}
