import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { SchoolActorContext } from "../school/school-context.js";
import type {
  StudentAuditSink,
  StudentLifecycleAuditEvent,
  StudentRecord,
  StudentStatus
} from "./student-context.js";
import type { StudentRepository } from "./student.repository.js";

export interface StudentServiceOptions {
  readonly repository: StudentRepository;
  readonly auditSink?: StudentAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}

export interface CreateStudentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly admissionNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName?: string;
  readonly gender?: StudentRecord["gender"];
  readonly dateOfBirth?: Date;
  readonly admissionDate?: Date;
  readonly contactInformation?: Readonly<Record<string, unknown>>;
  readonly address?: Readonly<Record<string, unknown>>;
  readonly profilePhotoReference?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateStudentInput extends Partial<Pick<CreateStudentInput,
  | "admissionNumber"
  | "firstName"
  | "lastName"
  | "middleName"
  | "gender"
  | "dateOfBirth"
  | "admissionDate"
  | "contactInformation"
  | "address"
  | "profilePhotoReference"
  | "metadata"
>> {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly studentId: string;
  readonly status?: StudentStatus;
}

export interface ListStudentsInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly search?: string;
  readonly admissionNumber?: string;
  readonly status?: StudentStatus;
}

function defaultClock(): Date {
  return new Date();
}

function defaultIdFactory(): string {
  return `student_${randomUUID().replace(/-/g, "")}`;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

function hasRole(actor: SchoolActorContext, role: CanonicalRole): boolean {
  return actor.roles.includes(role);
}

function canManageStudents(actor: SchoolActorContext, schoolId: string): boolean {
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
      resourceType: "Student",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function assertStudentAccess(actor: SchoolActorContext, schoolId: string): void {
  requirePermission(actor, canManageStudents(actor, schoolId), "student.access", schoolId);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function ensureChronology(dateOfBirth?: Date, admissionDate?: Date): void {
  if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) {
    throw new AppError("Invalid date of birth", {
      status: 400,
      code: "student_invalid_date"
    });
  }

  if (admissionDate && Number.isNaN(admissionDate.getTime())) {
    throw new AppError("Invalid admission date", {
      status: 400,
      code: "student_invalid_date"
    });
  }

  if (dateOfBirth && admissionDate && dateOfBirth.getTime() > admissionDate.getTime()) {
    throw new AppError("Admission date must be on or after date of birth", {
      status: 400,
      code: "student_invalid_date"
    });
  }
}

function matchesSearch(student: StudentRecord, search: string): boolean {
  const needle = normalizeText(search);
  const haystack = [
    student.admissionNumber,
    student.firstName,
    student.lastName,
    student.middleName ?? ""
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

function sortStudents(records: readonly StudentRecord[]): StudentRecord[] {
  const priority: Record<StudentStatus, number> = {
    active: 0,
    inactive: 1,
    graduated: 2,
    withdrawn: 3,
    archived: 4
  };

  return [...records].sort((left, right) => {
    if (priority[left.status] !== priority[right.status]) {
      return priority[left.status] - priority[right.status];
    }

    if (left.lastName !== right.lastName) {
      return left.lastName.localeCompare(right.lastName);
    }

    if (left.firstName !== right.firstName) {
      return left.firstName.localeCompare(right.firstName);
    }

    return left.admissionNumber.localeCompare(right.admissionNumber);
  });
}

function requireStudentState(
  current: StudentRecord,
  allowedStatuses: readonly StudentStatus[],
  requestedStatus: StudentStatus
): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Student cannot transition from the current state", {
      status: 409,
      code: "student_lifecycle_invalid_transition",
      details: {
        currentStatus: current.status,
        requestedStatus
      }
    });
  }
}

export class StudentService {
  public constructor(private readonly options: StudentServiceOptions) {}

  public async createStudent(input: CreateStudentInput): Promise<StudentRecord> {
    assertStudentAccess(input.actor, input.schoolId);

    const admissionNumber = input.admissionNumber.trim();
    const existing = await this.options.repository.findStudentByAdmissionNumber(input.schoolId, admissionNumber);

    if (existing) {
      throw new AppError("Admission number already exists", {
        status: 409,
        code: "student_admission_conflict"
      });
    }

    ensureChronology(input.dateOfBirth, input.admissionDate);

    const now = this.clock();
    const record: StudentRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      admissionNumber,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      middleName: input.middleName?.trim() || undefined,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth ? cloneRecord(input.dateOfBirth) : undefined,
      admissionDate: input.admissionDate ? cloneRecord(input.admissionDate) : undefined,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      activatedAt: now,
      contactInformation: input.contactInformation ? cloneRecord(input.contactInformation) : undefined,
      address: input.address ? cloneRecord(input.address) : undefined,
      profilePhotoReference: input.profilePhotoReference?.trim() || undefined,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createStudent(record);

    await this.audit({
      eventName: "student.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Student",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        admissionNumber: created.admissionNumber,
        status: created.status
      }
    });

    return created;
  }

  public async updateStudent(input: UpdateStudentInput): Promise<StudentRecord> {
    assertStudentAccess(input.actor, input.schoolId);
    const current = await this.mustFindStudent(input.schoolId, input.studentId);

    requireStudentState(current, ["active", "inactive", "graduated", "withdrawn"], current.status);

    const admissionNumber = input.admissionNumber?.trim() ?? current.admissionNumber;

    if (admissionNumber !== current.admissionNumber) {
      const conflict = await this.options.repository.findStudentByAdmissionNumber(input.schoolId, admissionNumber);

      if (conflict && conflict.id !== current.id) {
        throw new AppError("Admission number already exists", {
          status: 409,
          code: "student_admission_conflict"
        });
      }
    }

    ensureChronology(input.dateOfBirth ?? current.dateOfBirth, input.admissionDate ?? current.admissionDate);

    const nextStatus = input.status ?? current.status;

    if (input.status && input.status !== current.status && !this.allowedStatusTransitions(current.status).includes(input.status)) {
      throw new AppError("Student cannot transition from the current state", {
        status: 409,
        code: "student_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: input.status
        }
      });
    }

    const updated = await this.options.repository.updateStudent(input.studentId, input.schoolId, {
      admissionNumber,
      firstName: input.firstName?.trim() ?? current.firstName,
      lastName: input.lastName?.trim() ?? current.lastName,
      middleName: input.middleName !== undefined ? input.middleName?.trim() || undefined : current.middleName,
      gender: input.gender ?? current.gender,
      dateOfBirth: input.dateOfBirth ? cloneRecord(input.dateOfBirth) : current.dateOfBirth,
      admissionDate: input.admissionDate ? cloneRecord(input.admissionDate) : current.admissionDate,
      contactInformation: input.contactInformation ? cloneRecord(input.contactInformation) : current.contactInformation,
      address: input.address ? cloneRecord(input.address) : current.address,
      profilePhotoReference: input.profilePhotoReference !== undefined ? input.profilePhotoReference?.trim() || undefined : current.profilePhotoReference,
      status: nextStatus,
      activatedAt: nextStatus === "active" && current.status !== "active" ? this.clock() : current.activatedAt,
      inactivatedAt: nextStatus === "inactive" ? this.clock() : current.inactivatedAt,
      graduatedAt: nextStatus === "graduated" ? this.clock() : current.graduatedAt,
      withdrawnAt: nextStatus === "withdrawn" ? this.clock() : current.withdrawnAt,
      archivedAt: nextStatus === "archived" ? this.clock() : current.archivedAt,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    await this.audit({
      eventName: "student.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Student",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async retrieveStudent(actor: SchoolActorContext, schoolId: string, studentId: string): Promise<StudentRecord> {
    assertStudentAccess(actor, schoolId);
    return this.mustFindStudent(schoolId, studentId);
  }

  public async listStudents(input: ListStudentsInput): Promise<readonly StudentRecord[]> {
    assertStudentAccess(input.actor, input.schoolId);
    const students = await this.options.repository.findStudentsBySchoolId(input.schoolId);
    const filtered = students.filter((student) => {
      if (input.status && student.status !== input.status) {
        return false;
      }

      if (input.admissionNumber && student.admissionNumber !== input.admissionNumber.trim()) {
        return false;
      }

      if (input.search && !matchesSearch(student, input.search)) {
        return false;
      }

      return true;
    });

    return sortStudents(filtered);
  }

  public async archiveStudent(actor: SchoolActorContext, schoolId: string, studentId: string): Promise<StudentRecord> {
    assertStudentAccess(actor, schoolId);
    const current = await this.mustFindStudent(schoolId, studentId);

    requireStudentState(current, ["active", "inactive", "graduated", "withdrawn"], "archived");

    const updated = await this.options.repository.updateStudent(studentId, schoolId, {
      status: "archived",
      archivedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    await this.audit({
      eventName: "student.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Student",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async reactivateStudent(actor: SchoolActorContext, schoolId: string, studentId: string): Promise<StudentRecord> {
    assertStudentAccess(actor, schoolId);
    const current = await this.mustFindStudent(schoolId, studentId);

    requireStudentState(current, ["inactive"], "active");

    const updated = await this.options.repository.updateStudent(studentId, schoolId, {
      status: "active",
      activatedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    await this.audit({
      eventName: "student.reactivated",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Student",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async graduateStudent(actor: SchoolActorContext, schoolId: string, studentId: string): Promise<StudentRecord> {
    assertStudentAccess(actor, schoolId);
    const current = await this.mustFindStudent(schoolId, studentId);

    requireStudentState(current, ["active", "inactive"], "graduated");

    const updated = await this.options.repository.updateStudent(studentId, schoolId, {
      status: "graduated",
      graduatedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    await this.audit({
      eventName: "student.graduated",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Student",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async withdrawStudent(actor: SchoolActorContext, schoolId: string, studentId: string): Promise<StudentRecord> {
    assertStudentAccess(actor, schoolId);
    const current = await this.mustFindStudent(schoolId, studentId);

    requireStudentState(current, ["active", "inactive"], "withdrawn");

    const updated = await this.options.repository.updateStudent(studentId, schoolId, {
      status: "withdrawn",
      withdrawnAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    await this.audit({
      eventName: "student.withdrawn",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Student",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  private async mustFindStudent(schoolId: string, studentId: string): Promise<StudentRecord> {
    const student = await this.options.repository.findStudentById(studentId);

    if (!student || student.schoolId !== schoolId) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    return student;
  }

  private allowedStatusTransitions(currentStatus: StudentStatus): readonly StudentStatus[] {
    switch (currentStatus) {
      case "active":
        return ["inactive", "graduated", "withdrawn", "archived"];
      case "inactive":
        return ["active", "graduated", "withdrawn", "archived"];
      case "graduated":
        return ["archived"];
      case "withdrawn":
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

  private idFactory(): string {
    return this.options.idFactory?.() ?? defaultIdFactory();
  }

  private async audit(event: StudentLifecycleAuditEvent): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
