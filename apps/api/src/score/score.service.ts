import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { AcademicRepository } from "../academic/academic.repository.js";
import type { AssessmentRepository } from "../assessment/assessment.repository.js";
import type { AssessmentRecord } from "../assessment/assessment-context.js";
import type { EnrollmentRepository } from "../enrollment/enrollment.repository.js";
import type { EnrollmentRecord } from "../enrollment/enrollment-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { StudentRecord } from "../student/student-context.js";
import type { StudentRepository } from "../student/student.repository.js";
import type { ScoreAuditSink, ScoreRecord } from "./score-context.js";
import type { ScoreRepository } from "./score.repository.js";

export interface ScoreServiceOptions {
  readonly repository: ScoreRepository;
  readonly assessmentRepository: AssessmentRepository;
  readonly enrollmentRepository: EnrollmentRepository;
  readonly studentRepository: StudentRepository;
  readonly academicRepository: AcademicRepository;
  readonly auditSink?: ScoreAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
  readonly teacherAssignmentResolver?: (input: {
    readonly actorId: string;
    readonly schoolId: string;
    readonly classId: string;
  }) => Promise<boolean> | boolean;
}

export interface SubmitScoreInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly assessmentId: string;
  readonly studentId: string;
  readonly score: number;
}

export interface BulkSubmitScoresInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly assessmentId: string;
  readonly entries: readonly { readonly studentId: string; readonly score: number }[];
}

export interface UpdateScoreInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly scoreId: string;
  readonly score: number;
}

export interface ListScoresByAssessmentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly assessmentId: string;
}

export interface ListScoresByStudentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly studentId: string;
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

function canManageScores(actor: SchoolActorContext, schoolId: string): boolean {
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
      resourceType: "Score",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function sortScores(records: readonly ScoreRecord[]): ScoreRecord[] {
  return [...records].sort((left, right) => {
    if (left.submittedAt.getTime() !== right.submittedAt.getTime()) {
      return left.submittedAt.getTime() - right.submittedAt.getTime();
    }

    if (left.studentId !== right.studentId) {
      return left.studentId.localeCompare(right.studentId);
    }

    return left.id.localeCompare(right.id);
  });
}

export class ScoreService {
  public constructor(private readonly options: ScoreServiceOptions) {}

  public async submitScore(input: SubmitScoreInput): Promise<ScoreRecord> {
    const assessment = await this.mustFindAssessment(input.schoolId, input.assessmentId);
    await this.assertActorCanManageAssessmentClass(input.actor, input.schoolId, assessment.classId);
    this.assertAssessmentOpen(assessment);

    const student = await this.mustFindStudent(input.schoolId, input.studentId);
    this.assertStudentCanReceiveScores(student);
    await this.mustFindActiveEnrollment(input.schoolId, input.studentId, assessment);
    this.assertScoreWithinAssessmentRange(input.score, assessment);
    await this.assertNoExistingScore(input.schoolId, input.assessmentId, input.studentId);

    const now = this.clock();
    const record: ScoreRecord = {
      id: this.idFactory("score"),
      schoolId: input.schoolId,
      assessmentId: input.assessmentId,
      studentId: input.studentId,
      score: input.score,
      submittedBy: input.actor.actorId,
      submittedAt: now,
      updatedAt: now
    };

    const created = await this.options.repository.createScore(record);

    await this.audit({
      eventName: "score.submitted",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Score",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        assessmentId: created.assessmentId,
        studentId: created.studentId,
        score: created.score
      }
    });

    return created;
  }

  public async bulkSubmitScores(input: BulkSubmitScoresInput): Promise<readonly ScoreRecord[]> {
    const assessment = await this.mustFindAssessment(input.schoolId, input.assessmentId);
    await this.assertActorCanManageAssessmentClass(input.actor, input.schoolId, assessment.classId);
    this.assertAssessmentOpen(assessment);

    const prepared: Array<{
      readonly student: StudentRecord;
      readonly score: number;
    }> = [];

    for (const entry of input.entries) {
      const student = await this.mustFindStudent(input.schoolId, entry.studentId);
      this.assertStudentCanReceiveScores(student);
      await this.mustFindActiveEnrollment(input.schoolId, entry.studentId, assessment);
      this.assertScoreWithinAssessmentRange(entry.score, assessment);
      await this.assertNoExistingScore(input.schoolId, input.assessmentId, entry.studentId);

      prepared.push({
        student,
        score: entry.score
      });
    }

    const now = this.clock();
    const created: ScoreRecord[] = [];

    for (const entry of prepared) {
      const record: ScoreRecord = {
        id: this.idFactory("score"),
        schoolId: input.schoolId,
        assessmentId: input.assessmentId,
        studentId: entry.student.id,
        score: entry.score,
        submittedBy: input.actor.actorId,
        submittedAt: now,
        updatedAt: now
      };

      created.push(await this.options.repository.createScore(record));
    }

    await this.audit({
      eventName: "score.bulk_submitted",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "ScoreBulk",
      resourceId: input.assessmentId,
      outcome: "success",
      metadata: {
        assessmentId: input.assessmentId,
        entryCount: created.length
      }
    });

    return created;
  }

  public async updateScore(input: UpdateScoreInput): Promise<ScoreRecord> {
    const current = await this.mustFindScore(input.schoolId, input.scoreId);
    const assessment = await this.mustFindAssessment(input.schoolId, current.assessmentId);
    await this.assertActorCanManageAssessmentClass(input.actor, input.schoolId, assessment.classId);
    this.assertAssessmentOpen(assessment);
    this.assertScoreWithinAssessmentRange(input.score, assessment);

    const updated = await this.options.repository.updateScore(input.scoreId, input.schoolId, {
      score: input.score,
      submittedBy: input.actor.actorId,
      submittedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Score not found", {
        status: 404,
        code: "score_not_found"
      });
    }

    await this.audit({
      eventName: "score.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Score",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        assessmentId: updated.assessmentId,
        studentId: updated.studentId,
        score: updated.score
      }
    });

    return updated;
  }

  public async getScore(actor: SchoolActorContext, schoolId: string, scoreId: string): Promise<ScoreRecord> {
    const score = await this.mustFindScore(schoolId, scoreId);
    const assessment = await this.mustFindAssessment(schoolId, score.assessmentId);
    await this.assertActorCanManageAssessmentClass(actor, schoolId, assessment.classId);
    return score;
  }

  public async listScoresByAssessment(input: ListScoresByAssessmentInput): Promise<readonly ScoreRecord[]> {
    const assessment = await this.mustFindAssessment(input.schoolId, input.assessmentId);
    await this.assertActorCanManageAssessmentClass(input.actor, input.schoolId, assessment.classId);
    return sortScores(await this.options.repository.findScoresByAssessmentId(input.schoolId, input.assessmentId));
  }

  public async listScoresByStudent(input: ListScoresByStudentInput): Promise<readonly ScoreRecord[]> {
    await this.mustFindStudent(input.schoolId, input.studentId);
    const records = await this.options.repository.findScoresByStudentId(input.schoolId, input.studentId);

    if (canManageScores(input.actor, input.schoolId)) {
      return sortScores(records);
    }

    if (!isTeacher(input.actor)) {
      requirePermission(input.actor, false, "score.access", input.studentId);
    }

    return sortScores(await this.filterTeacherAccessibleScores(input.actor, input.schoolId, records));
  }

  private async assertActorCanManageAssessmentClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<void> {
    if (canManageScores(actor, schoolId)) {
      return;
    }

    if (!isTeacher(actor)) {
      requirePermission(actor, false, "score.access", classId);
      return;
    }

    const allowed = await this.canTeacherAccessClass(actor, schoolId, classId);

    if (!allowed) {
      requirePermission(actor, false, "score.class_assignment_missing", classId);
    }
  }

  private async canTeacherAccessClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<boolean> {
    if (!isTeacher(actor)) {
      return true;
    }

    if (!this.options.teacherAssignmentResolver) {
      throw new AppError("Teacher assignment resolver unavailable", {
        status: 500,
        code: "score_teacher_assignment_unavailable"
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

  private async filterTeacherAccessibleScores(
    actor: SchoolActorContext,
    schoolId: string,
    records: readonly ScoreRecord[]
  ): Promise<ScoreRecord[]> {
    const allowed: ScoreRecord[] = [];

    for (const record of records) {
      const assessment = await this.mustFindAssessment(schoolId, record.assessmentId);

      if (await this.canTeacherAccessClass(actor, schoolId, assessment.classId)) {
        allowed.push(record);
      }
    }

    return allowed;
  }

  private assertAssessmentOpen(assessment: AssessmentRecord): void {
    if (assessment.status !== "open") {
      throw new AppError("Assessment must be open for score entry", {
        status: 409,
        code: "assessment_not_open",
        details: {
          assessmentStatus: assessment.status
        }
      });
    }
  }

  private assertStudentCanReceiveScores(student: StudentRecord): void {
    if (student.status === "archived") {
      throw new AppError("Archived students cannot receive scores", {
        status: 409,
        code: "score_student_archived"
      });
    }
  }

  private assertScoreWithinAssessmentRange(score: number, assessment: AssessmentRecord): void {
    if (!(Number.isFinite(score) && score >= 0 && score <= assessment.maxScore)) {
      throw new AppError("Score must be between 0 and the assessment maximum", {
        status: 400,
        code: "score_out_of_range",
        details: {
          maxScore: assessment.maxScore
        }
      });
    }
  }

  private async mustFindScore(schoolId: string, scoreId: string): Promise<ScoreRecord> {
    const score = await this.options.repository.findScoreById(scoreId);

    if (!score || score.schoolId !== schoolId) {
      throw new AppError("Score not found", {
        status: 404,
        code: "score_not_found"
      });
    }

    return score;
  }

  private async mustFindAssessment(schoolId: string, assessmentId: string): Promise<AssessmentRecord> {
    const assessment = await this.options.assessmentRepository.findAssessmentById(assessmentId);

    if (!assessment || assessment.schoolId !== schoolId) {
      throw new AppError("Assessment not found", {
        status: 404,
        code: "assessment_not_found"
      });
    }

    return assessment;
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

  private async mustFindActiveEnrollment(
    schoolId: string,
    studentId: string,
    assessment: AssessmentRecord
  ): Promise<EnrollmentRecord> {
    const enrollment = await this.options.enrollmentRepository.findActiveEnrollmentByStudentAcademicYear(
      schoolId,
      studentId,
      assessment.academicYearId
    );

    if (!enrollment || enrollment.schoolId !== schoolId) {
      throw new AppError("Student requires an active enrollment", {
        status: 409,
        code: "score_enrollment_inactive"
      });
    }

    if (enrollment.classId !== assessment.classId) {
      throw new AppError("Enrollment does not belong to the assessment class", {
        status: 409,
        code: "score_enrollment_class_mismatch"
      });
    }

    return enrollment;
  }

  private async assertNoExistingScore(schoolId: string, assessmentId: string, studentId: string): Promise<void> {
    const existing = await this.options.repository.findScoreByAssessmentAndStudent(schoolId, assessmentId, studentId);

    if (existing) {
      throw new AppError("A score already exists for this student and assessment", {
        status: 409,
        code: "score_duplicate"
      });
    }
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(prefix: string): string {
    return this.options.idFactory?.(prefix) ?? defaultIdFactory(prefix);
  }

  private async audit(event: Parameters<NonNullable<ScoreAuditSink["record"]>>[0]): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
