import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type { AcademicRepository } from "../academic/academic.repository.js";
import type { ClassRecord, SubjectRecord, TermRecord } from "../academic/academic-context.js";
import type { AssessmentRepository } from "../assessment/assessment.repository.js";
import type { AssessmentRecord } from "../assessment/assessment-context.js";
import type { EnrollmentRepository } from "../enrollment/enrollment.repository.js";
import type { EnrollmentRecord } from "../enrollment/enrollment-context.js";
import type { GradingRepository } from "../grading/grading.repository.js";
import type { GradingPolicyRecord, GradeBoundaryRecord } from "../grading/grading-context.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type { ScoreRepository } from "../score/score.repository.js";
import type { ScoreRecord } from "../score/score-context.js";
import type { StudentRecord } from "../student/student-context.js";
import type { StudentRepository } from "../student/student.repository.js";
import type { ResultAuditSink, ResultRecord, ResultStatus } from "./result-context.js";
import type { ResultRepository, ResultScope } from "./result.repository.js";

export interface ResultServiceOptions {
  readonly repository: ResultRepository;
  readonly assessmentRepository: AssessmentRepository;
  readonly scoreRepository: ScoreRepository;
  readonly enrollmentRepository: EnrollmentRepository;
  readonly studentRepository: StudentRepository;
  readonly academicRepository: AcademicRepository;
  readonly gradingRepository: GradingRepository;
  readonly auditSink?: ResultAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
  readonly teacherAssignmentResolver?: (input: {
    readonly actorId: string;
    readonly schoolId: string;
    readonly classId: string;
  }) => Promise<boolean> | boolean;
}

export interface ComputeStudentResultInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly assessmentId: string;
  readonly studentId: string;
}

export interface BulkComputeClassResultsInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly assessmentId: string;
}

export interface RecomputeResultInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly resultId: string;
}

export interface ListResultsByAssessmentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly assessmentId: string;
}

export interface ListResultsByClassInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly classId: string;
}

export interface ListResultsByStudentInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly studentId: string;
}

export interface ListResultsBySubjectInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly subjectId: string;
}

export interface ListResultsByTermInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly termId: string;
}

interface ComputationContext {
  readonly anchorAssessment: AssessmentRecord;
  readonly assessmentsByType: Record<"CA1" | "CA2" | "EXAM", AssessmentRecord>;
  readonly activePolicy: GradingPolicyRecord;
}

interface StudentComputationInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly student: StudentRecord;
  readonly enrollment: EnrollmentRecord;
  readonly context: ComputationContext;
  readonly isBulk: boolean;
}

interface PreparedStudentComputation {
  readonly record: ResultRecord;
  readonly scope: Required<ResultScope>;
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

function canManageResults(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
}

function isTeacher(actor: SchoolActorContext): boolean {
  return actor.roles.includes("teacher");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
      resourceType: "AssessmentResult",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function sortResults(records: readonly ResultRecord[]): ResultRecord[] {
  const statusPriority: Record<ResultStatus, number> = {
    draft: 0,
    computed: 1,
    reviewed: 2,
    published: 3
  };

  return [...records].sort((left, right) => {
    if (statusPriority[left.status] !== statusPriority[right.status]) {
      return statusPriority[left.status] - statusPriority[right.status];
    }

    if (left.computedAt.getTime() !== right.computedAt.getTime()) {
      return right.computedAt.getTime() - left.computedAt.getTime();
    }

    if (left.classId !== right.classId) {
      return left.classId.localeCompare(right.classId);
    }

    if (left.subjectId !== right.subjectId) {
      return left.subjectId.localeCompare(right.subjectId);
    }

    return left.studentId.localeCompare(right.studentId);
  });
}

export class ResultService {
  public constructor(private readonly options: ResultServiceOptions) {}

  public async computeStudentSubjectResult(input: ComputeStudentResultInput): Promise<ResultRecord> {
    const context = await this.loadComputationContext(input.schoolId, input.assessmentId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, context.anchorAssessment.classId);

    const student = await this.mustFindStudent(input.schoolId, input.studentId);
    this.assertStudentCanBeComputed(student);
    const enrollment = await this.mustFindActiveEnrollment(input.schoolId, input.studentId, context.anchorAssessment.academicYearId, context.anchorAssessment.classId);
    const prepared = await this.prepareStudentComputation({
      actor: input.actor,
      schoolId: input.schoolId,
      student,
      enrollment,
      context,
      isBulk: false
    });

    await this.assertResultDoesNotExist(input.schoolId, prepared.scope);

    const record = await this.createComputedResult(prepared, "computed");

    await this.audit({
      eventName: "result.computed",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "AssessmentResult",
      resourceId: record.id,
      outcome: "success",
      metadata: {
        studentId: record.studentId,
        classId: record.classId,
        subjectId: record.subjectId,
        termId: record.termId,
        academicYearId: record.academicYearId,
        gradingPolicyId: record.gradingPolicyId,
        finalScore: record.finalScore,
        grade: record.grade
      }
    });

    return record;
  }

  public async bulkComputeClassSubjectResults(input: BulkComputeClassResultsInput): Promise<readonly ResultRecord[]> {
    const context = await this.loadComputationContext(input.schoolId, input.assessmentId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, context.anchorAssessment.classId);

    const enrollments = await this.options.enrollmentRepository.findEnrollmentsByClassId(input.schoolId, context.anchorAssessment.classId);
    const activeEnrollments = enrollments.filter(
      (enrollment) =>
        enrollment.academicYearId === context.anchorAssessment.academicYearId && enrollment.enrollmentStatus === "active"
    );

    const students: Array<{ readonly student: StudentRecord; readonly enrollment: EnrollmentRecord }> = [];

    for (const enrollment of activeEnrollments) {
      const student = await this.mustFindStudent(input.schoolId, enrollment.studentId);
      this.assertStudentCanBeComputed(student);
      students.push({ student, enrollment });
    }

    for (const entry of students) {
      const scope = this.buildScope(context, entry.student.id);
      await this.assertResultDoesNotExist(input.schoolId, scope);
    }

    const prepared: PreparedStudentComputation[] = [];

    for (const entry of students) {
      prepared.push(
        await this.prepareStudentComputation({
          actor: input.actor,
          schoolId: input.schoolId,
          student: entry.student,
          enrollment: entry.enrollment,
          context,
          isBulk: true
        })
      );
    }

    const created: ResultRecord[] = [];

    for (const entry of prepared) {
      created.push(await this.createComputedResult(entry, "computed"));
    }

    await this.audit({
      eventName: "result.bulk_computed",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "AssessmentResultBulk",
      resourceId: input.assessmentId,
      outcome: "success",
      metadata: {
        assessmentId: input.assessmentId,
        classId: context.anchorAssessment.classId,
        subjectId: context.anchorAssessment.subjectId,
        termId: context.anchorAssessment.termId,
        count: created.length
      }
    });

    return created;
  }

  public async recomputeResult(input: RecomputeResultInput): Promise<ResultRecord> {
    const current = await this.mustFindResult(input.schoolId, input.resultId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, current.classId);

    if (current.status === "published") {
      throw new AppError("Published results cannot be recomputed", {
        status: 409,
        code: "result_published"
      });
    }

    const context = await this.loadComputationContextByScope(input.schoolId, current);
    const student = await this.mustFindStudent(input.schoolId, current.studentId);
    this.assertStudentCanBeComputed(student);
    const enrollment = await this.mustFindActiveEnrollment(input.schoolId, current.studentId, current.academicYearId, current.classId);
    const prepared = await this.prepareStudentComputation({
      actor: input.actor,
      schoolId: input.schoolId,
      student,
      enrollment,
      context,
      isBulk: false
    });

    const status = current.status === "reviewed" ? "reviewed" : "computed";
    const updated = await this.options.repository.updateResult(input.resultId, input.schoolId, {
      gradingPolicyId: prepared.record.gradingPolicyId,
      ca1Score: prepared.record.ca1Score,
      ca2Score: prepared.record.ca2Score,
      examScore: prepared.record.examScore,
      continuousAssessmentTotal: prepared.record.continuousAssessmentTotal,
      finalScore: prepared.record.finalScore,
      grade: prepared.record.grade,
      remark: prepared.record.remark,
      status,
      computedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Result not found", {
        status: 404,
        code: "result_not_found"
      });
    }

    await this.audit({
      eventName: "result.recomputed",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "AssessmentResult",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        studentId: updated.studentId,
        classId: updated.classId,
        subjectId: updated.subjectId,
        termId: updated.termId,
        academicYearId: updated.academicYearId,
        gradingPolicyId: updated.gradingPolicyId,
        finalScore: updated.finalScore,
        grade: updated.grade
      }
    });

    return updated;
  }

  public async getResult(actor: SchoolActorContext, schoolId: string, resultId: string): Promise<ResultRecord> {
    const result = await this.mustFindResult(schoolId, resultId);
    await this.assertActorCanAccessClass(actor, schoolId, result.classId);
    return result;
  }

  public async listResultsByAssessment(input: ListResultsByAssessmentInput): Promise<readonly ResultRecord[]> {
    const context = await this.loadComputationContext(input.schoolId, input.assessmentId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, context.anchorAssessment.classId);
    const records = await this.options.repository.findResultsByScope(input.schoolId, {
      classId: context.anchorAssessment.classId,
      subjectId: context.anchorAssessment.subjectId,
      academicYearId: context.anchorAssessment.academicYearId,
      termId: context.anchorAssessment.termId
    });
    return sortResults(records);
  }

  public async listResultsByClass(input: ListResultsByClassInput): Promise<readonly ResultRecord[]> {
    const classRecord = await this.mustFindClass(input.schoolId, input.classId);
    await this.assertActorCanAccessClass(input.actor, input.schoolId, classRecord.id);
    return sortResults(
      await this.options.repository.findResultsByScope(input.schoolId, {
        classId: classRecord.id
      })
    );
  }

  public async listResultsByStudent(input: ListResultsByStudentInput): Promise<readonly ResultRecord[]> {
    const student = await this.mustFindStudent(input.schoolId, input.studentId);
    const records = await this.options.repository.findResultsByScope(input.schoolId, {
      studentId: student.id
    });

    if (canManageResults(input.actor, input.schoolId)) {
      return sortResults(records);
    }

    if (!isTeacher(input.actor)) {
      requirePermission(input.actor, false, "result.access", student.id);
    }

    return sortResults(await this.filterTeacherAccessibleResults(input.actor, input.schoolId, records));
  }

  public async listResultsBySubject(input: ListResultsBySubjectInput): Promise<readonly ResultRecord[]> {
    const subject = await this.mustFindSubject(input.schoolId, input.subjectId);
    const records = await this.options.repository.findResultsByScope(input.schoolId, {
      subjectId: subject.id
    });

    if (canManageResults(input.actor, input.schoolId)) {
      return sortResults(records);
    }

    if (!isTeacher(input.actor)) {
      requirePermission(input.actor, false, "result.access", subject.id);
    }

    return sortResults(await this.filterTeacherAccessibleResults(input.actor, input.schoolId, records));
  }

  public async listResultsByTerm(input: ListResultsByTermInput): Promise<readonly ResultRecord[]> {
    const term = await this.mustFindTerm(input.schoolId, input.termId);
    const records = await this.options.repository.findResultsByScope(input.schoolId, {
      termId: term.id
    });

    if (canManageResults(input.actor, input.schoolId)) {
      return sortResults(records);
    }

    if (!isTeacher(input.actor)) {
      requirePermission(input.actor, false, "result.access", term.id);
    }

    return sortResults(await this.filterTeacherAccessibleResults(input.actor, input.schoolId, records));
  }

  private async loadComputationContext(schoolId: string, assessmentId: string): Promise<ComputationContext> {
    const anchorAssessment = await this.mustFindAssessment(schoolId, assessmentId);
    const assessmentsByType = await this.mustFindRequiredAssessments(anchorAssessment);
    const activePolicy = await this.mustFindActivePolicy(schoolId);

    this.assertAssessmentsClosed(assessmentsByType);

    return {
      anchorAssessment,
      assessmentsByType,
      activePolicy
    };
  }

  private async loadComputationContextByScope(schoolId: string, result: ResultRecord): Promise<ComputationContext> {
    const anchorAssessment =
      (await this.options.assessmentRepository.findAssessmentByScope(schoolId, {
        academicYearId: result.academicYearId,
        termId: result.termId,
        classId: result.classId,
        subjectId: result.subjectId,
        assessmentType: "CA1"
      })) ??
      (await this.options.assessmentRepository.findAssessmentByScope(schoolId, {
        academicYearId: result.academicYearId,
        termId: result.termId,
        classId: result.classId,
        subjectId: result.subjectId,
        assessmentType: "CA2"
      })) ??
      (await this.options.assessmentRepository.findAssessmentByScope(schoolId, {
        academicYearId: result.academicYearId,
        termId: result.termId,
        classId: result.classId,
        subjectId: result.subjectId,
        assessmentType: "EXAM"
      }));

    if (!anchorAssessment) {
      throw new AppError("Assessment not found", {
        status: 404,
        code: "assessment_not_found"
      });
    }

    return this.loadComputationContext(schoolId, anchorAssessment.id);
  }

  private async prepareStudentComputation(input: StudentComputationInput): Promise<{
    readonly record: ResultRecord;
    readonly scope: Required<ResultScope>;
  }> {
    const { context, student, enrollment } = input;
    const policy = context.activePolicy;
    const scores = await this.loadScoresForStudent(input.schoolId, student.id, context.assessmentsByType);
    const raw = this.calculateWeightedScores(policy, context.assessmentsByType, scores);
    const boundary = this.findGradeBoundary(policy.gradeBoundaries, raw.finalScore);

    const now = this.clock();
    const record: ResultRecord = {
      id: this.idFactory("result"),
      schoolId: input.schoolId,
      studentId: student.id,
      classId: enrollment.classId,
      subjectId: context.anchorAssessment.subjectId,
      academicYearId: enrollment.academicYearId,
      termId: context.anchorAssessment.termId,
      gradingPolicyId: policy.id,
      ca1Score: raw.ca1Score,
      ca2Score: raw.ca2Score,
      examScore: raw.examScore,
      continuousAssessmentTotal: raw.continuousAssessmentTotal,
      finalScore: raw.finalScore,
      grade: boundary.grade,
      remark: boundary.remark || undefined,
      status: "computed",
      computedAt: now,
      updatedAt: now
    };

    return {
      record,
      scope: {
        studentId: student.id,
        classId: enrollment.classId,
        subjectId: context.anchorAssessment.subjectId,
        academicYearId: enrollment.academicYearId,
        termId: context.anchorAssessment.termId
      }
    };
  }

  private async createComputedResult(
    prepared: PreparedStudentComputation,
    status: ResultStatus
  ): Promise<ResultRecord> {
    const created = await this.options.repository.createResult({
      ...prepared.record,
      status
    });

    return created;
  }

  private calculateWeightedScores(
    policy: GradingPolicyRecord,
    assessmentsByType: Record<"CA1" | "CA2" | "EXAM", AssessmentRecord>,
    scores: Record<"CA1" | "CA2" | "EXAM", ScoreRecord>
  ): {
    readonly ca1Score: number;
    readonly ca2Score: number;
    readonly examScore: number;
    readonly continuousAssessmentTotal: number;
    readonly finalScore: number;
  } {
    const ca1Score = round2((scores.CA1.score / assessmentsByType.CA1.maxScore) * policy.ca1Weight);
    const ca2Score = round2((scores.CA2.score / assessmentsByType.CA2.maxScore) * policy.ca2Weight);
    const examScore = round2((scores.EXAM.score / assessmentsByType.EXAM.maxScore) * policy.examWeight);
    const continuousAssessmentTotal = round2(ca1Score + ca2Score);
    const finalScore = round2(continuousAssessmentTotal + examScore);

    return {
      ca1Score,
      ca2Score,
      examScore,
      continuousAssessmentTotal,
      finalScore
    };
  }

  private async loadScoresForStudent(
    schoolId: string,
    studentId: string,
    assessmentsByType: Record<"CA1" | "CA2" | "EXAM", AssessmentRecord>
  ): Promise<Record<"CA1" | "CA2" | "EXAM", ScoreRecord>> {
    const scores = {
      CA1: await this.mustFindScoreForAssessment(schoolId, assessmentsByType.CA1.id, studentId, "CA1"),
      CA2: await this.mustFindScoreForAssessment(schoolId, assessmentsByType.CA2.id, studentId, "CA2"),
      EXAM: await this.mustFindScoreForAssessment(schoolId, assessmentsByType.EXAM.id, studentId, "EXAM")
    } as const;

    return scores;
  }

  private async mustFindScoreForAssessment(
    schoolId: string,
    assessmentId: string,
    studentId: string,
    type: "CA1" | "CA2" | "EXAM"
  ): Promise<ScoreRecord> {
    const score = await this.options.scoreRepository.findScoreByAssessmentAndStudent(schoolId, assessmentId, studentId);

    if (!score) {
      throw new AppError(`Missing ${type} score`, {
        status: 409,
        code: "result_score_missing",
        details: {
          assessmentId,
          studentId,
          assessmentType: type
        }
      });
    }

    return score;
  }

  private findGradeBoundary(boundaries: readonly GradeBoundaryRecord[], finalScore: number): GradeBoundaryRecord {
    const boundary = boundaries.find((entry) => finalScore >= entry.minScore && finalScore <= entry.maxScore);

    if (!boundary) {
      throw new AppError("No grade boundary matched the computed score", {
        status: 500,
        code: "result_grade_boundary_missing",
        details: {
          finalScore
        }
      });
    }

    return boundary;
  }

  private async assertActorCanAccessClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<void> {
    if (canManageResults(actor, schoolId)) {
      return;
    }

    if (!isTeacher(actor)) {
      requirePermission(actor, false, "result.access", classId);
      return;
    }

    const allowed = await this.canTeacherAccessClass(actor, schoolId, classId);

    if (!allowed) {
      requirePermission(actor, false, "result.class_assignment_missing", classId);
    }
  }

  private async canTeacherAccessClass(actor: SchoolActorContext, schoolId: string, classId: string): Promise<boolean> {
    if (!isTeacher(actor)) {
      return true;
    }

    if (!this.options.teacherAssignmentResolver) {
      throw new AppError("Teacher assignment resolver unavailable", {
        status: 500,
        code: "result_teacher_assignment_unavailable"
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

  private async filterTeacherAccessibleResults(
    actor: SchoolActorContext,
    schoolId: string,
    records: readonly ResultRecord[]
  ): Promise<ResultRecord[]> {
    const allowed: ResultRecord[] = [];

    for (const record of records) {
      if (await this.canTeacherAccessClass(actor, schoolId, record.classId)) {
        allowed.push(record);
      }
    }

    return allowed;
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

  private async mustFindRequiredAssessments(
    anchorAssessment: AssessmentRecord
  ): Promise<Record<"CA1" | "CA2" | "EXAM", AssessmentRecord>> {
    const scope = {
      academicYearId: anchorAssessment.academicYearId,
      termId: anchorAssessment.termId,
      classId: anchorAssessment.classId,
      subjectId: anchorAssessment.subjectId
    };

    const ca1 = await this.options.assessmentRepository.findAssessmentByScope(anchorAssessment.schoolId, {
      ...scope,
      assessmentType: "CA1"
    });
    const ca2 = await this.options.assessmentRepository.findAssessmentByScope(anchorAssessment.schoolId, {
      ...scope,
      assessmentType: "CA2"
    });
    const exam = await this.options.assessmentRepository.findAssessmentByScope(anchorAssessment.schoolId, {
      ...scope,
      assessmentType: "EXAM"
    });

    if (!ca1) {
      throw new AppError("Required assessments are missing", {
        status: 409,
        code: "result_assessment_missing",
        details: {
          assessmentType: "CA1"
        }
      });
    }

    if (!ca2) {
      throw new AppError("Required assessments are missing", {
        status: 409,
        code: "result_assessment_missing",
        details: {
          assessmentType: "CA2"
        }
      });
    }

    if (!exam) {
      throw new AppError("Required assessments are missing", {
        status: 409,
        code: "result_assessment_missing",
        details: {
          assessmentType: "EXAM"
        }
      });
    }

    return {
      CA1: ca1,
      CA2: ca2,
      EXAM: exam
    };
  }

  private assertAssessmentsClosed(assessmentsByType: Record<"CA1" | "CA2" | "EXAM", AssessmentRecord>): void {
    for (const [type, assessment] of Object.entries(assessmentsByType) as Array<["CA1" | "CA2" | "EXAM", AssessmentRecord]>) {
      if (assessment.status !== "closed") {
        throw new AppError("All required assessments must be closed before computation", {
          status: 409,
          code: "assessment_not_closed",
          details: {
            assessmentType: type,
            assessmentStatus: assessment.status
          }
        });
      }
    }
  }

  private async mustFindActivePolicy(schoolId: string): Promise<GradingPolicyRecord> {
    const policy = await this.options.gradingRepository.findActivePolicyBySchoolId(schoolId);

    if (!policy) {
      throw new AppError("Active grading policy not found", {
        status: 409,
        code: "result_grading_policy_missing"
      });
    }

    return policy;
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

  private assertStudentCanBeComputed(student: StudentRecord): void {
    if (student.status === "archived") {
      throw new AppError("Archived students cannot receive results", {
        status: 409,
        code: "result_student_archived"
      });
    }
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
        code: "result_enrollment_inactive"
      });
    }

    if (enrollment.classId !== classId) {
      throw new AppError("Enrollment does not belong to the result class", {
        status: 409,
        code: "result_enrollment_class_mismatch"
      });
    }

    return enrollment;
  }

  private async mustFindResult(schoolId: string, resultId: string): Promise<ResultRecord> {
    const result = await this.options.repository.findResultById(resultId);

    if (!result || result.schoolId !== schoolId) {
      throw new AppError("Result not found", {
        status: 404,
        code: "result_not_found"
      });
    }

    return result;
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

  private async assertResultDoesNotExist(schoolId: string, scope: Required<ResultScope>): Promise<void> {
    const existing = await this.options.repository.findResultByScope(schoolId, scope);

    if (existing) {
      throw new AppError("A result already exists for this student and subject scope", {
        status: 409,
        code: "result_duplicate",
        details: {
          studentId: scope.studentId,
          classId: scope.classId,
          subjectId: scope.subjectId,
          academicYearId: scope.academicYearId,
          termId: scope.termId
        }
      });
    }
  }

  private buildScope(context: ComputationContext, studentId: string): Required<ResultScope> {
    return {
      studentId,
      classId: context.anchorAssessment.classId,
      subjectId: context.anchorAssessment.subjectId,
      academicYearId: context.anchorAssessment.academicYearId,
      termId: context.anchorAssessment.termId
    };
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(prefix: string): string {
    return this.options.idFactory?.(prefix) ?? defaultIdFactory(prefix);
  }

  private async audit(event: Parameters<NonNullable<ResultAuditSink["record"]>>[0]): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
