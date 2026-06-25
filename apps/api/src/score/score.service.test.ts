import { describe, expect, it, vi } from "vitest";
import { InMemoryAcademicRepository } from "../academic/academic.repository.js";
import { InMemoryAssessmentRepository } from "../assessment/assessment.repository.js";
import { InMemoryEnrollmentRepository } from "../enrollment/enrollment.repository.js";
import { InMemoryStudentRepository } from "../student/student.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryScoreRepository } from "./score.repository.js";
import { ScoreService } from "./score.service.js";

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
    status: "open",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    openedAt: createClock()
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

async function seedAssessment(repository: InMemoryAssessmentRepository, schoolId: string) {
  await repository.createAssessment({
    id: "assessment-1",
    schoolId,
    academicYearId: "year-1",
    termId: "term-1",
    classId: "class-1",
    subjectId: "subject-1",
    assessmentType: "CA1",
    title: "First Assessment",
    maxScore: 20,
    status: "open",
    opensAt: new Date("2026-09-05T00:00:00.000Z"),
    closesAt: new Date("2026-09-10T00:00:00.000Z"),
    createdAt: createClock(),
    updatedAt: createClock()
  });
}

function createService() {
  const scoreRepository = new InMemoryScoreRepository();
  const assessmentRepository = new InMemoryAssessmentRepository();
  const enrollmentRepository = new InMemoryEnrollmentRepository();
  const studentRepository = new InMemoryStudentRepository();
  const academicRepository = new InMemoryAcademicRepository();
  const auditSink = { record: vi.fn() };
  const service = new ScoreService({
    repository: scoreRepository,
    assessmentRepository,
    enrollmentRepository,
    studentRepository,
    academicRepository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["score-1", "score-2", "score-3", "score-4", "score-5"]),
    teacherAssignmentResolver: async ({ actorId, schoolId, classId }) => actorId === "teacher-1" && schoolId === "school-1" && classId === "class-1"
  });

  return {
    scoreRepository,
    assessmentRepository,
    enrollmentRepository,
    studentRepository,
    academicRepository,
    auditSink,
    service
  };
}

describe("ScoreService", () => {
  it("submits scores, supports bulk submission, and emits audits", async () => {
    const { service, assessmentRepository, enrollmentRepository, studentRepository, academicRepository, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");
    await seedAssessment(assessmentRepository, "school-1");

    const student = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    await enrollmentRepository.createEnrollment({
      id: "enrollment-1",
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    const score = await service.submitScore({
      actor,
      schoolId: "school-1",
      assessmentId: "assessment-1",
      studentId: "student-1",
      score: 18
    });

    const updated = await service.updateScore({
      actor,
      schoolId: "school-1",
      scoreId: score.id,
      score: 19
    });

    const secondStudent = await studentRepository.createStudent({
      id: "student-2",
      schoolId: "school-1",
      admissionNumber: "ADM-002",
      firstName: "Ife",
      lastName: "Adebayo",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    await enrollmentRepository.createEnrollment({
      id: "enrollment-2",
      schoolId: "school-1",
      studentId: secondStudent.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    const bulk = await service.bulkSubmitScores({
      actor,
      schoolId: "school-1",
      assessmentId: "assessment-1",
      entries: [{ studentId: "student-2", score: 17 }]
    });

    expect(score.score).toBe(18);
    expect(updated.score).toBe(19);
    expect(bulk).toHaveLength(1);
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "score.submitted" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "score.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "score.bulk_submitted" }));
  });

  it("prevents duplicates, rejects closed assessments, and validates enrollment", async () => {
    const { service, assessmentRepository, enrollmentRepository, studentRepository, academicRepository } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");
    await seedAssessment(assessmentRepository, "school-1");

    const student = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock()
    });

    await enrollmentRepository.createEnrollment({
      id: "enrollment-1",
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    const firstScore = await service.submitScore({
      actor,
      schoolId: "school-1",
      assessmentId: "assessment-1",
      studentId: "student-1",
      score: 18
    });

    await expect(
      service.submitScore({
        actor,
        schoolId: "school-1",
        assessmentId: "assessment-1",
        studentId: "student-1",
        score: 18
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "score_duplicate"
    });

    await assessmentRepository.updateAssessment("assessment-1", "school-1", {
      status: "closed",
      updatedAt: createClock()
    });

    await expect(
      service.updateScore({
        actor,
        schoolId: "school-1",
        scoreId: firstScore.id,
        score: 20
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "assessment_not_open"
    });

    await assessmentRepository.updateAssessment("assessment-1", "school-1", {
      status: "open",
      updatedAt: createClock()
    });

    const archivedStudent = await studentRepository.createStudent({
      id: "student-archived",
      schoolId: "school-1",
      admissionNumber: "ADM-002",
      firstName: "Tola",
      lastName: "Bello",
      status: "archived",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: actor.actorId,
      activatedAt: createClock(),
      archivedAt: createClock()
    });

    await enrollmentRepository.createEnrollment({
      id: "enrollment-2",
      schoolId: "school-1",
      studentId: archivedStudent.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    await expect(
      service.submitScore({
        actor,
        schoolId: "school-1",
        assessmentId: "assessment-1",
        studentId: "student-archived",
        score: 18
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "score_student_archived"
    });
  });

  it("enforces tenant isolation and authorization", async () => {
    const { service, assessmentRepository, enrollmentRepository, studentRepository, academicRepository } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");
    const teacher = createTeacherActor("school-1");
    const unauthorizedTeacher = createTeacherActor("school-1");
    unauthorizedTeacher.actorId = "teacher-2";
    const superAdmin = createSuperAdminActor();
    await seedAcademicData(academicRepository, "school-1");
    await seedAssessment(assessmentRepository, "school-1");

    const student = await studentRepository.createStudent({
      id: "student-1",
      schoolId: "school-1",
      admissionNumber: "ADM-001",
      firstName: "Ada",
      lastName: "Okafor",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: schoolOneAdmin.actorId,
      activatedAt: createClock()
    });

    await enrollmentRepository.createEnrollment({
      id: "enrollment-1",
      schoolId: "school-1",
      studentId: student.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    const secondStudent = await studentRepository.createStudent({
      id: "student-2",
      schoolId: "school-1",
      admissionNumber: "ADM-002",
      firstName: "Ife",
      lastName: "Adebayo",
      status: "active",
      createdAt: createClock(),
      updatedAt: createClock(),
      createdBy: schoolOneAdmin.actorId,
      activatedAt: createClock()
    });

    await enrollmentRepository.createEnrollment({
      id: "enrollment-2",
      schoolId: "school-1",
      studentId: secondStudent.id,
      academicYearId: "year-1",
      classId: "class-1",
      admissionDate: createClock(),
      enrollmentStatus: "active",
      createdAt: createClock(),
      updatedAt: createClock()
    });

    const score = await service.submitScore({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      assessmentId: "assessment-1",
      studentId: "student-1",
      score: 16
    });

    await expect(service.getScore(schoolTwoAdmin, "school-1", score.id)).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.submitScore({
        actor: teacher,
        schoolId: "school-1",
        assessmentId: "assessment-1",
        studentId: "student-2",
        score: 15
      })
    ).resolves.toMatchObject({
      studentId: "student-2"
    });

    await expect(
      service.submitScore({
        actor: unauthorizedTeacher,
        schoolId: "school-1",
        assessmentId: "assessment-1",
        studentId: "student-1",
        score: 14
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.submitScore({
        actor: superAdmin,
        schoolId: "school-1",
        assessmentId: "assessment-1",
        studentId: "student-1",
        score: 14
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "score_duplicate"
    });
  });
});
