import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { AcademicRepository } from "../academic/academic.repository.js";
import type { AcademicYearRecord, ClassRecord, TermRecord } from "../academic/academic-context.js";
import type { EnrollmentRecord, EnrollmentStatus } from "../enrollment/enrollment-context.js";
import type { EnrollmentRepository } from "../enrollment/enrollment.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { StudentRepository } from "../student/student.repository.js";
import type { AttendanceAuditSink, AttendanceRecord, AttendanceStatus, AttendanceSummary } from "./attendance-context.js";
import type { AttendanceRepository } from "./attendance.repository.js";

export interface AttendanceServiceOptions {
  readonly repository: AttendanceRepository;
  readonly enrollmentRepository: EnrollmentRepository;
  readonly studentRepository: StudentRepository;
  readonly academicRepository: AcademicRepository;
  readonly auditSink?: AttendanceAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
  readonly teacherAssignmentResolver?: (input: {
    readonly actorId: string;
    readonly schoolId: string;
    readonly classId: string;
  }) => Promise<boolean> | boolean;
}

export interface MarkAttendanceInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly academicYearId: string;
  readonly termId: string;
  readonly classId: string;
  readonly attendanceDate: Date;
  readonly status: AttendanceStatus;
  readonly remarks?: string;
}

export interface UpdateAttendanceInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly attendanceId: string;
  readonly attendanceDate?: Date;
  readonly status?: AttendanceStatus;
  readonly remarks?: string;
}

export interface ListAttendanceInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly enrollmentId?: string;
  readonly studentId?: string;
  readonly academicYearId?: string;
  readonly termId?: string;
  readonly classId?: string;
  readonly attendanceDate?: Date;
  readonly status?: AttendanceStatus;
}

export interface BulkAttendanceInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly termId: string;
  readonly classId: string;
  readonly attendanceDate: Date;
  readonly entries: readonly { readonly enrollmentId: string; readonly status: AttendanceStatus; readonly remarks?: string }[];
}

export interface SummaryInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly studentId?: string;
  readonly classId?: string;
  readonly academicYearId?: string;
  readonly termId?: string;
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

function canManageAttendance(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
}

function isTeacher(actor: SchoolActorContext): boolean {
  return actor.roles.includes("teacher");
}

function normalizeDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function sameDate(left: Date, right: Date): boolean {
  return normalizeDateKey(left) === normalizeDateKey(right);
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
      resourceType: "Attendance",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function sortAttendance(records: readonly AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort((left, right) => {
    if (left.attendanceDate.getTime() !== right.attendanceDate.getTime()) {
      return left.attendanceDate.getTime() - right.attendanceDate.getTime();
    }

    return left.enrollmentId.localeCompare(right.enrollmentId);
  });
}

function isAttendanceAccessibleByTeacher(actor: SchoolActorContext, attendance: AttendanceRecord, isAssigned: boolean): boolean {
  if (!isTeacher(actor)) {
    return true;
  }

  return isAssigned;
}

export class AttendanceService {
  public constructor(private readonly options: AttendanceServiceOptions) {}

  public async markAttendance(input: MarkAttendanceInput): Promise<AttendanceRecord> {
    await this.assertActorCanManageClass(input.actor, input.schoolId, input.classId);
    const enrollment = await this.mustFindEnrollment(input.schoolId, input.enrollmentId);
    const academicYear = await this.mustFindAcademicYear(input.schoolId, input.academicYearId);
    const term = await this.mustFindTerm(input.schoolId, input.termId);
    const classRecord = await this.mustFindClass(input.schoolId, input.classId);

    this.assertEnrollmentMatchesContext(enrollment, academicYear, term, classRecord);
    this.assertAttendanceWindow(academicYear, term, input.attendanceDate);
    this.assertEnrollmentActive(enrollment);

    const duplicate = await this.options.repository.findAttendanceByEnrollmentAndDate(
      input.schoolId,
      input.enrollmentId,
      input.attendanceDate
    );

    if (duplicate) {
      throw new AppError("Attendance already exists for this enrollment and date", {
        status: 409,
        code: "attendance_duplicate"
      });
    }

    const now = this.clock();
    const record: AttendanceRecord = {
      id: this.idFactory("attendance"),
      schoolId: input.schoolId,
      enrollmentId: input.enrollmentId,
      academicYearId: input.academicYearId,
      termId: input.termId,
      classId: input.classId,
      attendanceDate: cloneRecord(input.attendanceDate),
      status: input.status,
      remarks: input.remarks?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };

    const created = await this.options.repository.createAttendance(record);

    await this.audit({
      eventName: "attendance.marked",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Attendance",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        enrollmentId: created.enrollmentId,
        classId: created.classId,
        termId: created.termId,
        attendanceDate: normalizeDateKey(created.attendanceDate),
        status: created.status
      }
    });

    return created;
  }

  public async updateAttendance(input: UpdateAttendanceInput): Promise<AttendanceRecord> {
    const current = await this.mustFindAttendance(input.schoolId, input.attendanceId);
    await this.assertActorCanManageClass(input.actor, input.schoolId, current.classId);

    const enrollment = await this.mustFindEnrollment(input.schoolId, current.enrollmentId);
    const academicYear = await this.mustFindAcademicYear(input.schoolId, current.academicYearId);
    const term = await this.mustFindTerm(input.schoolId, current.termId);

    this.assertEnrollmentMatchesContext(enrollment, academicYear, term, await this.mustFindClass(input.schoolId, current.classId));
    this.assertEnrollmentActive(enrollment);

    const nextAttendanceDate = input.attendanceDate ?? current.attendanceDate;
    this.assertAttendanceWindow(academicYear, term, nextAttendanceDate);

    if (!sameDate(nextAttendanceDate, current.attendanceDate)) {
      const duplicate = await this.options.repository.findAttendanceByEnrollmentAndDate(input.schoolId, current.enrollmentId, nextAttendanceDate);

      if (duplicate && duplicate.id !== current.id) {
        throw new AppError("Attendance already exists for this enrollment and date", {
          status: 409,
          code: "attendance_duplicate"
        });
      }
    }

    const updated = await this.options.repository.updateAttendance(input.attendanceId, input.schoolId, {
      attendanceDate: cloneRecord(nextAttendanceDate),
      status: input.status ?? current.status,
      remarks: input.remarks !== undefined ? input.remarks.trim() || undefined : current.remarks,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Attendance not found", {
        status: 404,
        code: "attendance_not_found"
      });
    }

    await this.audit({
      eventName: "attendance.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Attendance",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        attendanceDate: normalizeDateKey(updated.attendanceDate),
        status: updated.status
      }
    });

    return updated;
  }

  public async getAttendance(actor: SchoolActorContext, schoolId: string, attendanceId: string): Promise<AttendanceRecord> {
    const attendance = await this.mustFindAttendance(schoolId, attendanceId);
    await this.assertActorCanManageClass(actor, schoolId, attendance.classId);
    return attendance;
  }

  public async listAttendance(input: ListAttendanceInput): Promise<readonly AttendanceRecord[]> {
    const records = await this.options.repository.findAttendanceBySchoolId(input.schoolId);
    const filtered = records.filter((record) => {
      if (input.enrollmentId && record.enrollmentId !== input.enrollmentId) {
        return false;
      }

      if (input.academicYearId && record.academicYearId !== input.academicYearId) {
        return false;
      }

      if (input.termId && record.termId !== input.termId) {
        return false;
      }

      if (input.classId && record.classId !== input.classId) {
        return false;
      }

      if (input.attendanceDate && !sameDate(record.attendanceDate, input.attendanceDate)) {
        return false;
      }

      if (input.status && record.status !== input.status) {
        return false;
      }

      return true;
    });

    if (isTeacher(input.actor)) {
      const allowed = [];

      for (const record of filtered) {
        if (await this.canTeacherAccessClass(input.actor, input.schoolId, record.classId)) {
          allowed.push(record);
        }
      }

      return sortAttendance(allowed);
    }

    await this.assertActorCanManageSchool(input.actor, input.schoolId);
    return sortAttendance(filtered);
  }

  public async markClassAttendance(input: BulkAttendanceInput): Promise<readonly AttendanceRecord[]> {
    await this.assertActorCanManageClass(input.actor, input.schoolId, input.classId);
    const academicYear = await this.mustFindAcademicYear(input.schoolId, input.academicYearId);
    const term = await this.mustFindTerm(input.schoolId, input.termId);
    const classRecord = await this.mustFindClass(input.schoolId, input.classId);
    this.assertAttendanceWindow(academicYear, term, input.attendanceDate);

    if (classRecord.academicYearId !== academicYear.id || term.academicYearId !== academicYear.id) {
      throw new AppError("Class, term, and academic year must belong to the same tenant context", {
        status: 409,
        code: "attendance_context_mismatch"
      });
    }

    const enrollments = await Promise.all(
      input.entries.map(async (entry) => {
        const enrollment = await this.mustFindEnrollment(input.schoolId, entry.enrollmentId);
        this.assertEnrollmentMatchesContext(enrollment, academicYear, term, classRecord);
        this.assertEnrollmentActive(enrollment);

        if (enrollment.classId !== input.classId) {
          throw new AppError("Enrollment does not belong to the class", {
            status: 409,
            code: "attendance_enrollment_class_mismatch"
          });
        }

        return enrollment;
      })
    );

    for (const enrollment of enrollments) {
      const duplicate = await this.options.repository.findAttendanceByEnrollmentAndDate(input.schoolId, enrollment.id, input.attendanceDate);

      if (duplicate) {
        throw new AppError("Attendance already exists for this enrollment and date", {
          status: 409,
          code: "attendance_duplicate"
        });
      }
    }

    const now = this.clock();
    const created: AttendanceRecord[] = [];

    for (const entry of input.entries) {
      const record: AttendanceRecord = {
        id: this.idFactory("attendance"),
        schoolId: input.schoolId,
        enrollmentId: entry.enrollmentId,
        academicYearId: input.academicYearId,
        termId: input.termId,
        classId: input.classId,
        attendanceDate: cloneRecord(input.attendanceDate),
        status: entry.status,
        remarks: entry.remarks?.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };

      created.push(await this.options.repository.createAttendance(record));
    }

    await this.audit({
      eventName: "attendance.bulk_marked",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "AttendanceBulk",
      resourceId: input.classId,
      outcome: "success",
      metadata: {
        classId: input.classId,
        termId: input.termId,
        attendanceDate: normalizeDateKey(input.attendanceDate),
        entryCount: created.length
      }
    });

    return created;
  }

  public async getStudentAttendanceHistory(
    actor: SchoolActorContext,
    schoolId: string,
    studentId: string
  ): Promise<readonly AttendanceRecord[]> {
    await this.assertActorCanAccessStudentHistory(actor, schoolId, studentId);
    const studentEnrollments = await this.options.enrollmentRepository.findEnrollmentsByStudentId(schoolId, studentId);
    const enrollmentIds = new Set(studentEnrollments.map((record) => record.id));
    const records = await this.options.repository.findAttendanceBySchoolId(schoolId);
    return sortAttendance(records.filter((record) => enrollmentIds.has(record.enrollmentId)));
  }

  public async getClassAttendanceHistory(
    actor: SchoolActorContext,
    schoolId: string,
    classId: string
  ): Promise<readonly AttendanceRecord[]> {
    await this.assertActorCanManageClass(actor, schoolId, classId);
    return sortAttendance(await this.options.repository.findAttendanceByClassId(schoolId, classId));
  }

  public async getAttendanceByDate(
    actor: SchoolActorContext,
    schoolId: string,
    attendanceDate: Date,
    classId?: string
  ): Promise<readonly AttendanceRecord[]> {
    if (classId) {
      await this.assertActorCanManageClass(actor, schoolId, classId);
    } else {
      await this.assertActorCanManageSchool(actor, schoolId);
    }

    const records = await this.options.repository.findAttendanceByDate(schoolId, attendanceDate);
    return sortAttendance(classId ? records.filter((record) => record.classId === classId) : records);
  }

  public async getAttendanceSummary(input: SummaryInput): Promise<AttendanceSummary> {
    if (input.classId) {
      await this.assertActorCanManageClass(input.actor, input.schoolId, input.classId);
    } else if (input.studentId) {
      await this.assertActorCanAccessStudentHistory(input.actor, input.schoolId, input.studentId);
    } else {
      await this.assertActorCanManageSchool(input.actor, input.schoolId);
    }

    const records = await this.options.repository.findAttendanceBySchoolId(input.schoolId);
    let filtered = records.filter((record) => {
      if (input.classId && record.classId !== input.classId) {
        return false;
      }

      if (input.academicYearId && record.academicYearId !== input.academicYearId) {
        return false;
      }

      if (input.termId && record.termId !== input.termId) {
        return false;
      }

      return true;
    });

    if (input.studentId) {
      const studentEnrollments = await this.options.enrollmentRepository.findEnrollmentsByStudentId(input.schoolId, input.studentId);
      const enrollmentIds = new Set(studentEnrollments.map((record) => record.id));
      filtered = filtered.filter((record) => enrollmentIds.has(record.enrollmentId));
    }

    const totalDays = filtered.length;
    const presentDays = filtered.filter((record) => record.status === "present").length;
    const absentDays = filtered.filter((record) => record.status === "absent").length;
    const lateDays = filtered.filter((record) => record.status === "late").length;
    const excusedDays = filtered.filter((record) => record.status === "excused").length;
    const attendedDays = presentDays + lateDays + excusedDays;
    const attendancePercentage = totalDays === 0 ? 0 : Math.round((attendedDays / totalDays) * 10000) / 100;

    return {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      attendancePercentage
    };
  }

  private async assertActorCanManageSchool(actor: SchoolActorContext, schoolId: string): Promise<void> {
    if (canManageAttendance(actor, schoolId) || isTeacher(actor)) {
      return;
    }

    requirePermission(actor, false, "attendance.access", schoolId);
  }

  private async assertActorCanManageClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<void> {
    if (canManageAttendance(actor, schoolId)) {
      return;
    }

    if (!isTeacher(actor)) {
      requirePermission(actor, false, "attendance.access", classId);
      return;
    }

    const allowed = await this.canTeacherAccessClass(actor, schoolId, classId);

    if (!allowed) {
      requirePermission(actor, false, "attendance.class_assignment_missing", classId);
    }
  }

  private async assertActorCanAccessStudentHistory(actor: SchoolActorContext, schoolId: string, studentId: string): Promise<void> {
    if (canManageAttendance(actor, schoolId)) {
      return;
    }

    const enrollment = await this.findActiveEnrollmentForStudent(schoolId, studentId);

    if (!enrollment) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    await this.assertActorCanManageClass(actor, schoolId, enrollment.classId);
  }

  private async canTeacherAccessClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<boolean> {
    if (!isTeacher(actor)) {
      return true;
    }

    if (!this.options.teacherAssignmentResolver) {
      throw new AppError("Teacher assignment resolver unavailable", {
        status: 500,
        code: "attendance_teacher_assignment_unavailable"
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

  private async findActiveEnrollmentForStudent(schoolId: string, studentId: string): Promise<EnrollmentRecord | null> {
    const enrollments = await this.options.enrollmentRepository.findEnrollmentsByStudentId(schoolId, studentId);
    return (
      enrollments.find((record) => record.enrollmentStatus === "active") ?? null
    );
  }

  private async mustFindAttendance(schoolId: string, attendanceId: string): Promise<AttendanceRecord> {
    const attendance = await this.options.repository.findAttendanceById(attendanceId);

    if (!attendance || attendance.schoolId !== schoolId) {
      throw new AppError("Attendance not found", {
        status: 404,
        code: "attendance_not_found"
      });
    }

    return attendance;
  }

  private async mustFindEnrollment(schoolId: string, enrollmentId: string): Promise<EnrollmentRecord> {
    const enrollment = await this.options.enrollmentRepository.findEnrollmentById(enrollmentId);

    if (!enrollment || enrollment.schoolId !== schoolId) {
      throw new AppError("Enrollment not found", {
        status: 404,
        code: "enrollment_not_found"
      });
    }

    return enrollment;
  }

  private async mustFindAcademicYear(schoolId: string, academicYearId: string): Promise<AcademicYearRecord> {
    const academicYear = await this.options.academicRepository.findAcademicYearById(academicYearId);

    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new AppError("Academic year not found", {
        status: 404,
        code: "academic_year_not_found"
      });
    }

    if (academicYear.status !== "open") {
      throw new AppError("Attendance requires an active academic year", {
        status: 409,
        code: "attendance_academic_year_inactive"
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

    if (term.status !== "open") {
      throw new AppError("Attendance requires an active term", {
        status: 409,
        code: "attendance_term_inactive"
      });
    }

    return term;
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

  private assertEnrollmentMatchesContext(
    enrollment: EnrollmentRecord,
    academicYear: AcademicYearRecord,
    term: TermRecord,
    classRecord: ClassRecord
  ): void {
    if (enrollment.academicYearId !== academicYear.id || term.academicYearId !== academicYear.id || classRecord.academicYearId !== academicYear.id) {
      throw new AppError("Attendance context mismatch", {
        status: 409,
        code: "attendance_context_mismatch"
      });
    }
  }

  private assertAttendanceWindow(academicYear: AcademicYearRecord, term: TermRecord, attendanceDate: Date): void {
    if (normalizeDateKey(attendanceDate) < normalizeDateKey(term.startDate) || normalizeDateKey(attendanceDate) > normalizeDateKey(term.endDate)) {
      throw new AppError("Attendance date must fall within the term range", {
        status: 400,
        code: "attendance_date_out_of_range"
      });
    }

    if (academicYear.status !== "open") {
      throw new AppError("Attendance requires an active academic year", {
        status: 409,
        code: "attendance_academic_year_inactive"
      });
    }

    if (term.status !== "open") {
      throw new AppError("Attendance requires an active term", {
        status: 409,
        code: "attendance_term_inactive"
      });
    }
  }

  private assertEnrollmentActive(enrollment: EnrollmentRecord): void {
    if (enrollment.enrollmentStatus !== "active") {
      throw new AppError("Attendance requires active enrollment", {
        status: 409,
        code: "attendance_enrollment_inactive"
      });
    }
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(prefix: string): string {
    return this.options.idFactory?.(prefix) ?? defaultIdFactory(prefix);
  }

  private async audit(event: Parameters<NonNullable<AttendanceServiceOptions["auditSink"]>["record"]>[0]): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
