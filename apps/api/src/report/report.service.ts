import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { AcademicRepository } from "../academic/academic.repository.js";
import type { AcademicYearRecord, ClassRecord, SubjectRecord, TermRecord } from "../academic/academic-context.js";
import type { AttendanceRepository } from "../attendance/attendance.repository.js";
import type { AttendanceRecord, AttendanceSummary } from "../attendance/attendance-context.js";
import type { EnrollmentRepository } from "../enrollment/enrollment.repository.js";
import type { EnrollmentRecord } from "../enrollment/enrollment-context.js";
import type { ResultRepository } from "../result/result.repository.js";
import type { ResultRecord } from "../result/result-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { StudentRecord } from "../student/student-context.js";
import type { StudentRepository } from "../student/student.repository.js";
import type { ReportCardAuditSink, ReportCardRecord, ReportCardStatus, ReportGradingRemarkRecord, ReportSubjectPositionRecord, ReportSubjectResultRecord } from "./report-context.js";
import type { ReportCardRepository, ReportCardScope } from "./report.repository.js";

export interface ReportServiceOptions {
  readonly repository: ReportCardRepository;
  readonly resultRepository: ResultRepository;
  readonly attendanceRepository: AttendanceRepository;
  readonly enrollmentRepository: EnrollmentRepository;
  readonly studentRepository: StudentRepository;
  readonly academicRepository: AcademicRepository;
  readonly auditSink?: ReportCardAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
  readonly teacherAssignmentResolver?: (input: {
    readonly actorId: string;
    readonly schoolId: string;
    readonly classId: string;
  }) => Promise<boolean> | boolean;
}

export interface GenerateReportCardInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly studentId: string;
  readonly classId: string;
  readonly academicYearId: string;
  readonly termId: string;
  readonly teacherComments?: string;
  readonly principalComments?: string;
}

export interface RegenerateReportCardInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly reportId: string;
  readonly teacherComments?: string;
  readonly principalComments?: string;
}

export interface PublishReportCardInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly reportId: string;
}

export interface UnpublishReportCardInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly reportId: string;
}

export interface GetReportCardInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly reportId: string;
}

export interface ListReportCardsInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly studentId?: string;
  readonly classId?: string;
  readonly academicYearId?: string;
  readonly termId?: string;
  readonly status?: ReportCardStatus;
}

interface ReportComputationContext {
  readonly student: StudentRecord;
  readonly classRecord: ClassRecord;
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
}

interface AcademicSubjectMapEntry {
  readonly id: string;
  readonly name: string;
}

function defaultClock(): Date {
  return new Date();
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

function hasRole(actor: SchoolActorContext, role: CanonicalRole): boolean {
  return actor.roles.includes(role);
}

function canManageReports(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
}

function isTeacher(actor: SchoolActorContext): boolean {
  return actor.roles.includes("teacher");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeComment(value?: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function requirePermission(actor: SchoolActorContext, allowed: boolean, eventName: string, resourceId: string): void {
  if (allowed) {
    return;
  }

  throw new AppError("Permission denied", {
    status: 403,
    code: "permission_denied",
    details: {
      eventName,
      resourceType: "ReportCard",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function sortReports(records: readonly ReportCardRecord[]): ReportCardRecord[] {
  const statusPriority: Record<ReportCardStatus, number> = {
    published: 0,
    generated: 1,
    draft: 2
  };

  return [...records].sort((left, right) => {
    if (statusPriority[left.status] !== statusPriority[right.status]) {
      return statusPriority[left.status] - statusPriority[right.status];
    }

    if (left.termId !== right.termId) {
      return left.termId.localeCompare(right.termId);
    }

    if (left.classId !== right.classId) {
      return left.classId.localeCompare(right.classId);
    }

    return left.studentId.localeCompare(right.studentId);
  });
}

function compareRankEntries(left: { readonly key: string; readonly score: number }, right: { readonly key: string; readonly score: number }): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.key.localeCompare(right.key);
}

function buildPositionMap(entries: readonly { readonly key: string; readonly score: number }[]): Map<string, number> {
  const ordered = [...entries].sort(compareRankEntries);
  const positions = new Map<string, number>();

  ordered.forEach((entry, index) => {
    positions.set(entry.key, index + 1);
  });

  return positions;
}

export class ReportService {
  public constructor(private readonly options: ReportServiceOptions) {}

  public async generateReport(input: GenerateReportCardInput): Promise<ReportCardRecord> {
    const computation = await this.buildComputationContext(input.schoolId, input.studentId, input.classId, input.academicYearId, input.termId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, input.classId);

    const payload = this.buildReportRecordPayload(computation, {
      teacherComments: normalizeComment(input.teacherComments),
      principalComments: normalizeComment(input.principalComments)
    });

    const existing = await this.options.repository.findReportByScope(input.schoolId, {
      studentId: input.studentId,
      classId: input.classId,
      academicYearId: input.academicYearId,
      termId: input.termId
    });

    if (existing && existing.status === "published") {
      throw new AppError("Published reports cannot be regenerated", {
        status: 409,
        code: "report_card_published"
      });
    }

    const now = this.clock();
    const record: ReportCardRecord = existing
      ? await this.updateExistingReport(existing.id, input.schoolId, payload, "generated", now)
      : await this.options.repository.createReport({
          id: this.idFactory("report_card"),
          schoolId: input.schoolId,
          studentId: input.studentId,
          classId: input.classId,
          academicYearId: input.academicYearId,
          termId: input.termId,
          ...payload,
          status: "generated",
          generatedAt: now,
          createdAt: now,
          updatedAt: now
        });

    await this.audit({
      eventName: "report_card.generated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "ReportCard",
      resourceId: record.id,
      outcome: "success",
      metadata: {
        studentId: record.studentId,
        classId: record.classId,
        academicYearId: record.academicYearId,
        termId: record.termId,
        totalScore: record.totalScore,
        average: record.average,
        overallPosition: record.overallPosition
      }
    });

    return record;
  }

  public async regenerateReport(input: RegenerateReportCardInput): Promise<ReportCardRecord> {
    const current = await this.mustFindReport(input.schoolId, input.reportId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, current.classId);

    if (current.status === "published") {
      throw new AppError("Published reports cannot be regenerated", {
        status: 409,
        code: "report_card_published"
      });
    }

    const computation = await this.buildComputationContext(input.schoolId, current.studentId, current.classId, current.academicYearId, current.termId);
    const payload = this.buildReportRecordPayload(computation, {
      teacherComments: normalizeComment(input.teacherComments) ?? current.teacherComments,
      principalComments: normalizeComment(input.principalComments) ?? current.principalComments
    });

    const updated = await this.updateExistingReport(current.id, input.schoolId, payload, "generated", this.clock());

    await this.audit({
      eventName: "report_card.generated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "ReportCard",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        studentId: updated.studentId,
        classId: updated.classId,
        academicYearId: updated.academicYearId,
        termId: updated.termId,
        totalScore: updated.totalScore,
        average: updated.average,
        overallPosition: updated.overallPosition
      }
    });

    return updated;
  }

  public async publishReport(input: PublishReportCardInput): Promise<ReportCardRecord> {
    const current = await this.mustFindReport(input.schoolId, input.reportId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, current.classId);

    if (current.status === "published") {
      throw new AppError("Report is already published", {
        status: 409,
        code: "report_card_published"
      });
    }

    const now = this.clock();
    const updated = await this.options.repository.updateReport(input.reportId, input.schoolId, {
      status: "published",
      publishedAt: now,
      publishedBy: input.actor.actorId,
      unpublishedAt: undefined,
      unpublishedBy: undefined,
      updatedAt: now
    });

    if (!updated) {
      throw new AppError("Report not found", {
        status: 404,
        code: "report_card_not_found"
      });
    }

    await this.audit({
      eventName: "report_card.published",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "ReportCard",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        studentId: updated.studentId,
        classId: updated.classId,
        academicYearId: updated.academicYearId,
        termId: updated.termId
      }
    });

    return updated;
  }

  public async unpublishReport(input: UnpublishReportCardInput): Promise<ReportCardRecord> {
    const current = await this.mustFindReport(input.schoolId, input.reportId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, current.classId);

    if (current.status !== "published") {
      throw new AppError("Report is not published", {
        status: 409,
        code: "report_card_not_published"
      });
    }

    const now = this.clock();
    const updated = await this.options.repository.updateReport(input.reportId, input.schoolId, {
      status: "generated",
      unpublishedAt: now,
      unpublishedBy: input.actor.actorId,
      updatedAt: now
    });

    if (!updated) {
      throw new AppError("Report not found", {
        status: 404,
        code: "report_card_not_found"
      });
    }

    await this.audit({
      eventName: "report_card.unpublished",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "ReportCard",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        studentId: updated.studentId,
        classId: updated.classId,
        academicYearId: updated.academicYearId,
        termId: updated.termId
      }
    });

    return updated;
  }

  public async getReport(input: GetReportCardInput): Promise<ReportCardRecord> {
    const current = await this.mustFindReport(input.schoolId, input.reportId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, current.classId);
    return current;
  }

  public async listReports(input: ListReportCardsInput): Promise<readonly ReportCardRecord[]> {
    const records = await this.options.repository.findReportsBySchoolId(input.schoolId);
    const filtered = records.filter((record) => {
      if (input.studentId && record.studentId !== input.studentId) {
        return false;
      }

      if (input.classId && record.classId !== input.classId) {
        return false;
      }

      if (input.academicYearId && record.academicYearId !== input.academicYearId) {
        return false;
      }

      if (input.termId && record.termId !== input.termId) {
        return false;
      }

      if (input.status && record.status !== input.status) {
        return false;
      }

      return true;
    });

    if (canManageReports(input.actor, input.schoolId)) {
      return sortReports(filtered);
    }

    if (!isTeacher(input.actor)) {
      requirePermission(input.actor, false, "report_card.access", input.schoolId);
    }

    return sortReports(await this.filterTeacherAccessibleReports(input.actor, input.schoolId, filtered));
  }

  private async buildComputationContext(
    schoolId: string,
    studentId: string,
    classId: string,
    academicYearId: string,
    termId: string
  ): Promise<ReportComputationContext> {
    const student = await this.mustFindStudent(schoolId, studentId);
    const classRecord = await this.mustFindClass(schoolId, classId);
    const academicYear = await this.mustFindAcademicYear(schoolId, academicYearId);
    const term = await this.mustFindTerm(schoolId, termId);
    const enrollment = await this.mustFindActiveEnrollment(schoolId, studentId, academicYearId, classId);

    this.assertReportContext(student, classRecord, academicYear, term, enrollment);

    const subjectMap = await this.loadSubjectMap(schoolId);
    const targetResults = await this.options.resultRepository.findResultsByScope(schoolId, {
      studentId,
      classId,
      academicYearId,
      termId
    });

    if (targetResults.length === 0) {
      throw new AppError("Results are required to generate a report card", {
        status: 409,
        code: "report_card_results_missing"
      });
    }

    const classResults = await this.options.resultRepository.findResultsByScope(schoolId, {
      classId,
      academicYearId,
      termId
    });

    const subjectIds = [...new Set(classResults.map((record) => record.subjectId))].sort();
    const subjectResults = this.buildSubjectResults(targetResults, subjectIds, subjectMap);
    const gradingRemarks = subjectResults.map((entry) => ({
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      grade: entry.grade,
      remark: entry.remark
    }));
    const attendanceSummary = await this.buildAttendanceSummary(schoolId, studentId, classId, academicYearId, termId);
    const totalScore = round2(subjectResults.reduce((sum, entry) => sum + entry.finalScore, 0));
    const average = round2(totalScore / subjectResults.length);
    const overallPosition = this.computeOverallPosition(classResults, subjectIds, studentId);
    const subjectPositions = subjectResults.map((entry) => ({
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      position: entry.position
    }));

    return {
      student,
      classRecord,
      academicYear,
      term,
      enrollment,
      attendanceSummary,
      subjectResults,
      subjectPositions,
      gradingRemarks,
      totalScore,
      average,
      overallPosition
    };
  }

  private buildReportRecordPayload(
    computation: ReportComputationContext,
    comments: { readonly teacherComments?: string; readonly principalComments?: string }
  ): Pick<
    ReportCardRecord,
    | "student"
    | "class"
    | "academicYear"
    | "term"
    | "enrollment"
    | "attendanceSummary"
    | "subjectResults"
    | "subjectPositions"
    | "gradingRemarks"
    | "totalScore"
    | "average"
    | "overallPosition"
    | "teacherComments"
    | "principalComments"
  > {
    return {
      student: cloneRecord(computation.student),
      class: cloneRecord(computation.classRecord),
      academicYear: cloneRecord(computation.academicYear),
      term: cloneRecord(computation.term),
      enrollment: cloneRecord(computation.enrollment),
      attendanceSummary: cloneRecord(computation.attendanceSummary),
      subjectResults: cloneRecord(computation.subjectResults),
      subjectPositions: cloneRecord(computation.subjectPositions),
      gradingRemarks: cloneRecord(computation.gradingRemarks),
      totalScore: computation.totalScore,
      average: computation.average,
      overallPosition: computation.overallPosition,
      teacherComments: comments.teacherComments,
      principalComments: comments.principalComments
    };
  }

  private async updateExistingReport(
    reportId: string,
    schoolId: string,
    payload: Pick<
      ReportCardRecord,
      | "student"
      | "class"
      | "academicYear"
      | "term"
      | "enrollment"
      | "attendanceSummary"
      | "subjectResults"
      | "subjectPositions"
      | "gradingRemarks"
      | "totalScore"
      | "average"
      | "overallPosition"
      | "teacherComments"
      | "principalComments"
    >,
    status: ReportCardStatus,
    generatedAt: Date
  ): Promise<ReportCardRecord> {
    const updated = await this.options.repository.updateReport(reportId, schoolId, {
      ...payload,
      status,
      generatedAt,
      publishedAt: undefined,
      publishedBy: undefined,
      unpublishedAt: undefined,
      unpublishedBy: undefined,
      updatedAt: generatedAt
    });

    if (!updated) {
      throw new AppError("Report not found", {
        status: 404,
        code: "report_card_not_found"
      });
    }

    return updated;
  }

  private buildSubjectResults(
    targetResults: readonly ResultRecord[],
    subjectIds: readonly string[],
    subjectMap: Map<string, AcademicSubjectMapEntry>
  ): readonly ReportSubjectResultRecord[] {
    if (subjectIds.length === 0) {
      throw new AppError("Results are required to generate a report card", {
        status: 409,
        code: "report_card_results_missing"
      });
    }

    const targetBySubject = new Map(targetResults.map((record) => [record.subjectId, record] as const));
    const missingSubjects = subjectIds.filter((subjectId) => !targetBySubject.has(subjectId));

    if (missingSubjects.length > 0) {
      throw new AppError("Required subject results are missing", {
        status: 409,
        code: "report_card_results_missing",
        details: {
          subjectIds: missingSubjects
        }
      });
    }

    const positionMap = buildPositionMap(
      targetResults.map((record) => ({
        key: record.subjectId,
        score: record.finalScore
      }))
    );

    return subjectIds
      .map((subjectId) => {
        const subject = subjectMap.get(subjectId);
        const result = targetBySubject.get(subjectId);

        if (!subject || !result) {
          throw new AppError("Subject not found", {
            status: 404,
            code: "subject_not_found"
          });
        }

        const position = positionMap.get(subjectId);

        if (!position) {
          throw new AppError("Subject ranking unavailable", {
            status: 500,
            code: "report_card_ranking_unavailable"
          });
        }

        return {
          subjectId,
          subjectName: subject.name,
          finalScore: result.finalScore,
          grade: result.grade,
          remark: result.remark,
          position
        };
      })
      .sort((left, right) => left.subjectName.localeCompare(right.subjectName));
  }

  private computeOverallPosition(
    classResults: readonly ResultRecord[],
    subjectIds: readonly string[],
    studentId: string
  ): number {
    const byStudent = new Map<string, ResultRecord[]>();

    for (const record of classResults) {
      const current = byStudent.get(record.studentId);
      if (current) {
        current.push(record);
      } else {
        byStudent.set(record.studentId, [record]);
      }
    }

    const totals = [...byStudent.entries()]
      .filter(([, records]) => subjectIds.every((subjectId) => records.some((record) => record.subjectId === subjectId)))
      .map(([key, records]) => ({
        key,
        score: round2(records.reduce((sum, record) => sum + record.finalScore, 0))
      }));

    const positions = buildPositionMap(totals);
    const position = positions.get(studentId);

    if (!position) {
      throw new AppError("Overall ranking unavailable", {
        status: 500,
        code: "report_card_ranking_unavailable"
      });
    }

    return position;
  }

  private async buildAttendanceSummary(
    schoolId: string,
    studentId: string,
    classId: string,
    academicYearId: string,
    termId: string
  ): Promise<AttendanceSummary> {
    const enrollments = await this.options.enrollmentRepository.findEnrollmentsByStudentId(schoolId, studentId);
    const enrollmentIds = new Set(
      enrollments.filter((record) => record.classId === classId && record.academicYearId === academicYearId).map((record) => record.id)
    );
    const records = await this.options.attendanceRepository.findAttendanceBySchoolId(schoolId);
    const filtered = records.filter(
      (record) =>
        enrollmentIds.has(record.enrollmentId) &&
        record.classId === classId &&
        record.academicYearId === academicYearId &&
        record.termId === termId
    );

    const totalDays = filtered.length;
    const presentDays = filtered.filter((record) => record.status === "present").length;
    const absentDays = filtered.filter((record) => record.status === "absent").length;
    const lateDays = filtered.filter((record) => record.status === "late").length;
    const excusedDays = filtered.filter((record) => record.status === "excused").length;
    const attendancePercentage = totalDays === 0 ? 0 : round2(((presentDays + lateDays + excusedDays) / totalDays) * 100);

    return {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      attendancePercentage
    };
  }

  private async loadSubjectMap(schoolId: string): Promise<Map<string, AcademicSubjectMapEntry>> {
    const subjects = await this.options.academicRepository.findSubjectsBySchoolId(schoolId);
    const map = new Map<string, AcademicSubjectMapEntry>();

    for (const subject of subjects) {
      map.set(subject.id, {
        id: subject.id,
        name: subject.name
      });
    }

    return map;
  }

  private async mustFindStudent(schoolId: string, studentId: string): Promise<StudentRecord> {
    const student = await this.options.studentRepository.findStudentById(studentId);

    if (!student || student.schoolId !== schoolId) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    return student;
  }

  private async mustFindClass(schoolId: string, classId: string): Promise<ClassRecord> {
    const classRecord = await this.options.academicRepository.findClassById(classId);

    if (!classRecord || classRecord.schoolId !== schoolId) {
      throw new AppError("Class not found", {
        status: 404,
        code: "class_not_found"
      });
    }

    return classRecord;
  }

  private async mustFindAcademicYear(schoolId: string, academicYearId: string): Promise<AcademicYearRecord> {
    const academicYear = await this.options.academicRepository.findAcademicYearById(academicYearId);

    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new AppError("Academic year not found", {
        status: 404,
        code: "academic_year_not_found"
      });
    }

    return academicYear;
  }

  private async mustFindTerm(schoolId: string, termId: string): Promise<TermRecord> {
    const term = await this.options.academicRepository.findTermById(termId);

    if (!term || term.schoolId !== schoolId) {
      throw new AppError("Term not found", {
        status: 404,
        code: "term_not_found"
      });
    }

    return term;
  }

  private async mustFindActiveEnrollment(
    schoolId: string,
    studentId: string,
    academicYearId: string,
    classId: string
  ): Promise<EnrollmentRecord> {
    const enrollment = await this.options.enrollmentRepository.findActiveEnrollmentByStudentAcademicYear(
      schoolId,
      studentId,
      academicYearId
    );

    if (!enrollment || enrollment.schoolId !== schoolId) {
      throw new AppError("Student requires an active enrollment", {
        status: 409,
        code: "report_card_enrollment_inactive"
      });
    }

    if (enrollment.classId !== classId) {
      throw new AppError("Enrollment does not belong to the requested class", {
        status: 409,
        code: "report_card_enrollment_class_mismatch"
      });
    }

    return enrollment;
  }

  private async assertActorCanAccessClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<void> {
    if (canManageReports(actor, schoolId)) {
      return;
    }

    if (!isTeacher(actor)) {
      requirePermission(actor, false, "report_card.access", classId);
      return;
    }

    const allowed = await this.canTeacherAccessClass(actor, schoolId, classId);

    if (!allowed) {
      requirePermission(actor, false, "report_card.class_assignment_missing", classId);
    }
  }

  private async canTeacherAccessClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<boolean> {
    if (!isTeacher(actor)) {
      return true;
    }

    if (!this.options.teacherAssignmentResolver) {
      throw new AppError("Teacher assignment resolver unavailable", {
        status: 500,
        code: "report_card_teacher_assignment_unavailable"
      });
    }

    return Boolean(
      await this.options.teacherAssignmentResolver({
        actorId: actor.actorId,
        schoolId,
        classId
      })
    );
  }

  private async filterTeacherAccessibleReports(
    actor: SchoolActorContext,
    schoolId: string,
    records: readonly ReportCardRecord[]
  ): Promise<ReportCardRecord[]> {
    const allowed: ReportCardRecord[] = [];

    for (const record of records) {
      if (await this.canTeacherAccessClass(actor, schoolId, record.classId)) {
        allowed.push(record);
      }
    }

    return allowed;
  }

  private assertReportContext(
    student: StudentRecord,
    classRecord: ClassRecord,
    academicYear: AcademicYearRecord,
    term: TermRecord,
    enrollment: EnrollmentRecord
  ): void {
    if (student.status === "archived") {
      throw new AppError("Archived students cannot receive report cards", {
        status: 409,
        code: "report_card_student_archived"
      });
    }

    if (classRecord.academicYearId !== academicYear.id || term.academicYearId !== academicYear.id) {
      throw new AppError("Report card context mismatch", {
        status: 409,
        code: "report_card_context_mismatch"
      });
    }

    if (enrollment.classId !== classRecord.id || enrollment.academicYearId !== academicYear.id) {
      throw new AppError("Enrollment does not match the report context", {
        status: 409,
        code: "report_card_enrollment_mismatch"
      });
    }
  }

  private async mustFindReport(schoolId: string, reportId: string): Promise<ReportCardRecord> {
    const report = await this.options.repository.findReportById(reportId);

    if (!report || report.schoolId !== schoolId) {
      throw new AppError("Report not found", {
        status: 404,
        code: "report_card_not_found"
      });
    }

    return report;
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(prefix: string): string {
    return this.options.idFactory?.(prefix) ?? defaultIdFactory(prefix);
  }

  private async audit(event: Parameters<NonNullable<ReportCardAuditSink["record"]>>[0]): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
