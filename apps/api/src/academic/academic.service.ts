import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type {
  AcademicAuditSink,
  AcademicLifecycleAuditEvent,
  AcademicYearRecord,
  ClassRecord,
  SubjectRecord,
  TermRecord
} from "./academic-context.js";
import type { AcademicRepository } from "./academic.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";

export interface AcademicServiceOptions {
  readonly repository: AcademicRepository;
  readonly auditSink?: AcademicAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}

export interface AcademicYearInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly name: string;
  readonly code?: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateAcademicYearInput extends Partial<Pick<AcademicYearInput, "name" | "code" | "startDate" | "endDate" | "metadata">> {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly academicYearId: string;
}

export interface TermInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly code?: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateTermInput extends Partial<Pick<TermInput, "name" | "code" | "startDate" | "endDate" | "metadata">> {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly termId: string;
}

export interface ClassInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly code?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateClassInput extends Partial<Pick<ClassInput, "name" | "code" | "metadata">> {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly classId: string;
}

export interface SubjectInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly name: string;
  readonly code?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateSubjectInput extends Partial<Pick<SubjectInput, "name" | "code" | "metadata">> {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly subjectId: string;
}

function defaultClock(): Date {
  return new Date();
}

function defaultIdFactory(): string {
  return `academic_${randomUUID().replace(/-/g, "")}`;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

function hasRole(actor: SchoolActorContext, role: CanonicalRole): boolean {
  return actor.roles.includes(role);
}

function canManageAcademic(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
}

function requirePermission(
  actor: SchoolActorContext,
  allowed: boolean,
  eventName: string,
  resourceType: AcademicLifecycleAuditEvent["resourceType"],
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

function assertAcademicAccess(actor: SchoolActorContext, schoolId: string): void {
  requirePermission(actor, canManageAcademic(actor, schoolId), "academic.access", "AcademicYear", schoolId);
}

function ensureChronology(startDate: Date, endDate: Date, errorCode: string, resourceType: AcademicLifecycleAuditEvent["resourceType"]): void {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime()) || !(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
    throw new AppError("Invalid dates", {
      status: 400,
      code: errorCode,
      details: {
        resourceType
      }
    });
  }

  if (startDate.getTime() > endDate.getTime()) {
    throw new AppError("Invalid dates", {
      status: 400,
      code: errorCode,
      details: {
        resourceType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
  }
}

function ensureTermWithinYear(termStartDate: Date, termEndDate: Date, year: AcademicYearRecord): void {
  if (termStartDate.getTime() < year.startDate.getTime() || termEndDate.getTime() > year.endDate.getTime()) {
    throw new AppError("Term dates must stay within the academic year", {
      status: 400,
      code: "term_date_out_of_range",
      details: {
        academicYearId: year.id
      }
    });
  }
}

function sortAcademicYears(records: readonly AcademicYearRecord[]): AcademicYearRecord[] {
  const priority: Record<AcademicYearRecord["status"], number> = {
    open: 0,
    planned: 1,
    closed: 2,
    archived: 3
  };

  return [...records].sort((left, right) => {
    if (priority[left.status] !== priority[right.status]) {
      return priority[left.status] - priority[right.status];
    }

    if (left.startDate.getTime() !== right.startDate.getTime()) {
      return right.startDate.getTime() - left.startDate.getTime();
    }

    return left.name.localeCompare(right.name);
  });
}

function sortTerms(records: readonly TermRecord[]): TermRecord[] {
  const priority: Record<TermRecord["status"], number> = {
    open: 0,
    planned: 1,
    closed: 2,
    archived: 3
  };

  return [...records].sort((left, right) => {
    if (priority[left.status] !== priority[right.status]) {
      return priority[left.status] - priority[right.status];
    }

    if (left.startDate.getTime() !== right.startDate.getTime()) {
      return left.startDate.getTime() - right.startDate.getTime();
    }

    return left.name.localeCompare(right.name);
  });
}

function sortClasses(records: readonly ClassRecord[]): ClassRecord[] {
  const priority: Record<ClassRecord["status"], number> = {
    draft: 0,
    active: 1,
    suspended: 2,
    archived: 3
  };

  return [...records].sort((left, right) => {
    if (priority[left.status] !== priority[right.status]) {
      return priority[left.status] - priority[right.status];
    }

    const leftCode = left.code ?? left.name;
    const rightCode = right.code ?? right.name;

    return leftCode.localeCompare(rightCode);
  });
}

function sortSubjects(records: readonly SubjectRecord[]): SubjectRecord[] {
  const priority: Record<SubjectRecord["status"], number> = {
    draft: 0,
    active: 1,
    inactive: 2,
    archived: 3
  };

  return [...records].sort((left, right) => {
    if (priority[left.status] !== priority[right.status]) {
      return priority[left.status] - priority[right.status];
    }

    const leftCode = left.code ?? left.name;
    const rightCode = right.code ?? right.name;

    return leftCode.localeCompare(rightCode);
  });
}

function requireAcademicState(
  current: AcademicYearRecord,
  allowedStatuses: readonly AcademicYearRecord["status"][],
  eventName: AcademicLifecycleAuditEvent["eventName"],
  requestedStatus: AcademicYearRecord["status"]
): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Academic year cannot transition from the current state", {
      status: 409,
      code: "academic_year_lifecycle_invalid_transition",
      details: {
        currentStatus: current.status,
        eventName,
        requestedStatus
      }
    });
  }
}

function requireTermState(
  current: TermRecord,
  allowedStatuses: readonly TermRecord["status"][],
  eventName: AcademicLifecycleAuditEvent["eventName"],
  requestedStatus: TermRecord["status"]
): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Term cannot transition from the current state", {
      status: 409,
      code: "term_lifecycle_invalid_transition",
      details: {
        currentStatus: current.status,
        eventName,
        requestedStatus
      }
    });
  }
}

function requireClassState(
  current: ClassRecord,
  allowedStatuses: readonly ClassRecord["status"][],
  requestedStatus: ClassRecord["status"]
): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Class cannot transition from the current state", {
      status: 409,
      code: "class_lifecycle_invalid_transition",
      details: {
        currentStatus: current.status,
        requestedStatus
      }
    });
  }
}

function requireSubjectState(
  current: SubjectRecord,
  allowedStatuses: readonly SubjectRecord["status"][],
  requestedStatus: SubjectRecord["status"]
): void {
  if (!allowedStatuses.includes(current.status)) {
    throw new AppError("Subject cannot transition from the current state", {
      status: 409,
      code: "subject_lifecycle_invalid_transition",
      details: {
        currentStatus: current.status,
        requestedStatus
      }
    });
  }
}

export class AcademicService {
  public constructor(private readonly options: AcademicServiceOptions) {}

  public async createAcademicYear(input: AcademicYearInput): Promise<AcademicYearRecord> {
    assertAcademicAccess(input.actor, input.schoolId);
    ensureChronology(input.startDate, input.endDate, "academic_year_invalid_dates", "AcademicYear");

    const now = this.clock();
    const record: AcademicYearRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      name: input.name.trim(),
      code: input.code?.trim(),
      startDate: cloneRecord(input.startDate),
      endDate: cloneRecord(input.endDate),
      status: "planned",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createAcademicYear(record);

    await this.audit({
      eventName: "academic_year.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "AcademicYear",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        status: created.status
      }
    });

    return created;
  }

  public async updateAcademicYear(input: UpdateAcademicYearInput): Promise<AcademicYearRecord> {
    assertAcademicAccess(input.actor, input.schoolId);
    const current = await this.mustFindAcademicYear(input.schoolId, input.academicYearId);

    requireAcademicState(current, ["planned", "open"], "academic_year.updated", current.status);

    const startDate = input.startDate ? cloneRecord(input.startDate) : current.startDate;
    const endDate = input.endDate ? cloneRecord(input.endDate) : current.endDate;
    ensureChronology(startDate, endDate, "academic_year_invalid_dates", "AcademicYear");

    const terms = await this.options.repository.findTermsByAcademicYearId(current.id);
    const invalidTerm = terms.find(
      (term) => term.startDate.getTime() < startDate.getTime() || term.endDate.getTime() > endDate.getTime()
    );

    if (invalidTerm) {
      throw new AppError("Academic year dates must continue to contain existing terms", {
        status: 409,
        code: "academic_year_term_out_of_range",
        details: {
          termId: invalidTerm.id
        }
      });
    }

    const updated = await this.options.repository.updateAcademicYear(input.academicYearId, input.schoolId, {
      name: input.name?.trim() ?? current.name,
      code: input.code?.trim() ?? current.code,
      startDate,
      endDate,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Academic year not found", {
        status: 404,
        code: "academic_year_not_found"
      });
    }

    await this.audit({
      eventName: "academic_year.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "AcademicYear",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async activateAcademicYear(actor: SchoolActorContext, schoolId: string, academicYearId: string): Promise<AcademicYearRecord> {
    assertAcademicAccess(actor, schoolId);
    const current = await this.mustFindAcademicYear(schoolId, academicYearId);

    requireAcademicState(current, ["planned"], "academic_year.activated", "open");

    const activeYear = await this.options.repository.findOpenAcademicYearBySchoolId(schoolId);

    if (activeYear && activeYear.id !== current.id) {
      throw new AppError("Another academic year is already open", {
        status: 409,
        code: "academic_year_conflict",
        details: {
          activeAcademicYearId: activeYear.id
        }
      });
    }

    const updated = await this.options.repository.updateAcademicYear(academicYearId, schoolId, {
      status: "open",
      openedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Academic year not found", {
        status: 404,
        code: "academic_year_not_found"
      });
    }

    await this.audit({
      eventName: "academic_year.activated",
      actorId: actor.actorId,
      schoolId,
      resourceType: "AcademicYear",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async closeAcademicYear(actor: SchoolActorContext, schoolId: string, academicYearId: string): Promise<AcademicYearRecord> {
    assertAcademicAccess(actor, schoolId);
    const current = await this.mustFindAcademicYear(schoolId, academicYearId);

    requireAcademicState(current, ["open"], "academic_year.closed", "closed");

    const openTerm = await this.options.repository.findOpenTermBySchoolId(schoolId);

    if (openTerm && openTerm.academicYearId === current.id) {
      throw new AppError("Academic year cannot be closed while a term is still open", {
        status: 409,
        code: "academic_year_term_open",
        details: {
          openTermId: openTerm.id
        }
      });
    }

    const updated = await this.options.repository.updateAcademicYear(academicYearId, schoolId, {
      status: "closed",
      closedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Academic year not found", {
        status: 404,
        code: "academic_year_not_found"
      });
    }

    await this.audit({
      eventName: "academic_year.closed",
      actorId: actor.actorId,
      schoolId,
      resourceType: "AcademicYear",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async archiveAcademicYear(actor: SchoolActorContext, schoolId: string, academicYearId: string): Promise<AcademicYearRecord> {
    assertAcademicAccess(actor, schoolId);
    const current = await this.mustFindAcademicYear(schoolId, academicYearId);

    requireAcademicState(current, ["closed"], "academic_year.archived", "archived");

    const updated = await this.options.repository.updateAcademicYear(academicYearId, schoolId, {
      status: "archived",
      archivedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Academic year not found", {
        status: 404,
        code: "academic_year_not_found"
      });
    }

    await this.audit({
      eventName: "academic_year.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "AcademicYear",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async listAcademicYears(actor: SchoolActorContext, schoolId: string): Promise<readonly AcademicYearRecord[]> {
    assertAcademicAccess(actor, schoolId);
    const records = await this.options.repository.findAcademicYearsBySchoolId(schoolId);
    return sortAcademicYears(records);
  }

  public async createTerm(input: TermInput): Promise<TermRecord> {
    assertAcademicAccess(input.actor, input.schoolId);
    const academicYear = await this.mustFindAcademicYear(input.schoolId, input.academicYearId);

    if (academicYear.status === "archived" || academicYear.status === "closed") {
      throw new AppError("Terms can only be created within an open or planned academic year", {
        status: 409,
        code: "term_parent_year_inactive"
      });
    }

    ensureChronology(input.startDate, input.endDate, "term_invalid_dates", "Term");
    ensureTermWithinYear(input.startDate, input.endDate, academicYear);

    const now = this.clock();
    const record: TermRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      name: input.name.trim(),
      code: input.code?.trim(),
      startDate: cloneRecord(input.startDate),
      endDate: cloneRecord(input.endDate),
      status: "planned",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createTerm(record);

    await this.audit({
      eventName: "term.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Term",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        academicYearId: created.academicYearId,
        status: created.status
      }
    });

    return created;
  }

  public async updateTerm(input: UpdateTermInput): Promise<TermRecord> {
    assertAcademicAccess(input.actor, input.schoolId);
    const current = await this.mustFindTerm(input.schoolId, input.academicYearId, input.termId);

    requireTermState(current, ["planned", "open"], "term.updated", current.status);

    const academicYear = await this.mustFindAcademicYear(input.schoolId, input.academicYearId);
    const startDate = input.startDate ? cloneRecord(input.startDate) : current.startDate;
    const endDate = input.endDate ? cloneRecord(input.endDate) : current.endDate;

    ensureChronology(startDate, endDate, "term_invalid_dates", "Term");
    ensureTermWithinYear(startDate, endDate, academicYear);

    const updated = await this.options.repository.updateTerm(input.termId, input.schoolId, {
      name: input.name?.trim() ?? current.name,
      code: input.code?.trim() ?? current.code,
      startDate,
      endDate,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Term not found", {
        status: 404,
        code: "term_not_found"
      });
    }

    await this.audit({
      eventName: "term.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Term",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async activateTerm(actor: SchoolActorContext, schoolId: string, academicYearId: string, termId: string): Promise<TermRecord> {
    assertAcademicAccess(actor, schoolId);
    const current = await this.mustFindTerm(schoolId, academicYearId, termId);
    const academicYear = await this.mustFindAcademicYear(schoolId, academicYearId);

    requireTermState(current, ["planned"], "term.activated", "open");

    if (academicYear.status !== "open") {
      throw new AppError("Terms can only be activated within an open academic year", {
        status: 409,
        code: "term_parent_year_inactive",
        details: {
          academicYearStatus: academicYear.status
        }
      });
    }

    const openTerm = await this.options.repository.findOpenTermBySchoolId(schoolId);

    if (openTerm && openTerm.id !== current.id) {
      throw new AppError("Another term is already open", {
        status: 409,
        code: "term_conflict",
        details: {
          activeTermId: openTerm.id
        }
      });
    }

    const updated = await this.options.repository.updateTerm(termId, schoolId, {
      status: "open",
      openedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Term not found", {
        status: 404,
        code: "term_not_found"
      });
    }

    await this.audit({
      eventName: "term.activated",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Term",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async closeTerm(actor: SchoolActorContext, schoolId: string, academicYearId: string, termId: string): Promise<TermRecord> {
    assertAcademicAccess(actor, schoolId);
    const current = await this.mustFindTerm(schoolId, academicYearId, termId);

    requireTermState(current, ["open"], "term.closed", "closed");

    const updated = await this.options.repository.updateTerm(termId, schoolId, {
      status: "closed",
      closedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Term not found", {
        status: 404,
        code: "term_not_found"
      });
    }

    await this.audit({
      eventName: "term.closed",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Term",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async archiveTerm(actor: SchoolActorContext, schoolId: string, academicYearId: string, termId: string): Promise<TermRecord> {
    assertAcademicAccess(actor, schoolId);
    const current = await this.mustFindTerm(schoolId, academicYearId, termId);

    requireTermState(current, ["closed"], "term.archived", "archived");

    const updated = await this.options.repository.updateTerm(termId, schoolId, {
      status: "archived",
      archivedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Term not found", {
        status: 404,
        code: "term_not_found"
      });
    }

    await this.audit({
      eventName: "term.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Term",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async listTerms(
    actor: SchoolActorContext,
    schoolId: string,
    academicYearId?: string
  ): Promise<readonly TermRecord[]> {
    assertAcademicAccess(actor, schoolId);
    const records = academicYearId
      ? await this.options.repository.findTermsByAcademicYearId((await this.mustFindAcademicYear(schoolId, academicYearId)).id)
      : await this.options.repository.findTermsBySchoolId(schoolId);

    return sortTerms(records.filter((record) => record.schoolId === schoolId));
  }

  public async createClass(input: ClassInput): Promise<ClassRecord> {
    assertAcademicAccess(input.actor, input.schoolId);
    const academicYear = await this.mustFindAcademicYear(input.schoolId, input.academicYearId);

    if (academicYear.status === "archived" || academicYear.status === "closed") {
      throw new AppError("Classes can only be created within an active academic year", {
        status: 409,
        code: "class_parent_year_inactive"
      });
    }

    const now = this.clock();
    const record: ClassRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      name: input.name.trim(),
      code: input.code?.trim(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      teacherAssignmentIds: [],
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createClass(record);

    await this.audit({
      eventName: "class.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Class",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        academicYearId: created.academicYearId,
        status: created.status
      }
    });

    return created;
  }

  public async updateClass(input: UpdateClassInput): Promise<ClassRecord> {
    assertAcademicAccess(input.actor, input.schoolId);
    const current = await this.mustFindClass(input.schoolId, input.academicYearId, input.classId);

    requireClassState(current, ["draft", "active", "suspended"], current.status);

    const updated = await this.options.repository.updateClass(input.classId, input.schoolId, {
      name: input.name?.trim() ?? current.name,
      code: input.code?.trim() ?? current.code,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Class not found", {
        status: 404,
        code: "class_not_found"
      });
    }

    await this.audit({
      eventName: "class.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Class",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async archiveClass(actor: SchoolActorContext, schoolId: string, academicYearId: string, classId: string): Promise<ClassRecord> {
    assertAcademicAccess(actor, schoolId);
    const current = await this.mustFindClass(schoolId, academicYearId, classId);

    requireClassState(current, ["draft", "active", "suspended"], "archived");

    const updated = await this.options.repository.updateClass(classId, schoolId, {
      status: "archived",
      archivedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Class not found", {
        status: 404,
        code: "class_not_found"
      });
    }

    await this.audit({
      eventName: "class.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Class",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async listClasses(
    actor: SchoolActorContext,
    schoolId: string,
    academicYearId?: string
  ): Promise<readonly ClassRecord[]> {
    assertAcademicAccess(actor, schoolId);
    const records = academicYearId
      ? await this.options.repository.findClassesByAcademicYearId((await this.mustFindAcademicYear(schoolId, academicYearId)).id)
      : await this.options.repository.findClassesBySchoolId(schoolId);

    return sortClasses(records.filter((record) => record.schoolId === schoolId));
  }

  public async createSubject(input: SubjectInput): Promise<SubjectRecord> {
    assertAcademicAccess(input.actor, input.schoolId);

    const now = this.clock();
    const record: SubjectRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      name: input.name.trim(),
      code: input.code?.trim(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      teacherAssignmentIds: [],
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createSubject(record);

    await this.audit({
      eventName: "subject.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Subject",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        status: created.status
      }
    });

    return created;
  }

  public async updateSubject(input: UpdateSubjectInput): Promise<SubjectRecord> {
    assertAcademicAccess(input.actor, input.schoolId);
    const current = await this.mustFindSubject(input.schoolId, input.subjectId);

    requireSubjectState(current, ["draft", "active", "inactive"], current.status);

    const updated = await this.options.repository.updateSubject(input.subjectId, input.schoolId, {
      name: input.name?.trim() ?? current.name,
      code: input.code?.trim() ?? current.code,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Subject not found", {
        status: 404,
        code: "subject_not_found"
      });
    }

    await this.audit({
      eventName: "subject.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Subject",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async archiveSubject(actor: SchoolActorContext, schoolId: string, subjectId: string): Promise<SubjectRecord> {
    assertAcademicAccess(actor, schoolId);
    const current = await this.mustFindSubject(schoolId, subjectId);

    requireSubjectState(current, ["draft", "active", "inactive"], "archived");

    const updated = await this.options.repository.updateSubject(subjectId, schoolId, {
      status: "archived",
      archivedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Subject not found", {
        status: 404,
        code: "subject_not_found"
      });
    }

    await this.audit({
      eventName: "subject.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Subject",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async listSubjects(actor: SchoolActorContext, schoolId: string): Promise<readonly SubjectRecord[]> {
    assertAcademicAccess(actor, schoolId);
    const records = await this.options.repository.findSubjectsBySchoolId(schoolId);
    return sortSubjects(records);
  }

  private async mustFindAcademicYear(schoolId: string, academicYearId: string): Promise<AcademicYearRecord> {
    const academicYear = await this.options.repository.findAcademicYearById(academicYearId);

    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new AppError("Academic year not found", {
        status: 404,
        code: "academic_year_not_found"
      });
    }

    return academicYear;
  }

  private async mustFindTerm(schoolId: string, academicYearId: string, termId: string): Promise<TermRecord> {
    const term = await this.options.repository.findTermById(termId);

    if (!term || term.schoolId !== schoolId || term.academicYearId !== academicYearId) {
      throw new AppError("Term not found", {
        status: 404,
        code: "term_not_found"
      });
    }

    return term;
  }

  private async mustFindClass(schoolId: string, academicYearId: string, classId: string): Promise<ClassRecord> {
    const record = await this.options.repository.findClassById(classId);

    if (!record || record.schoolId !== schoolId || record.academicYearId !== academicYearId) {
      throw new AppError("Class not found", {
        status: 404,
        code: "class_not_found"
      });
    }

    return record;
  }

  private async mustFindSubject(schoolId: string, subjectId: string): Promise<SubjectRecord> {
    const record = await this.options.repository.findSubjectById(subjectId);

    if (!record || record.schoolId !== schoolId) {
      throw new AppError("Subject not found", {
        status: 404,
        code: "subject_not_found"
      });
    }

    return record;
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(): string {
    return this.options.idFactory?.() ?? defaultIdFactory();
  }

  private async audit(event: AcademicLifecycleAuditEvent): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
