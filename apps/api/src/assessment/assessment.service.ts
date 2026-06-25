import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { AcademicRepository } from "../academic/academic.repository.js";
import type { AcademicYearRecord, ClassRecord, SubjectRecord, TermRecord } from "../academic/academic-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { AssessmentAuditSink, AssessmentRecord, AssessmentStatus, AssessmentType } from "./assessment-context.js";
import type { AssessmentRepository } from "./assessment.repository.js";

export interface AssessmentServiceOptions {
  readonly repository: AssessmentRepository;
  readonly academicRepository: AcademicRepository;
  readonly auditSink?: AssessmentAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
  readonly teacherAssignmentResolver?: (input: {
    readonly actorId: string;
    readonly schoolId: string;
    readonly classId: string;
  }) => Promise<boolean> | boolean;
}

export interface CreateAssessmentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly academicYearId: string;
  readonly termId: string;
  readonly classId: string;
  readonly subjectId: string;
  readonly assessmentType: AssessmentType;
  readonly title: string;
  readonly description?: string;
  readonly maxScore: number;
  readonly opensAt: Date;
  readonly closesAt: Date;
}

export interface UpdateAssessmentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly assessmentId: string;
  readonly title?: string;
  readonly description?: string;
  readonly maxScore?: number;
  readonly opensAt?: Date;
  readonly closesAt?: Date;
}

export interface AssessmentListInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly academicYearId?: string;
  readonly termId?: string;
  readonly classId?: string;
  readonly subjectId?: string;
  readonly assessmentType?: AssessmentType;
  readonly status?: AssessmentStatus;
}

export interface AssessmentSummaryInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly assessmentId: string;
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

function canManageAssessments(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
}

function isTeacher(actor: SchoolActorContext): boolean {
  return actor.roles.includes("teacher");
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
      resourceType: "Assessment",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function sortAssessments(records: readonly AssessmentRecord[]): AssessmentRecord[] {
  const statusPriority: Record<AssessmentStatus, number> = {
    draft: 0,
    open: 1,
    closed: 2,
    archived: 3
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

    if (left.subjectId !== right.subjectId) {
      return left.subjectId.localeCompare(right.subjectId);
    }

    return left.title.localeCompare(right.title);
  });
}

function sameScope(left: AssessmentRecord, right: AssessmentRecord): boolean {
  return (
    left.academicYearId === right.academicYearId &&
    left.termId === right.termId &&
    left.classId === right.classId &&
    left.subjectId === right.subjectId &&
    left.assessmentType === right.assessmentType
  );
}

export class AssessmentService {
  public constructor(private readonly options: AssessmentServiceOptions) {}

  public async createAssessment(input: CreateAssessmentInput): Promise<AssessmentRecord> {
    await this.assertActorCanManageClass(input.actor, input.schoolId, input.classId);

    const academicYear = await this.mustFindAcademicYear(input.schoolId, input.academicYearId);
    const term = await this.mustFindTerm(input.schoolId, input.termId);
    const classRecord = await this.mustFindClass(input.schoolId, input.classId);
    const subject = await this.mustFindSubject(input.schoolId, input.subjectId);

    this.assertAssessmentContext(academicYear, term, classRecord, subject);
    this.assertScheduleOrder(input.opensAt, input.closesAt);

    const now = this.clock();
    const record: AssessmentRecord = {
      id: this.idFactory("assessment"),
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      termId: input.termId,
      classId: input.classId,
      subjectId: input.subjectId,
      assessmentType: input.assessmentType,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      maxScore: input.maxScore,
      status: "draft",
      opensAt: cloneRecord(input.opensAt),
      closesAt: cloneRecord(input.closesAt),
      createdAt: now,
      updatedAt: now
    };

    const created = await this.options.repository.createAssessment(record);

    await this.audit({
      eventName: "assessment.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Assessment",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        assessmentType: created.assessmentType,
        classId: created.classId,
        subjectId: created.subjectId,
        termId: created.termId,
        status: created.status
      }
    });

    return created;
  }

  public async updateAssessment(input: UpdateAssessmentInput): Promise<AssessmentRecord> {
    const current = await this.mustFindAssessment(input.schoolId, input.assessmentId);
    await this.assertActorCanManageClass(input.actor, input.schoolId, current.classId);

    this.assertMutableAssessment(current);

    const nextOpensAt = input.opensAt ?? current.opensAt;
    const nextClosesAt = input.closesAt ?? current.closesAt;
    this.assertScheduleOrder(nextOpensAt, nextClosesAt);

    const updated = await this.options.repository.updateAssessment(input.assessmentId, input.schoolId, {
      title: input.title?.trim() ?? current.title,
      description: input.description !== undefined ? input.description.trim() || undefined : current.description,
      maxScore: input.maxScore ?? current.maxScore,
      opensAt: cloneRecord(nextOpensAt),
      closesAt: cloneRecord(nextClosesAt),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Assessment not found", {
        status: 404,
        code: "assessment_not_found"
      });
    }

    await this.audit({
      eventName: "assessment.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Assessment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        assessmentType: updated.assessmentType,
        classId: updated.classId,
        subjectId: updated.subjectId,
        termId: updated.termId,
        status: updated.status
      }
    });

    return updated;
  }

  public async openAssessment(actor: SchoolActorContext, schoolId: string, assessmentId: string): Promise<AssessmentRecord> {
    const current = await this.mustFindAssessment(schoolId, assessmentId);
    await this.assertActorCanManageClass(actor, schoolId, current.classId);

    if (current.status !== "draft") {
      throw new AppError("Assessment cannot transition from the current state", {
        status: 409,
        code: "assessment_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "open"
        }
      });
    }

    await this.assertNoOpenDuplicate(current, schoolId);

    const updated = await this.options.repository.updateAssessment(assessmentId, schoolId, {
      status: "open",
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Assessment not found", {
        status: 404,
        code: "assessment_not_found"
      });
    }

    await this.audit({
      eventName: "assessment.opened",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Assessment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        assessmentType: updated.assessmentType,
        classId: updated.classId,
        subjectId: updated.subjectId,
        termId: updated.termId
      }
    });

    return updated;
  }

  public async closeAssessment(actor: SchoolActorContext, schoolId: string, assessmentId: string): Promise<AssessmentRecord> {
    const current = await this.mustFindAssessment(schoolId, assessmentId);
    await this.assertActorCanManageClass(actor, schoolId, current.classId);

    if (current.status !== "open") {
      throw new AppError("Assessment cannot transition from the current state", {
        status: 409,
        code: "assessment_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "closed"
        }
      });
    }

    const updated = await this.options.repository.updateAssessment(assessmentId, schoolId, {
      status: "closed",
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Assessment not found", {
        status: 404,
        code: "assessment_not_found"
      });
    }

    await this.audit({
      eventName: "assessment.closed",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Assessment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        assessmentType: updated.assessmentType,
        classId: updated.classId,
        subjectId: updated.subjectId,
        termId: updated.termId
      }
    });

    return updated;
  }

  public async archiveAssessment(actor: SchoolActorContext, schoolId: string, assessmentId: string): Promise<AssessmentRecord> {
    const current = await this.mustFindAssessment(schoolId, assessmentId);
    await this.assertActorCanManageClass(actor, schoolId, current.classId);

    if (current.status !== "closed") {
      throw new AppError("Assessment cannot transition from the current state", {
        status: 409,
        code: "assessment_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "archived"
        }
      });
    }

    const updated = await this.options.repository.updateAssessment(assessmentId, schoolId, {
      status: "archived",
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Assessment not found", {
        status: 404,
        code: "assessment_not_found"
      });
    }

    await this.audit({
      eventName: "assessment.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "Assessment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        assessmentType: updated.assessmentType,
        classId: updated.classId,
        subjectId: updated.subjectId,
        termId: updated.termId
      }
    });

    return updated;
  }

  public async getAssessment(actor: SchoolActorContext, schoolId: string, assessmentId: string): Promise<AssessmentRecord> {
    const assessment = await this.mustFindAssessment(schoolId, assessmentId);
    await this.assertActorCanManageClass(actor, schoolId, assessment.classId);
    return assessment;
  }

  public async listAssessments(input: AssessmentListInput): Promise<readonly AssessmentRecord[]> {
    let records = await this.options.repository.findAssessmentsBySchoolId(input.schoolId);

    records = records.filter((record) => {
      if (input.academicYearId && record.academicYearId !== input.academicYearId) {
        return false;
      }

      if (input.termId && record.termId !== input.termId) {
        return false;
      }

      if (input.classId && record.classId !== input.classId) {
        return false;
      }

      if (input.subjectId && record.subjectId !== input.subjectId) {
        return false;
      }

      if (input.assessmentType && record.assessmentType !== input.assessmentType) {
        return false;
      }

      if (input.status && record.status !== input.status) {
        return false;
      }

      return true;
    });

    if (input.classId) {
      await this.assertActorCanManageClass(input.actor, input.schoolId, input.classId);
      return sortAssessments(records);
    }

    if (isTeacher(input.actor)) {
      return sortAssessments(await this.filterTeacherAccessibleAssessments(input.actor, input.schoolId, records));
    }

    await this.assertActorCanManageSchool(input.actor, input.schoolId);
    return sortAssessments(records);
  }

  private async assertActorCanManageSchool(actor: SchoolActorContext, schoolId: string): Promise<void> {
    if (canManageAssessments(actor, schoolId)) {
      return;
    }

    requirePermission(actor, false, "assessment.access", schoolId);
  }

  private async assertActorCanManageClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<void> {
    if (canManageAssessments(actor, schoolId)) {
      return;
    }

    if (!isTeacher(actor)) {
      requirePermission(actor, false, "assessment.access", classId);
      return;
    }

    const allowed = await this.canTeacherAccessClass(actor, schoolId, classId);

    if (!allowed) {
      requirePermission(actor, false, "assessment.class_assignment_missing", classId);
    }
  }

  private async canTeacherAccessClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<boolean> {
    if (!isTeacher(actor)) {
      return true;
    }

    if (!this.options.teacherAssignmentResolver) {
      throw new AppError("Teacher assignment resolver unavailable", {
        status: 500,
        code: "assessment_teacher_assignment_unavailable"
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

  private async filterTeacherAccessibleAssessments(
    actor: SchoolActorContext,
    schoolId: string,
    records: readonly AssessmentRecord[]
  ): Promise<AssessmentRecord[]> {
    const allowed: AssessmentRecord[] = [];

    for (const record of records) {
      if (await this.canTeacherAccessClass(actor, schoolId, record.classId)) {
        allowed.push(record);
      }
    }

    return allowed;
  }

  private assertScheduleOrder(opensAt: Date, closesAt: Date): void {
    if (!(opensAt instanceof Date) || Number.isNaN(opensAt.getTime()) || !(closesAt instanceof Date) || Number.isNaN(closesAt.getTime())) {
      throw new AppError("Invalid assessment dates", {
        status: 400,
        code: "assessment_invalid_dates"
      });
    }

    if (opensAt.getTime() >= closesAt.getTime()) {
      throw new AppError("opensAt must be before closesAt", {
        status: 400,
        code: "assessment_schedule_invalid"
      });
    }
  }

  private assertAssessmentContext(
    academicYear: AcademicYearRecord,
    term: TermRecord,
    classRecord: ClassRecord,
    subject: SubjectRecord
  ): void {
    if (term.academicYearId !== academicYear.id || classRecord.academicYearId !== academicYear.id) {
      throw new AppError("Assessment context mismatch", {
        status: 409,
        code: "assessment_context_mismatch"
      });
    }

    if (subject.schoolId !== academicYear.schoolId) {
      throw new AppError("Assessment context mismatch", {
        status: 409,
        code: "assessment_context_mismatch"
      });
    }
  }

  private assertMutableAssessment(assessment: AssessmentRecord): void {
    if (assessment.status === "closed" || assessment.status === "archived") {
      throw new AppError("Closed assessments cannot be modified", {
        status: 409,
        code: "assessment_lifecycle_invalid_transition",
        details: {
          currentStatus: assessment.status
        }
      });
    }
  }

  private async assertNoOpenDuplicate(assessment: AssessmentRecord, schoolId: string): Promise<void> {
    const records = await this.options.repository.findAssessmentsBySchoolId(schoolId);
    const duplicate = records.find((record) => record.id !== assessment.id && record.status === "open" && sameScope(record, assessment));

    if (duplicate) {
      throw new AppError("An active assessment already exists for this type, class, subject, and term", {
        status: 409,
        code: "assessment_duplicate_active"
      });
    }
  }

  private async mustFindAssessment(schoolId: string, assessmentId: string): Promise<AssessmentRecord> {
    const assessment = await this.options.repository.findAssessmentById(assessmentId);

    if (!assessment || assessment.schoolId !== schoolId) {
      throw new AppError("Assessment not found", {
        status: 404,
        code: "assessment_not_found"
      });
    }

    return assessment;
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

  private async mustFindSubject(schoolId: string, subjectId: string): Promise<SubjectRecord> {
    const subject = await this.options.academicRepository.findSubjectById(subjectId);

    if (!subject || subject.schoolId !== schoolId) {
      throw new AppError("Subject not found", {
        status: 404,
        code: "subject_not_found"
      });
    }

    return subject;
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(prefix: string): string {
    return this.options.idFactory?.(prefix) ?? defaultIdFactory(prefix);
  }

  private async audit(event: Parameters<NonNullable<AssessmentAuditSink["record"]>>[0]): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
