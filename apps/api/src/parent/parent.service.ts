import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { SchoolActorContext } from "../school/school-context.js";
import type { StudentRepository } from "../student/student.repository.js";
import type {
  ParentAuditSink,
  ParentLifecycleAuditEvent,
  ParentRecord,
  ParentRelationshipType,
  ParentStatus,
  ParentStudentLinkRecord
} from "./parent-context.js";
import type { ParentRepository } from "./parent.repository.js";

export interface ParentServiceOptions {
  readonly repository: ParentRepository;
  readonly studentRepository: StudentRepository;
  readonly auditSink?: ParentAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
}

export interface CreateParentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: string;
  readonly occupation?: string;
  readonly relationshipType: ParentRelationshipType;
}

export interface UpdateParentInput extends Partial<Pick<CreateParentInput, "firstName" | "lastName" | "middleName" | "email" | "phone" | "address" | "occupation" | "relationshipType">> {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly parentId: string;
  readonly status?: ParentStatus;
}

export interface ListParentsInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly status?: ParentStatus;
}

export interface LinkParentToStudentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly parentId: string;
  readonly studentId: string;
}

export interface UnlinkParentFromStudentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly parentId: string;
  readonly studentId: string;
}

function defaultClock(): Date {
  return new Date();
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function hasRole(actor: SchoolActorContext, role: CanonicalRole): boolean {
  return actor.roles.includes(role);
}

function canManageParents(actor: SchoolActorContext, schoolId: string): boolean {
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
      resourceType: "Parent",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function assertParentAccess(actor: SchoolActorContext, schoolId: string): void {
  requirePermission(actor, canManageParents(actor, schoolId), "parent.access", schoolId);
}

function normalizeOptionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeEmail(value?: string): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function sortParents(records: readonly ParentRecord[]): ParentRecord[] {
  const priority: Record<ParentStatus, number> = {
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

    return (left.email ?? "").localeCompare(right.email ?? "");
  });
}

function sortLinks(records: readonly ParentStudentLinkRecord[]): ParentStudentLinkRecord[] {
  const priority: Record<ParentStudentLinkRecord["status"], number> = {
    active: 0,
    archived: 1
  };

  return [...records].sort((left, right) => {
    if (priority[left.status] !== priority[right.status]) {
      return priority[left.status] - priority[right.status];
    }

    return left.linkedAt.getTime() - right.linkedAt.getTime();
  });
}

function requireParentState(current: ParentRecord, allowedStatuses: readonly ParentStatus[], requestedStatus: ParentStatus): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Parent cannot transition from the current state", {
      status: 409,
      code: "parent_lifecycle_invalid_transition",
      details: {
        currentStatus: current.status,
        requestedStatus
      }
    });
  }
}

function requireLinkState(current: ParentStudentLinkRecord, allowedStatuses: readonly ParentStudentLinkRecord["status"][]): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Parent student link cannot transition from the current state", {
      status: 409,
      code: "parent_student_link_invalid_transition",
      details: {
        currentStatus: current.status
      }
    });
  }
}

export class ParentService {
  public constructor(private readonly options: ParentServiceOptions) {}

  public async createParent(input: CreateParentInput): Promise<ParentRecord> {
    assertParentAccess(input.actor, input.schoolId);

    const email = normalizeEmail(input.email);

    if (email) {
      const existing = await this.options.repository.findParentByEmail(input.schoolId, email);

      if (existing) {
        throw new AppError("Email already exists", {
          status: 409,
          code: "parent_email_conflict"
        });
      }
    }

    const now = this.clock();
    const record: ParentRecord = {
      id: this.idFactory("parent"),
      schoolId: input.schoolId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      middleName: normalizeOptionalText(input.middleName),
      email,
      phone: normalizeOptionalText(input.phone),
      address: normalizeOptionalText(input.address),
      occupation: normalizeOptionalText(input.occupation),
      relationshipType: input.relationshipType,
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    const created = await this.options.repository.createParent(record);

    await this.audit({
      eventName: "parent.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Parent",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        email: created.email,
        relationshipType: created.relationshipType,
        status: created.status
      }
    });

    return created;
  }

  public async updateParent(input: UpdateParentInput): Promise<ParentRecord> {
    assertParentAccess(input.actor, input.schoolId);
    const current = await this.mustFindParent(input.schoolId, input.parentId);

    if (current.status === "archived") {
      throw new AppError("Archived parents cannot be updated", {
        status: 409,
        code: "parent_archived"
      });
    }

    const email = input.email !== undefined ? normalizeEmail(input.email) : current.email;

    if (email !== current.email && email) {
      const conflict = await this.options.repository.findParentByEmail(input.schoolId, email);

      if (conflict && conflict.id !== current.id) {
        throw new AppError("Email already exists", {
          status: 409,
          code: "parent_email_conflict"
        });
      }
    }

    const nextStatus = input.status ?? current.status;

    if (input.status && input.status !== current.status) {
      this.requireAllowedTransition(current.status, input.status);
    }

    const updated = await this.options.repository.updateParent(input.parentId, input.schoolId, {
      firstName: input.firstName?.trim() ?? current.firstName,
      lastName: input.lastName?.trim() ?? current.lastName,
      middleName: input.middleName !== undefined ? normalizeOptionalText(input.middleName) : current.middleName,
      email,
      phone: input.phone !== undefined ? normalizeOptionalText(input.phone) : current.phone,
      address: input.address !== undefined ? normalizeOptionalText(input.address) : current.address,
      occupation: input.occupation !== undefined ? normalizeOptionalText(input.occupation) : current.occupation,
      relationshipType: input.relationshipType ?? current.relationshipType,
      status: nextStatus,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Parent not found", {
        status: 404,
        code: "parent_not_found"
      });
    }

    await this.audit({
      eventName: "parent.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Parent",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async getParent(actor: SchoolActorContext, schoolId: string, parentId: string): Promise<ParentRecord> {
    assertParentAccess(actor, schoolId);
    return this.mustFindParent(schoolId, parentId);
  }

  public async listParents(input: ListParentsInput): Promise<readonly ParentRecord[]> {
    assertParentAccess(input.actor, input.schoolId);
    const records = await this.options.repository.findParentsBySchoolId(input.schoolId);

    return sortParents(
      records.filter((record) => {
        if (input.status && record.status !== input.status) {
          return false;
        }

        return true;
      })
    );
  }

  public async archiveParent(actor: SchoolActorContext, schoolId: string, parentId: string): Promise<ParentRecord> {
    assertParentAccess(actor, schoolId);
    const current = await this.mustFindParent(schoolId, parentId);

    if (current.status === "archived") {
      throw new AppError("Archived parents cannot transition", {
        status: 409,
        code: "parent_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "archived"
        }
      });
    }

    const updated = await this.options.repository.updateParent(parentId, schoolId, {
      status: "archived",
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Parent not found", {
        status: 404,
        code: "parent_not_found"
      });
    }

    await this.audit({
      eventName: "parent.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Parent",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async reactivateParent(actor: SchoolActorContext, schoolId: string, parentId: string): Promise<ParentRecord> {
    assertParentAccess(actor, schoolId);
    const current = await this.mustFindParent(schoolId, parentId);

    requireParentState(current, ["inactive"], "active");

    const updated = await this.options.repository.updateParent(parentId, schoolId, {
      status: "active",
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Parent not found", {
        status: 404,
        code: "parent_not_found"
      });
    }

    await this.audit({
      eventName: "parent.reactivated",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Parent",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async linkParentToStudent(input: LinkParentToStudentInput): Promise<ParentStudentLinkRecord> {
    assertParentAccess(input.actor, input.schoolId);
    const parent = await this.mustFindParent(input.schoolId, input.parentId);
    const student = await this.mustFindStudent(input.schoolId, input.studentId);

    if (parent.status === "archived") {
      throw new AppError("Archived parents cannot be linked", {
        status: 409,
        code: "parent_link_invalid_state",
        details: {
          parentStatus: parent.status
        }
      });
    }

    if (student.status === "archived") {
      throw new AppError("Archived students cannot be linked", {
        status: 409,
        code: "parent_link_invalid_state",
        details: {
          studentStatus: student.status
        }
      });
    }

    const duplicate = await this.options.repository.findActiveParentStudentLink(input.schoolId, input.parentId, input.studentId);

    if (duplicate) {
      throw new AppError("Parent is already linked to this student", {
        status: 409,
        code: "parent_student_link_conflict"
      });
    }

    const now = this.clock();
    const record: ParentStudentLinkRecord = {
      id: this.idFactory("parent_student_link"),
      schoolId: input.schoolId,
      parentId: input.parentId,
      studentId: input.studentId,
      status: "active",
      linkedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId
    };

    const created = await this.options.repository.createParentStudentLink(record);

    await this.audit({
      eventName: "parent.student.linked",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "ParentStudentLink",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        parentId: created.parentId,
        studentId: created.studentId
      }
    });

    return created;
  }

  public async unlinkParentFromStudent(input: UnlinkParentFromStudentInput): Promise<ParentStudentLinkRecord> {
    assertParentAccess(input.actor, input.schoolId);
    await this.mustFindParent(input.schoolId, input.parentId);
    await this.mustFindStudent(input.schoolId, input.studentId);
    const current = await this.mustFindActiveLink(input.schoolId, input.parentId, input.studentId);

    requireLinkState(current, ["active"]);

    const updated = await this.options.repository.updateParentStudentLink(current.id, input.schoolId, {
      status: "archived",
      unlinkedAt: this.clock(),
      unlinkedBy: input.actor.actorId,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Parent student link not found", {
        status: 404,
        code: "parent_student_link_not_found"
      });
    }

    await this.audit({
      eventName: "parent.student.unlinked",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "ParentStudentLink",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        parentId: updated.parentId,
        studentId: updated.studentId
      }
    });

    return updated;
  }

  public async listLinksForParent(actor: SchoolActorContext, schoolId: string, parentId: string): Promise<readonly ParentStudentLinkRecord[]> {
    assertParentAccess(actor, schoolId);
    await this.mustFindParent(schoolId, parentId);
    return sortLinks(await this.options.repository.findParentStudentLinksByParentId(schoolId, parentId));
  }

  public async listLinksForStudent(actor: SchoolActorContext, schoolId: string, studentId: string): Promise<readonly ParentStudentLinkRecord[]> {
    assertParentAccess(actor, schoolId);
    await this.mustFindStudent(schoolId, studentId);
    return sortLinks(await this.options.repository.findParentStudentLinksByStudentId(schoolId, studentId));
  }

  private async mustFindParent(schoolId: string, parentId: string): Promise<ParentRecord> {
    const parent = await this.options.repository.findParentById(parentId);

    if (!parent || parent.schoolId !== schoolId) {
      throw new AppError("Parent not found", {
        status: 404,
        code: "parent_not_found"
      });
    }

    return parent;
  }

  private async mustFindStudent(
    schoolId: string,
    studentId: string
  ): Promise<{ readonly id: string; readonly schoolId: string; readonly status: string }> {
    const student = await this.options.studentRepository.findStudentById(studentId);

    if (!student || student.schoolId !== schoolId) {
      throw new AppError("Student not found", {
        status: 404,
        code: "student_not_found"
      });
    }

    return student;
  }

  private async mustFindActiveLink(schoolId: string, parentId: string, studentId: string): Promise<ParentStudentLinkRecord> {
    const link = await this.options.repository.findActiveParentStudentLink(schoolId, parentId, studentId);

    if (!link) {
      throw new AppError("Parent student link not found", {
        status: 404,
        code: "parent_student_link_not_found"
      });
    }

    return link;
  }

  private requireAllowedTransition(currentStatus: ParentStatus, requestedStatus: ParentStatus): void {
    const allowed = this.allowedStatusTransitions(currentStatus);

    if (!allowed.includes(requestedStatus)) {
      throw new AppError("Parent cannot transition from the current state", {
        status: 409,
        code: "parent_lifecycle_invalid_transition",
        details: {
          currentStatus,
          requestedStatus
        }
      });
    }
  }

  private allowedStatusTransitions(currentStatus: ParentStatus): readonly ParentStatus[] {
    switch (currentStatus) {
      case "active":
        return ["inactive", "archived"];
      case "inactive":
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

  private async audit(event: ParentLifecycleAuditEvent): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}

