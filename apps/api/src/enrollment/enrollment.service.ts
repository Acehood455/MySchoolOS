import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { AcademicRepository } from "../academic/academic.repository.js";
import type { ClassRecord } from "../academic/academic-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { StudentRecord } from "../student/student-context.js";
import type { StudentRepository } from "../student/student.repository.js";
import type {
  EnrollmentAuditSink,
  EnrollmentHistoryEventName,
  EnrollmentHistoryRecord,
  EnrollmentRecord,
  EnrollmentStatus
} from "./enrollment-context.js";
import type { EnrollmentRepository } from "./enrollment.repository.js";

export interface EnrollmentServiceOptions {
  readonly repository: EnrollmentRepository;
  readonly studentRepository: StudentRepository;
  readonly academicRepository: AcademicRepository;
  readonly auditSink?: EnrollmentAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
}

export interface CreateEnrollmentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly studentId: string;
  readonly academicYearId: string;
  readonly classId: string;
  readonly admissionDate?: Date;
  readonly enrollmentStatus?: EnrollmentStatus;
}

export interface UpdateEnrollmentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly admissionDate?: Date;
  readonly enrollmentStatus?: EnrollmentStatus;
}

export interface ListEnrollmentsInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly studentId?: string;
  readonly academicYearId?: string;
  readonly classId?: string;
  readonly enrollmentStatus?: EnrollmentStatus;
}

export interface PromoteStudentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly toClassId: string;
  readonly movementDate?: Date;
  readonly reason?: string;
}

export interface TransferStudentInput extends PromoteStudentInput {}

export interface MoveStudentInput extends PromoteStudentInput {}

function defaultClock(): Date {
  return new Date();
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function hasRole(actor: SchoolActorContext, role: CanonicalRole): boolean {
  return actor.roles.includes(role);
}

function canManageEnrollments(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
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
      resourceType: "Enrollment",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function assertEnrollmentAccess(actor: SchoolActorContext, schoolId: string): void {
  requirePermission(actor, canManageEnrollments(actor, schoolId), "enrollment.access", schoolId);
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

function sortEnrollments(records: readonly EnrollmentRecord[]): EnrollmentRecord[] {
  const priority: Record<EnrollmentStatus, number> = {
    active: 0,
    transferred: 1,
    withdrawn: 2,
    graduated: 3,
    archived: 4
  };

  return [...records].sort((left, right) => {
    if (priority[left.enrollmentStatus] !== priority[right.enrollmentStatus]) {
      return priority[left.enrollmentStatus] - priority[right.enrollmentStatus];
    }

    if (left.studentId !== right.studentId) {
      return left.studentId.localeCompare(right.studentId);
    }

    return left.academicYearId.localeCompare(right.academicYearId);
  });
}

function sortHistory(records: readonly EnrollmentHistoryRecord[]): EnrollmentHistoryRecord[] {
  return [...records].sort((left, right) => {
    const leftTime = left.movementDate?.getTime() ?? left.createdAt.getTime();
    const rightTime = right.movementDate?.getTime() ?? right.createdAt.getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

function requireEnrollmentState(
  current: EnrollmentRecord,
  allowedStatuses: readonly EnrollmentStatus[],
  requestedStatus: EnrollmentStatus
): void {
  if (!allowedStatuses.includes(current.enrollmentStatus)) {
    throw new AppError("Enrollment cannot transition from the current state", {
      status: 409,
      code: "enrollment_lifecycle_invalid_transition",
      details: {
        currentStatus: current.enrollmentStatus,
        requestedStatus
      }
    });
  }
}

function requireMovementTarget(enrollment: EnrollmentRecord, toClass: ClassRecord): void {
  if (enrollment.academicYearId !== toClass.academicYearId) {
    throw new AppError("Class must belong to the same academic year as the enrollment", {
      status: 409,
      code: "enrollment_class_mismatch",
      details: {
        academicYearId: enrollment.academicYearId,
        toClassId: toClass.id
      }
    });
  }
}

function ensureSchoolMatch(expectedSchoolId: string, actualSchoolId: string | undefined, code: string, message: string): void {
  if (actualSchoolId !== expectedSchoolId) {
    throw new AppError(message, {
      status: 404,
      code
    });
  }
}

export class EnrollmentService {
  public constructor(private readonly options: EnrollmentServiceOptions) {}

  public async createEnrollment(input: CreateEnrollmentInput): Promise<EnrollmentRecord> {
    assertEnrollmentAccess(input.actor, input.schoolId);
    const student = await this.mustFindStudent(input.schoolId, input.studentId);
    const academicYear = await this.mustFindAcademicYear(input.schoolId, input.academicYearId);
    const classRecord = await this.mustFindClass(input.schoolId, input.classId);

    if (classRecord.academicYearId !== academicYear.id) {
      throw new AppError("Class must belong to the selected academic year", {
        status: 409,
        code: "enrollment_class_mismatch"
      });
    }

    const existing = await this.options.repository.findActiveEnrollmentByStudentAcademicYear(
      input.schoolId,
      input.studentId,
      input.academicYearId
    );

    if (existing) {
      throw new AppError("Student already has an active enrollment for the academic year", {
        status: 409,
        code: "enrollment_active_conflict"
      });
    }

    if (student.status === "archived") {
      throw new AppError("Archived students cannot be enrolled", {
        status: 409,
        code: "enrollment_student_archived"
      });
    }

    const now = this.clock();
    const record: EnrollmentRecord = {
      id: this.idFactory("enrollment"),
      schoolId: input.schoolId,
      studentId: input.studentId,
      academicYearId: input.academicYearId,
      classId: input.classId,
      admissionDate: input.admissionDate ? cloneRecord(input.admissionDate) : now,
      enrollmentStatus: input.enrollmentStatus ?? "active",
      createdAt: now,
      updatedAt: now
    };

    const created = await this.options.repository.createEnrollment(record);
    await this.appendHistory({
      id: this.idFactory("enrollment_history"),
      eventName: "enrollment.created",
      schoolId: input.schoolId,
      enrollmentId: created.id,
      studentId: created.studentId,
      academicYearId: created.academicYearId,
      classId: created.classId,
      createdBy: input.actor.actorId,
      createdAt: now,
      reason: created.enrollmentStatus
    });
    await this.audit({
      eventName: "enrollment.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Enrollment",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        studentId: created.studentId,
        academicYearId: created.academicYearId,
        classId: created.classId,
        enrollmentStatus: created.enrollmentStatus
      }
    });

    return created;
  }

  public async updateEnrollment(input: UpdateEnrollmentInput): Promise<EnrollmentRecord> {
    assertEnrollmentAccess(input.actor, input.schoolId);
    const current = await this.mustFindEnrollment(input.schoolId, input.enrollmentId);

    requireEnrollmentState(current, ["active", "transferred", "withdrawn", "graduated"], current.enrollmentStatus);

    const nextStatus = input.enrollmentStatus ?? current.enrollmentStatus;

    if (input.enrollmentStatus && input.enrollmentStatus !== current.enrollmentStatus) {
      this.requireAllowedStatusTransition(current.enrollmentStatus, input.enrollmentStatus);
    }

    const updated = await this.options.repository.updateEnrollment(input.enrollmentId, input.schoolId, {
      admissionDate: input.admissionDate ? cloneRecord(input.admissionDate) : current.admissionDate,
      enrollmentStatus: nextStatus,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Enrollment not found", {
        status: 404,
        code: "enrollment_not_found"
      });
    }

    await this.appendHistory({
      id: this.idFactory("enrollment_history"),
      eventName: "enrollment.updated",
      schoolId: input.schoolId,
      enrollmentId: updated.id,
      studentId: updated.studentId,
      academicYearId: updated.academicYearId,
      classId: updated.classId,
      createdBy: input.actor.actorId,
      createdAt: this.clock(),
      reason: updated.enrollmentStatus
    });
    await this.audit({
      eventName: "enrollment.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Enrollment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        enrollmentStatus: updated.enrollmentStatus,
        admissionDate: updated.admissionDate.toISOString()
      }
    });

    return updated;
  }

  public async getEnrollment(actor: SchoolActorContext, schoolId: string, enrollmentId: string): Promise<EnrollmentRecord> {
    assertEnrollmentAccess(actor, schoolId);
    return this.mustFindEnrollment(schoolId, enrollmentId);
  }

  public async listEnrollments(input: ListEnrollmentsInput): Promise<readonly EnrollmentRecord[]> {
    assertEnrollmentAccess(input.actor, input.schoolId);
    const records = await this.options.repository.findEnrollmentsBySchoolId(input.schoolId);

    return sortEnrollments(
      records.filter((record) => {
        if (input.studentId && record.studentId !== input.studentId) {
          return false;
        }

        if (input.academicYearId && record.academicYearId !== input.academicYearId) {
          return false;
        }

        if (input.classId && record.classId !== input.classId) {
          return false;
        }

        if (input.enrollmentStatus && record.enrollmentStatus !== input.enrollmentStatus) {
          return false;
        }

        return true;
      })
    );
  }

  public async archiveEnrollment(actor: SchoolActorContext, schoolId: string, enrollmentId: string): Promise<EnrollmentRecord> {
    assertEnrollmentAccess(actor, schoolId);
    const current = await this.mustFindEnrollment(schoolId, enrollmentId);

    if (current.enrollmentStatus === "archived") {
      throw new AppError("Archived enrollments cannot transition", {
        status: 409,
        code: "enrollment_lifecycle_invalid_transition",
        details: {
          currentStatus: current.enrollmentStatus,
          requestedStatus: "archived"
        }
      });
    }

    const updated = await this.options.repository.updateEnrollment(enrollmentId, schoolId, {
      enrollmentStatus: "archived",
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Enrollment not found", {
        status: 404,
        code: "enrollment_not_found"
      });
    }

    await this.appendHistory({
      id: this.idFactory("enrollment_history"),
      eventName: "enrollment.archived",
      schoolId,
      enrollmentId: updated.id,
      studentId: updated.studentId,
      academicYearId: updated.academicYearId,
      classId: updated.classId,
      createdBy: actor.actorId,
      createdAt: this.clock(),
      reason: updated.enrollmentStatus
    });
    await this.audit({
      eventName: "enrollment.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Enrollment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        enrollmentStatus: updated.enrollmentStatus
      }
    });

    return updated;
  }

  public async promoteStudent(input: PromoteStudentInput): Promise<EnrollmentRecord> {
    return this.moveEnrollment(input, "student.promoted", "active", "promoted");
  }

  public async transferStudent(input: TransferStudentInput): Promise<EnrollmentRecord> {
    return this.moveEnrollment(input, "student.transferred", "transferred", "transferred");
  }

  public async moveStudentBetweenClasses(input: MoveStudentInput): Promise<EnrollmentRecord> {
    return this.moveEnrollment(input, "student.class_changed", "active", "class_changed");
  }

  public async listStudentEnrollmentHistory(
    actor: SchoolActorContext,
    schoolId: string,
    studentId: string
  ): Promise<readonly EnrollmentHistoryRecord[]> {
    assertEnrollmentAccess(actor, schoolId);
    await this.mustFindStudent(schoolId, studentId);
    return sortHistory(await this.options.repository.findEnrollmentHistoryByStudentId(schoolId, studentId));
  }

  public async listClassEnrollmentHistory(
    actor: SchoolActorContext,
    schoolId: string,
    classId: string
  ): Promise<readonly EnrollmentHistoryRecord[]> {
    assertEnrollmentAccess(actor, schoolId);
    await this.mustFindClass(schoolId, classId);
    return sortHistory(await this.options.repository.findEnrollmentHistoryByClassId(schoolId, classId));
  }

  private async moveEnrollment(
    input: PromoteStudentInput,
    eventName: EnrollmentHistoryEventName,
    nextStatus: EnrollmentStatus,
    reasonLabel: string
  ): Promise<EnrollmentRecord> {
    assertEnrollmentAccess(input.actor, input.schoolId);
    const current = await this.mustFindEnrollment(input.schoolId, input.enrollmentId);

    requireEnrollmentState(current, ["active"], nextStatus);
    const targetClass = await this.mustFindClass(input.schoolId, input.toClassId);
    requireMovementTarget(current, targetClass);

    if (current.classId === targetClass.id) {
      throw new AppError("Enrollment is already in the target class", {
        status: 409,
        code: "enrollment_class_conflict"
      });
    }

    const now = input.movementDate ? cloneRecord(input.movementDate) : this.clock();
    const updated = await this.options.repository.updateEnrollment(input.enrollmentId, input.schoolId, {
      classId: targetClass.id,
      enrollmentStatus: nextStatus,
      updatedAt: now
    });

    if (!updated) {
      throw new AppError("Enrollment not found", {
        status: 404,
        code: "enrollment_not_found"
      });
    }

    await this.options.repository.createEnrollmentHistory({
      id: this.idFactory("enrollment_history"),
      schoolId: input.schoolId,
      enrollmentId: updated.id,
      studentId: updated.studentId,
      academicYearId: updated.academicYearId,
      classId: updated.classId,
      eventName,
      fromClassId: current.classId,
      toClassId: targetClass.id,
      movementDate: now,
      reason: input.reason ?? reasonLabel,
      createdAt: this.clock(),
      createdBy: input.actor.actorId
    });

    await this.audit({
      eventName,
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Enrollment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        fromClassId: current.classId,
        toClassId: targetClass.id,
        reason: input.reason ?? reasonLabel,
        movementDate: now.toISOString()
      }
    });

    return updated;
  }

  private async mustFindEnrollment(schoolId: string, enrollmentId: string): Promise<EnrollmentRecord> {
    const enrollment = await this.options.repository.findEnrollmentById(enrollmentId);

    if (!enrollment || enrollment.schoolId !== schoolId) {
      throw new AppError("Enrollment not found", {
        status: 404,
        code: "enrollment_not_found"
      });
    }

    return enrollment;
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

  private async mustFindAcademicYear(schoolId: string, academicYearId: string) {
    const academicYear = await this.options.academicRepository.findAcademicYearById(academicYearId);

    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new AppError("Academic year not found", {
        status: 404,
        code: "academic_year_not_found"
      });
    }

    return academicYear;
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

  private requireAllowedStatusTransition(currentStatus: EnrollmentStatus, requestedStatus: EnrollmentStatus): void {
    const allowed = this.allowedStatusTransitions(currentStatus);

    if (!allowed.includes(requestedStatus)) {
      throw new AppError("Enrollment cannot transition from the current state", {
        status: 409,
        code: "enrollment_lifecycle_invalid_transition",
        details: {
          currentStatus,
          requestedStatus
        }
      });
    }
  }

  private allowedStatusTransitions(currentStatus: EnrollmentStatus): readonly EnrollmentStatus[] {
    switch (currentStatus) {
      case "active":
        return ["transferred", "withdrawn", "graduated", "archived"];
      case "transferred":
        return ["archived"];
      case "withdrawn":
        return ["archived"];
      case "graduated":
        return ["archived"];
      case "archived":
        return [];
      default:
        return [];
    }
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(prefix: string): string {
    return this.options.idFactory?.(prefix) ?? defaultIdFactory(prefix);
  }

  private async appendHistory(record: EnrollmentHistoryRecord): Promise<void> {
    await this.options.repository.createEnrollmentHistory(record);
  }

  private async audit(event: Parameters<NonNullable<EnrollmentServiceOptions["auditSink"]>["record"]>[0]): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
