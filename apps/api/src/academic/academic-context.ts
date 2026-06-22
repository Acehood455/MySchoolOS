import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type AcademicYearStatus = "planned" | "open" | "closed" | "archived";
export type TermStatus = "planned" | "open" | "closed" | "archived";
export type ClassStatus = "draft" | "active" | "suspended" | "archived";
export type SubjectStatus = "draft" | "active" | "inactive" | "archived";

export interface AcademicYearRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly name: string;
  readonly code?: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly status: AcademicYearStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly openedAt?: Date;
  readonly closedAt?: Date;
  readonly archivedAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TermRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly code?: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly status: TermStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly openedAt?: Date;
  readonly closedAt?: Date;
  readonly archivedAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ClassRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly code?: string;
  readonly status: ClassStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly archivedAt?: Date;
  readonly teacherAssignmentIds: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SubjectRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly name: string;
  readonly code?: string;
  readonly status: SubjectStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly archivedAt?: Date;
  readonly teacherAssignmentIds: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AcademicActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface AcademicLifecycleAuditEvent {
  readonly eventName:
    | "academic_year.created"
    | "academic_year.updated"
    | "academic_year.activated"
    | "academic_year.closed"
    | "academic_year.archived"
    | "term.created"
    | "term.updated"
    | "term.activated"
    | "term.closed"
    | "term.archived"
    | "class.created"
    | "class.updated"
    | "class.archived"
    | "subject.created"
    | "subject.updated"
    | "subject.archived";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "AcademicYear" | "Term" | "Class" | "Subject";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AcademicAuditSink {
  record(event: AcademicLifecycleAuditEvent): Promise<void> | void;
}
