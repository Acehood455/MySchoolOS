import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { SchoolActorContext } from "../school/school-context.js";
import type {
  StaffActorContext,
  StaffAuditSink,
  StaffLifecycleAuditEvent,
  StaffRecord,
  StaffRoleType,
  StaffStatus,
  TeacherClassAssignmentRecord,
  TeacherClassTarget,
  TeacherSubjectAssignmentRecord,
  TeacherSubjectTarget
} from "./staff-context.js";
import type { StaffRepository } from "./staff.repository.js";

export interface StaffServiceOptions {
  readonly repository: StaffRepository;
  readonly auditSink?: StaffAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
  readonly classResolver?: (classId: string, schoolId: string) => Promise<TeacherClassTarget | null> | TeacherClassTarget | null;
  readonly subjectResolver?: (
    subjectId: string,
    schoolId: string
  ) => Promise<TeacherSubjectTarget | null> | TeacherSubjectTarget | null;
}

export interface CreateStaffInput {
  readonly actor: StaffActorContext;
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
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateStaffInput extends Partial<Pick<CreateStaffInput, "employeeNumber" | "firstName" | "lastName" | "middleName" | "email" | "phone" | "gender" | "dateOfBirth" | "employmentDate" | "roleType" | "metadata">> {
  readonly actor: StaffActorContext;
  readonly schoolId: string;
  readonly staffId: string;
  readonly status?: StaffStatus;
}

export interface CreateTeacherClassAssignmentInput {
  readonly actor: StaffActorContext;
  readonly schoolId: string;
  readonly staffId: string;
  readonly classId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateTeacherSubjectAssignmentInput {
  readonly actor: StaffActorContext;
  readonly schoolId: string;
  readonly staffId: string;
  readonly subjectId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
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

function canManageStaff(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
}

function requirePermission(
  actor: StaffActorContext,
  allowed: boolean,
  eventName: string,
  resourceType: StaffLifecycleAuditEvent["resourceType"],
  resourceId: string
): void {
  if (allowed) {
    return;
  }

  throw new AppError("Permission denied", {
    status: 403,
    code: "permission_denied",
    details: {
      eventName,
      resourceType,
      resourceId,
      actorId: actor.actorId
    }
  });
}

function assertStaffAccess(actor: StaffActorContext, schoolId: string): void {
  requirePermission(actor, canManageStaff(actor, schoolId), "staff.access", "Staff", schoolId);
}

function normalizeText(value: string): string {
  return value.trim();
}

function ensureDate(value: Date | undefined, errorCode: string, label: string): void {
  if (value && Number.isNaN(value.getTime())) {
    throw new AppError(`Invalid ${label}`, {
      status: 400,
      code: errorCode
    });
  }
}

function ensureChronology(dateOfBirth?: Date, employmentDate?: Date): void {
  ensureDate(dateOfBirth, "staff_invalid_date", "date of birth");
  ensureDate(employmentDate, "staff_invalid_date", "employment date");

  if (dateOfBirth && employmentDate && dateOfBirth.getTime() > employmentDate.getTime()) {
    throw new AppError("Employment date must be on or after date of birth", {
      status: 400,
      code: "staff_invalid_date"
    });
  }
}

function sortStaff(records: readonly StaffRecord[]): StaffRecord[] {
  const priority: Record<StaffStatus, number> = {
    active: 0,
    inactive: 1,
    archived: 2
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

    return left.employeeNumber.localeCompare(right.employeeNumber);
  });
}

function requireStaffState(current: StaffRecord, allowedStatuses: readonly StaffStatus[], requestedStatus: StaffStatus): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Staff cannot transition from the current state", {
      status: 409,
      code: "staff_lifecycle_invalid_transition",
      details: {
        currentStatus: current.status,
        requestedStatus
      }
    });
  }
}

function ensureTeacherRole(staff: StaffRecord, resourceType: "TeacherClassAssignment" | "TeacherSubjectAssignment"): void {
  if (staff.roleType !== "teacher") {
    throw new AppError("Only teacher staff can receive instructional assignments", {
      status: 409,
      code: "staff_assignment_invalid_role",
      details: {
        resourceType,
        staffId: staff.id,
        roleType: staff.roleType
      }
    });
  }

  if (staff.status === "archived") {
    throw new AppError("Archived staff cannot receive assignments", {
      status: 409,
      code: "staff_assignment_invalid_state",
      details: {
        resourceType,
        staffId: staff.id
      }
    });
  }
}

async function resolveTarget<TTarget extends { readonly id: string; readonly schoolId: string }>(
  resolver: ((id: string, schoolId: string) => Promise<TTarget | null> | TTarget | null) | undefined,
  targetId: string,
  schoolId: string,
  notFoundCode: string,
  notFoundMessage: string,
  resourceType: "TeacherClassAssignment" | "TeacherSubjectAssignment"
): Promise<TTarget> {
  if (!resolver) {
    throw new AppError("Assignment resolver unavailable", {
      status: 500,
      code: "staff_assignment_unavailable",
      details: {
        resourceType
      }
    });
  }

  const target = await resolver(targetId, schoolId);

  if (!target || target.schoolId !== schoolId) {
    throw new AppError(notFoundMessage, {
      status: 404,
      code: notFoundCode
    });
  }

  return target;
}

export class StaffService {
  public constructor(private readonly options: StaffServiceOptions) {}

  public async createStaff(input: CreateStaffInput): Promise<StaffRecord> {
    assertStaffAccess(input.actor, input.schoolId);

    const employeeNumber = normalizeText(input.employeeNumber);
    const existing = await this.options.repository.findStaffByEmployeeNumber(input.schoolId, employeeNumber);

    if (existing) {
      throw new AppError("Employee number already exists", {
        status: 409,
        code: "staff_employee_conflict"
      });
    }

    ensureChronology(input.dateOfBirth, input.employmentDate);

    const now = this.clock();
    const record: StaffRecord = {
      id: this.idFactory("staff"),
      schoolId: input.schoolId,
      employeeNumber,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      middleName: input.middleName?.trim() || undefined,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      gender: input.gender?.trim() || undefined,
      dateOfBirth: input.dateOfBirth ? cloneRecord(input.dateOfBirth) : undefined,
      employmentDate: input.employmentDate ? cloneRecord(input.employmentDate) : undefined,
      roleType: input.roleType,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      activatedAt: now,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createStaff(record);

    await this.audit({
      eventName: "staff.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Staff",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        employeeNumber: created.employeeNumber,
        roleType: created.roleType,
        status: created.status
      }
    });

    return created;
  }

  public async updateStaff(input: UpdateStaffInput): Promise<StaffRecord> {
    assertStaffAccess(input.actor, input.schoolId);
    const current = await this.mustFindStaff(input.schoolId, input.staffId);

    requireStaffState(current, ["active", "inactive"], current.status);

    const employeeNumber = input.employeeNumber !== undefined ? normalizeText(input.employeeNumber) : current.employeeNumber;

    if (employeeNumber !== current.employeeNumber) {
      const conflict = await this.options.repository.findStaffByEmployeeNumber(input.schoolId, employeeNumber);

      if (conflict && conflict.id !== current.id) {
        throw new AppError("Employee number already exists", {
          status: 409,
          code: "staff_employee_conflict"
        });
      }
    }

    ensureChronology(input.dateOfBirth ?? current.dateOfBirth, input.employmentDate ?? current.employmentDate);

    const nextStatus = input.status ?? current.status;

    if (input.status && input.status !== current.status) {
      const allowed = this.allowedStatusTransitions(current.status);

      if (!allowed.includes(input.status)) {
        throw new AppError("Staff cannot transition from the current state", {
          status: 409,
          code: "staff_lifecycle_invalid_transition",
          details: {
            currentStatus: current.status,
            requestedStatus: input.status
          }
        });
      }
    }

    const updated = await this.options.repository.updateStaff(input.staffId, input.schoolId, {
      employeeNumber,
      firstName: input.firstName?.trim() ?? current.firstName,
      lastName: input.lastName?.trim() ?? current.lastName,
      middleName: input.middleName !== undefined ? input.middleName?.trim() || undefined : current.middleName,
      email: input.email !== undefined ? input.email?.trim() || undefined : current.email,
      phone: input.phone !== undefined ? input.phone?.trim() || undefined : current.phone,
      gender: input.gender !== undefined ? input.gender?.trim() || undefined : current.gender,
      dateOfBirth: input.dateOfBirth ? cloneRecord(input.dateOfBirth) : current.dateOfBirth,
      employmentDate: input.employmentDate ? cloneRecord(input.employmentDate) : current.employmentDate,
      roleType: input.roleType ?? current.roleType,
      status: nextStatus,
      activatedAt: nextStatus === "active" && current.status !== "active" ? this.clock() : current.activatedAt,
      inactivatedAt: nextStatus === "inactive" ? this.clock() : current.inactivatedAt,
      archivedAt: nextStatus === "archived" ? this.clock() : current.archivedAt,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Staff not found", {
        status: 404,
        code: "staff_not_found"
      });
    }

    await this.audit({
      eventName: "staff.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Staff",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async getStaff(actor: StaffActorContext, schoolId: string, staffId: string): Promise<StaffRecord> {
    assertStaffAccess(actor, schoolId);
    return this.mustFindStaff(schoolId, staffId);
  }

  public async listStaff(actor: StaffActorContext, schoolId: string): Promise<readonly StaffRecord[]> {
    assertStaffAccess(actor, schoolId);
    const records = await this.options.repository.findStaffBySchoolId(schoolId);
    return sortStaff(records);
  }

  public async archiveStaff(actor: StaffActorContext, schoolId: string, staffId: string): Promise<StaffRecord> {
    assertStaffAccess(actor, schoolId);
    const current = await this.mustFindStaff(schoolId, staffId);

    requireStaffState(current, ["active", "inactive"], "archived");

    const updated = await this.options.repository.updateStaff(staffId, schoolId, {
      status: "archived",
      archivedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Staff not found", {
        status: 404,
        code: "staff_not_found"
      });
    }

    await this.audit({
      eventName: "staff.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Staff",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async reactivateStaff(actor: StaffActorContext, schoolId: string, staffId: string): Promise<StaffRecord> {
    assertStaffAccess(actor, schoolId);
    const current = await this.mustFindStaff(schoolId, staffId);

    requireStaffState(current, ["inactive"], "active");

    const updated = await this.options.repository.updateStaff(staffId, schoolId, {
      status: "active",
      activatedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Staff not found", {
        status: 404,
        code: "staff_not_found"
      });
    }

    await this.audit({
      eventName: "staff.reactivated",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Staff",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async assignTeacherToClass(input: CreateTeacherClassAssignmentInput): Promise<TeacherClassAssignmentRecord> {
    assertStaffAccess(input.actor, input.schoolId);
    const staff = await this.mustFindStaff(input.schoolId, input.staffId);
    ensureTeacherRole(staff, "TeacherClassAssignment");

    await resolveTarget(
      this.options.classResolver,
      input.classId,
      input.schoolId,
      "teacher_class_assignment_class_not_found",
      "Class not found",
      "TeacherClassAssignment"
    );

    const duplicate = await this.options.repository.findActiveTeacherClassAssignment(input.schoolId, input.staffId, input.classId);

    if (duplicate) {
      throw new AppError("Teacher already assigned to this class", {
        status: 409,
        code: "teacher_class_assignment_conflict"
      });
    }

    const now = this.clock();
    const record: TeacherClassAssignmentRecord = {
      id: this.idFactory("teacher_class_assignment"),
      schoolId: input.schoolId,
      staffId: input.staffId,
      classId: input.classId,
      status: "active",
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createTeacherClassAssignment(record);

    await this.audit({
      eventName: "teacher.class.assigned",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "TeacherClassAssignment",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        staffId: created.staffId,
        classId: created.classId
      }
    });

    return created;
  }

  public async removeTeacherClassAssignment(
    actor: StaffActorContext,
    schoolId: string,
    staffId: string,
    assignmentId: string
  ): Promise<TeacherClassAssignmentRecord> {
    assertStaffAccess(actor, schoolId);
    await this.mustFindStaff(schoolId, staffId);
    const current = await this.mustFindTeacherClassAssignment(schoolId, staffId, assignmentId);

    requireTeacherAssignmentState(current, ["active"], "removed", "teacher.class.unassigned");

    const updated = await this.options.repository.updateTeacherClassAssignment(assignmentId, schoolId, {
      status: "removed",
      removedAt: this.clock(),
      removedBy: actor.actorId,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Teacher class assignment not found", {
        status: 404,
        code: "teacher_class_assignment_not_found"
      });
    }

    await this.audit({
      eventName: "teacher.class.unassigned",
      actorId: actor.actorId,
      schoolId,
      resourceType: "TeacherClassAssignment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        staffId: updated.staffId,
        classId: updated.classId
      }
    });

    return updated;
  }

  public async listTeacherClassAssignments(
    actor: StaffActorContext,
    schoolId: string,
    staffId: string
  ): Promise<readonly TeacherClassAssignmentRecord[]> {
    assertStaffAccess(actor, schoolId);
    await this.mustFindStaff(schoolId, staffId);
    return this.options.repository.findTeacherClassAssignmentsByStaffId(schoolId, staffId);
  }

  public async assignTeacherToSubject(input: CreateTeacherSubjectAssignmentInput): Promise<TeacherSubjectAssignmentRecord> {
    assertStaffAccess(input.actor, input.schoolId);
    const staff = await this.mustFindStaff(input.schoolId, input.staffId);
    ensureTeacherRole(staff, "TeacherSubjectAssignment");

    await resolveTarget(
      this.options.subjectResolver,
      input.subjectId,
      input.schoolId,
      "teacher_subject_assignment_subject_not_found",
      "Subject not found",
      "TeacherSubjectAssignment"
    );

    const duplicate = await this.options.repository.findActiveTeacherSubjectAssignment(input.schoolId, input.staffId, input.subjectId);

    if (duplicate) {
      throw new AppError("Teacher already assigned to this subject", {
        status: 409,
        code: "teacher_subject_assignment_conflict"
      });
    }

    const now = this.clock();
    const record: TeacherSubjectAssignmentRecord = {
      id: this.idFactory("teacher_subject_assignment"),
      schoolId: input.schoolId,
      staffId: input.staffId,
      subjectId: input.subjectId,
      status: "active",
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createTeacherSubjectAssignment(record);

    await this.audit({
      eventName: "teacher.subject.assigned",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "TeacherSubjectAssignment",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        staffId: created.staffId,
        subjectId: created.subjectId
      }
    });

    return created;
  }

  public async removeTeacherSubjectAssignment(
    actor: StaffActorContext,
    schoolId: string,
    staffId: string,
    assignmentId: string
  ): Promise<TeacherSubjectAssignmentRecord> {
    assertStaffAccess(actor, schoolId);
    await this.mustFindStaff(schoolId, staffId);
    const current = await this.mustFindTeacherSubjectAssignment(schoolId, staffId, assignmentId);

    requireTeacherAssignmentState(current, ["active"], "removed", "teacher.subject.unassigned");

    const updated = await this.options.repository.updateTeacherSubjectAssignment(assignmentId, schoolId, {
      status: "removed",
      removedAt: this.clock(),
      removedBy: actor.actorId,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Teacher subject assignment not found", {
        status: 404,
        code: "teacher_subject_assignment_not_found"
      });
    }

    await this.audit({
      eventName: "teacher.subject.unassigned",
      actorId: actor.actorId,
      schoolId,
      resourceType: "TeacherSubjectAssignment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        staffId: updated.staffId,
        subjectId: updated.subjectId
      }
    });

    return updated;
  }

  public async listTeacherSubjectAssignments(
    actor: StaffActorContext,
    schoolId: string,
    staffId: string
  ): Promise<readonly TeacherSubjectAssignmentRecord[]> {
    assertStaffAccess(actor, schoolId);
    await this.mustFindStaff(schoolId, staffId);
    return this.options.repository.findTeacherSubjectAssignmentsByStaffId(schoolId, staffId);
  }

  private async mustFindStaff(schoolId: string, staffId: string): Promise<StaffRecord> {
    const staff = await this.options.repository.findStaffById(staffId);

    if (!staff || staff.schoolId !== schoolId) {
      throw new AppError("Staff not found", {
        status: 404,
        code: "staff_not_found"
      });
    }

    return staff;
  }

  private async mustFindTeacherClassAssignment(
    schoolId: string,
    staffId: string,
    assignmentId: string
  ): Promise<TeacherClassAssignmentRecord> {
    const assignment = await this.options.repository.findTeacherClassAssignmentById(assignmentId);

    if (!assignment || assignment.schoolId !== schoolId || assignment.staffId !== staffId) {
      throw new AppError("Teacher class assignment not found", {
        status: 404,
        code: "teacher_class_assignment_not_found"
      });
    }

    return assignment;
  }

  private async mustFindTeacherSubjectAssignment(
    schoolId: string,
    staffId: string,
    assignmentId: string
  ): Promise<TeacherSubjectAssignmentRecord> {
    const assignment = await this.options.repository.findTeacherSubjectAssignmentById(assignmentId);

    if (!assignment || assignment.schoolId !== schoolId || assignment.staffId !== staffId) {
      throw new AppError("Teacher subject assignment not found", {
        status: 404,
        code: "teacher_subject_assignment_not_found"
      });
    }

    return assignment;
  }

  private allowedStatusTransitions(currentStatus: StaffStatus): readonly StaffStatus[] {
    switch (currentStatus) {
      case "active":
        return ["inactive"];
      case "inactive":
        return [];
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

  private async audit(event: StaffLifecycleAuditEvent): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}

function requireTeacherAssignmentState(
  current: TeacherClassAssignmentRecord | TeacherSubjectAssignmentRecord,
  allowedStatuses: readonly TeacherClassAssignmentRecord["status"][],
  requestedStatus: TeacherClassAssignmentRecord["status"],
  eventName: StaffLifecycleAuditEvent["eventName"]
): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Assignment cannot transition from the current state", {
      status: 409,
      code: "teacher_assignment_lifecycle_invalid_transition",
      details: {
        currentStatus: current.status,
        eventName,
        requestedStatus
      }
    });
  }
}
