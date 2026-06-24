import type { CanonicalRole } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly academicYearId: string;
  readonly termId: string;
  readonly classId: string;
  readonly attendanceDate: Date;
  readonly status: AttendanceStatus;
  readonly remarks?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AttendanceSummary {
  readonly totalDays: number;
  readonly presentDays: number;
  readonly absentDays: number;
  readonly lateDays: number;
  readonly excusedDays: number;
  readonly attendancePercentage: number;
}

export interface AttendanceActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface AttendanceAuditEvent {
  readonly eventName: "attendance.marked" | "attendance.updated" | "attendance.bulk_marked";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "Attendance" | "AttendanceBulk";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AttendanceAuditSink {
  record(event: AttendanceAuditEvent): Promise<void> | void;
}

