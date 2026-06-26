import type { CanonicalRole } from "@myschoolos/shared";
import type { AcademicYearRecord, ClassRecord, TermRecord } from "../academic/academic-context.js";
import type { AttendanceSummary } from "../attendance/attendance-context.js";
import type { EnrollmentRecord } from "../enrollment/enrollment-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { StudentRecord } from "../student/student-context.js";

export type ReportCardStatus = "draft" | "generated" | "published";

export interface ReportSubjectResultRecord {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly finalScore: number;
  readonly grade: string;
  readonly remark?: string;
  readonly position: number;
}

export interface ReportSubjectPositionRecord {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly position: number;
}

export interface ReportGradingRemarkRecord {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly grade: string;
  readonly remark?: string;
}

export interface ReportCardRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly studentId: string;
  readonly classId: string;
  readonly academicYearId: string;
  readonly termId: string;
  readonly student: StudentRecord;
  readonly class: ClassRecord;
  readonly academicYear: AcademicYearRecord;
  readonly term: TermRecord;
  readonly enrollment: EnrollmentRecord;
  readonly attendanceSummary: AttendanceSummary;
  readonly subjectResults: readonly ReportSubjectResultRecord[];
  readonly subjectPositions: readonly ReportSubjectPositionRecord[];
  readonly gradingRemarks: readonly ReportGradingRemarkRecord[];
  readonly totalScore: number;
  readonly average: number;
  readonly overallPosition: number;
  readonly teacherComments?: string;
  readonly principalComments?: string;
  readonly status: ReportCardStatus;
  readonly generatedAt: Date;
  readonly publishedAt?: Date;
  readonly publishedBy?: string;
  readonly unpublishedAt?: Date;
  readonly unpublishedBy?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ReportCardActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface ReportCardAuditEvent {
  readonly eventName: "report_card.generated" | "report_card.published" | "report_card.unpublished";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "ReportCard";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ReportCardAuditSink {
  record(event: ReportCardAuditEvent): Promise<void> | void;
}
