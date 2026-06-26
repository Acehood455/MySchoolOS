import { describe, expect, it, vi } from "vitest";
import { InMemoryAcademicRepository } from "../academic/academic.repository.js";
import { InMemoryAssessmentRepository } from "../assessment/assessment.repository.js";
import { InMemoryEnrollmentRepository } from "../enrollment/enrollment.repository.js";
import { InMemoryGradingRepository } from "../grading/grading.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryScoreRepository } from "../score/score.repository.js";
import { InMemoryStudentRepository } from "../student/student.repository.js";
import { InMemoryResultRepository } from "./result.repository.js";
import { ResultService } from "./result.service.js";

function createClock(): Date {
  return new Date("2026-06-20T00:00:00.000Z");
}

function createSequenceFactory(values: string[]) {
  return (prefix: string) => {
    const value = values.shift();

    if (!value) {
      throw new Error("No value available");
    }

    return `${prefix}_${value}`;
  };
}

function createSchoolAdminActor(schoolId: string): SchoolActorContext {
  return {
    actorId: "school-admin-1",
    roles: ["school_admin"],
    schoolId
  };
}

function createTeacherActor(schoolId: string): SchoolActorContext {
  return {
    actorId: "teacher-1",
    roles: ["teacher"],
    schoolId
  };
}

function createSuperAdminActor(): SchoolActorContext {
  return {
    actorId: "super-admin-1",
    roles: ["super_admin"],
    schoolId: null
  };
}

async function seedAcademicData(repository: InMemoryAcademicRepository, schoolId: string) {
  await repository.createAcademicYear({
    id: "year-1",
    schoolId,
    name: "2026/2027",
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: new Date("2027-07-31T00:00:00.000Z"),
    status: "open",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    openedAt: createClock()
  });

  await repository.createTerm({
    id: "term-1",
    schoolId,
    academicYearId: "year-1",
    name: "Term 1",
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: new Date("2026-12-15T00:00:00.000Z"),
    status: "closed",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    openedAt: createClock(),
    closedAt: createClock()
  });

  await repository.createClass({
    id: "class-1",
    schoolId,
    academicYearId: "year-1",
    name: "Primary 1",
    status: "active",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    teacherAssignmentIds: []
  });

  await repository.createSubject({
    id: "subject-1",
    schoolId,
    name: "Mathematics",
    status: "active",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    teacherAssignmentIds: []
  });
}

async function seedAssessments(repository: InMemoryAssessmentRepository, schoolId: string, status: "closed" | "open" = "closed") {
  const assessments = [
    { id: "assessment-ca1", assessmentType: "CA1" as const },
    { id: "assessment-ca2", assessmentType: "CA2" as const },
    { id: "assessment-exam", assessmentType: "EXAM" as const }
  ];

  for (const assessment of assessments) {
    await repository.createAssessment({
      id: assessment.id,
      schoolId,
      academicYearId: "year-1",
      termId: "term-1",
      classId: "class-1",
      subjectId: "subject-1",
      assessmentType: assessment.assessmentType,
      title: assessment.assessmentType,
      maxScore: assessment.assessmentType === "EXAM" ? 50 : 25,
      status,
      opensAt: new Date("2026-09-05T00:00:00.000Z"),
      closesAt: new Date("2026-09-10T00:00:00.000Z"),
      createdAt: createClock(),
      updatedAt: createClock()
    });
  }
}

async function seedPolicy(repository: InMemoryGradingRepository, schoolId: string) {
  return repository.createPolicy({
    id: "policy-1",
    schoolId,
    name: "2026 Policy",
    version: "1",
    ca1Weight: 20,
    ca2Weight: 30,
    examWeight: 50,
    gradeBoundaries: [
      { grade: "F", minScore: 0, maxScore: 39, remark: "Needs improvement" },
      { grade: "B", minScore: 40, maxScore: 69, remark: "Good work" },
      { grade: "A", minScore: 70, maxScore: 100, remark: "Excellent" }
    ],
    remarks: "Initial policy",
    status: "active",
    effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: createClock(),
    updatedAt: createClock()
  });
}

async function seedStudent(
  studentRepository: InMemoryStudentRepository,
  enrollmentRepository: InMemoryEnrollmentRepository,
  schoolId: string,
  studentId: string,
  admissionNumber: string
) {
  await studentRepository.createStudent({
    id: studentId,
    schoolId,
    admissionNumber,
    firstName: "Ada",
    lastName: "Okafor",
    status: "active",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    activatedAt: createClock()
  });

  await enrollmentRepository.createEnrollment({
    id: `${studentId}-enrollment`,
    schoolId,
    studentId,
    academicYearId: "year-1",
    classId: "class-1",
    admissionDate: createClock(),
    enrollmentStatus: "active",
    createdAt: createClock(),
    updatedAt: createClock()
  });
}

function createService() {
  const resultRepository = new InMemoryResultRepository();
  const assessmentRepository = new InMemoryAssessmentRepository();
  const scoreRepository = new InMemoryScoreRepository();
  const enrollmentRepository = new InMemoryEnrollmentRepository();
  const studentRepository = new InMemoryStudentRepository();
  const academicRepository = new InMemoryAcademicRepository();
  const gradingRepository = new InMemoryGradingRepository();
  const auditSink = { record: vi.fn() };
  const service = new ResultService({
    repository: resultRepository,
    assessmentRepository,
    scoreRepository,
    enrollmentRepository,
    studentRepository,
    academicRepository,
    gradingRepository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["result-1", "result-2", "result-3", "result-4", "result-5"]),
    teacherAssignmentResolver: async ({ actorId, schoolId, classId }) => actorId === "teacher-1" && schoolId === "school-1" && classId === "class-1"
  });

  return {
    resultRepository,
    assessmentRepository,
    scoreRepository,
    enrollmentRepository,
    studentRepository,
    academicRepository,
    gradingRepository,
    auditSink,
    service
  };
}

async function seedScores(repository: InMemoryScoreRepository, schoolId: string, studentId: string, scores: { ca1: number; ca2: number; exam: number }) {
  await repository.createScore({
    id: `${studentId}-ca1-score`,
    schoolId,
    assessmentId: "assessment-ca1",
    studentId,
    score: scores.ca1,
    submittedBy: "teacher-1",
    submittedAt: createClock(),
    updatedAt: createClock()
  });

  await repository.createScore({
    id: `${studentId}-ca2-score`,
    schoolId,
    assessmentId: "assessment-ca2",
    studentId,
    score: scores.ca2,
    submittedBy: "teacher-1",
    submittedAt: createClock(),
    updatedAt: createClock()
  });

  await repository.createScore({
    id: `${studentId}-exam-score`,
    schoolId,
    assessmentId: "assessment-exam",
    studentId,
    score: scores.exam,
    submittedBy: "teacher-1",
    submittedAt: createClock(),
    updatedAt: createClock()
  });
}

describe("ResultService", () => {
  it("computes results, assigns grades and remarks, and emits audit events", async () => {
    const { service, assessmentRepository, scoreRepository, enrollmentRepository, studentRepository, academicRepository, gradingRepository, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");
    await seedAssessments(assessmentRepository, "school-1");
    await seedPolicy(gradingRepository, "school-1");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-1", "ADM-001");
    await seedScores(scoreRepository, "school-1", "student-1", { ca1: 20, ca2: 20, exam: 50 });

    const result = await service.computeStudentSubjectResult({
      actor,
      schoolId: "school-1",
      assessmentId: "assessment-ca1",
      studentId: "student-1"
    });

    expect(result.ca1Score).toBe(16);
    expect(result.ca2Score).toBe(24);
    expect(result.examScore).toBe(50);
    expect(result.continuousAssessmentTotal).toBe(40);
    expect(result.finalScore).toBe(90);
    expect(result.grade).toBe("A");
    expect(result.remark).toBe("Excellent");
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "result.computed" }));
  });

  it("supports bulk computation and recomputation", async () => {
    const { service, assessmentRepository, scoreRepository, enrollmentRepository, studentRepository, academicRepository, gradingRepository, resultRepository, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");
    await seedAssessments(assessmentRepository, "school-1");
    await seedPolicy(gradingRepository, "school-1");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-1", "ADM-001");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-2", "ADM-002");
    await seedScores(scoreRepository, "school-1", "student-1", { ca1: 20, ca2: 20, exam: 50 });
    await seedScores(scoreRepository, "school-1", "student-2", { ca1: 10, ca2: 15, exam: 30 });

    const bulk = await service.bulkComputeClassSubjectResults({
      actor,
      schoolId: "school-1",
      assessmentId: "assessment-ca1"
    });

    const first = bulk.find((entry) => entry.studentId === "student-1");
    expect(bulk).toHaveLength(2);
    expect(first?.finalScore).toBe(90);

    await scoreRepository.updateScore("student-1-ca1-score", "school-1", {
      score: 25,
      submittedBy: "teacher-1",
      submittedAt: createClock(),
      updatedAt: createClock()
    });

    const recomputed = await service.recomputeResult({
      actor,
      schoolId: "school-1",
      resultId: first!.id
    });

    expect(recomputed.finalScore).toBe(94);
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "result.bulk_computed" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "result.recomputed" }));

    const stored = await resultRepository.findResultById(first!.id);
    expect(stored?.id).toBe(first!.id);
  });

  it("rejects missing scores, open assessments, inactive enrollments, and published recomputation", async () => {
    const { service, assessmentRepository, scoreRepository, enrollmentRepository, studentRepository, academicRepository, gradingRepository, resultRepository } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");
    await seedAssessments(assessmentRepository, "school-1");
    await seedPolicy(gradingRepository, "school-1");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-1", "ADM-001");

    await scoreRepository.createScore({
      id: "student-1-ca1-score",
      schoolId: "school-1",
      assessmentId: "assessment-ca1",
      studentId: "student-1",
      score: 20,
      submittedBy: "teacher-1",
      submittedAt: createClock(),
      updatedAt: createClock()
    });

    await scoreRepository.createScore({
      id: "student-1-ca2-score",
      schoolId: "school-1",
      assessmentId: "assessment-ca2",
      studentId: "student-1",
      score: 20,
      submittedBy: "teacher-1",
      submittedAt: createClock(),
      updatedAt: createClock()
    });

    await expect(
      service.computeStudentSubjectResult({
        actor,
        schoolId: "school-1",
        assessmentId: "assessment-ca1",
        studentId: "student-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "result_score_missing"
    });

    await assessmentRepository.updateAssessment("assessment-ca1", "school-1", {
      status: "open",
      updatedAt: createClock()
    });

    await expect(
      service.computeStudentSubjectResult({
        actor,
        schoolId: "school-1",
        assessmentId: "assessment-ca1",
        studentId: "student-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "assessment_not_closed"
    });

    await assessmentRepository.updateAssessment("assessment-ca1", "school-1", {
      status: "closed",
      updatedAt: createClock()
    });

    await scoreRepository.createScore({
      id: "student-1-exam-score",
      schoolId: "school-1",
      assessmentId: "assessment-exam",
      studentId: "student-1",
      score: 50,
      submittedBy: "teacher-1",
      submittedAt: createClock(),
      updatedAt: createClock()
    });

    await enrollmentRepository.updateEnrollment("student-1-enrollment", "school-1", {
      enrollmentStatus: "withdrawn",
      updatedAt: createClock()
    });

    await expect(
      service.computeStudentSubjectResult({
        actor,
        schoolId: "school-1",
        assessmentId: "assessment-ca1",
        studentId: "student-1"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "result_enrollment_inactive"
    });

    await enrollmentRepository.updateEnrollment("student-1-enrollment", "school-1", {
      enrollmentStatus: "active",
      updatedAt: createClock()
    });

    const result = await service.computeStudentSubjectResult({
      actor,
      schoolId: "school-1",
      assessmentId: "assessment-ca1",
      studentId: "student-1"
    });

    await resultRepository.updateResult(result.id, "school-1", {
      status: "published",
      updatedAt: createClock()
    });

    await expect(
      service.recomputeResult({
        actor,
        schoolId: "school-1",
        resultId: result.id
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "result_published"
    });
  });

  it("enforces tenant isolation and authorization", async () => {
    const { service, assessmentRepository, scoreRepository, enrollmentRepository, studentRepository, academicRepository, gradingRepository } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");
    const teacher = createTeacherActor("school-1");
    const superAdmin = createSuperAdminActor();
    await seedAcademicData(academicRepository, "school-1");
    await seedAssessments(assessmentRepository, "school-1");
    await seedPolicy(gradingRepository, "school-1");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-1", "ADM-001");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-2", "ADM-002");
    await seedScores(scoreRepository, "school-1", "student-1", { ca1: 20, ca2: 20, exam: 50 });
    await seedScores(scoreRepository, "school-1", "student-2", { ca1: 10, ca2: 15, exam: 30 });

    const result = await service.computeStudentSubjectResult({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      assessmentId: "assessment-ca1",
      studentId: "student-1"
    });

    await expect(service.getResult(schoolTwoAdmin, "school-1", result.id)).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.computeStudentSubjectResult({
        actor: teacher,
        schoolId: "school-1",
        assessmentId: "assessment-ca1",
        studentId: "student-2"
      })
    ).resolves.toBeTruthy();

    await expect(
      service.computeStudentSubjectResult({
        actor: teacher,
        schoolId: "school-1",
        assessmentId: "assessment-ca1",
        studentId: "student-2"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "result_duplicate"
    });

    await expect(
      service.getResult(superAdmin, "school-2", result.id)
    ).rejects.toMatchObject({
      status: 404,
      code: "result_not_found"
    });
  });
});
