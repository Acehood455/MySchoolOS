import { describe, expect, it, vi } from "vitest";
import { InMemoryAcademicRepository } from "../academic/academic.repository.js";
import { InMemoryAttendanceRepository } from "../attendance/attendance.repository.js";
import { InMemoryEnrollmentRepository } from "../enrollment/enrollment.repository.js";
import { InMemoryResultRepository } from "../result/result.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryStudentRepository } from "../student/student.repository.js";
import { InMemoryReportCardRepository } from "./report.repository.js";
import { ReportService } from "./report.service.js";

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

  await repository.createSubject({
    id: "subject-2",
    schoolId,
    name: "English",
    status: "active",
    createdAt: createClock(),
    updatedAt: createClock(),
    createdBy: "school-admin-1",
    teacherAssignmentIds: []
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

async function seedResults(repository: InMemoryResultRepository, schoolId: string, studentId: string, scores: { math: number; english: number }) {
  await repository.createResult({
    id: `${studentId}-math-result`,
    schoolId,
    studentId,
    classId: "class-1",
    subjectId: "subject-1",
    academicYearId: "year-1",
    termId: "term-1",
    gradingPolicyId: "policy-1",
    ca1Score: 10,
    ca2Score: 10,
    examScore: scores.math - 20,
    continuousAssessmentTotal: 20,
    finalScore: scores.math,
    grade: scores.math >= 70 ? "A" : "B",
    remark: scores.math >= 70 ? "Excellent" : "Good",
    status: "computed",
    computedAt: createClock(),
    updatedAt: createClock()
  });

  await repository.createResult({
    id: `${studentId}-english-result`,
    schoolId,
    studentId,
    classId: "class-1",
    subjectId: "subject-2",
    academicYearId: "year-1",
    termId: "term-1",
    gradingPolicyId: "policy-1",
    ca1Score: 10,
    ca2Score: 10,
    examScore: scores.english - 20,
    continuousAssessmentTotal: 20,
    finalScore: scores.english,
    grade: scores.english >= 70 ? "A" : "B",
    remark: scores.english >= 70 ? "Excellent" : "Good",
    status: "computed",
    computedAt: createClock(),
    updatedAt: createClock()
  });
}

async function seedAttendance(repository: InMemoryAttendanceRepository, schoolId: string, studentId: string) {
  await repository.createAttendance({
    id: `${studentId}-attendance-1`,
    schoolId,
    enrollmentId: `${studentId}-enrollment`,
    academicYearId: "year-1",
    termId: "term-1",
    classId: "class-1",
    attendanceDate: new Date("2026-09-05T00:00:00.000Z"),
    status: "present",
    createdAt: createClock(),
    updatedAt: createClock()
  });

  await repository.createAttendance({
    id: `${studentId}-attendance-2`,
    schoolId,
    enrollmentId: `${studentId}-enrollment`,
    academicYearId: "year-1",
    termId: "term-1",
    classId: "class-1",
    attendanceDate: new Date("2026-09-06T00:00:00.000Z"),
    status: "late",
    createdAt: createClock(),
    updatedAt: createClock()
  });
}

function createService() {
  const repository = new InMemoryReportCardRepository();
  const resultRepository = new InMemoryResultRepository();
  const attendanceRepository = new InMemoryAttendanceRepository();
  const enrollmentRepository = new InMemoryEnrollmentRepository();
  const studentRepository = new InMemoryStudentRepository();
  const academicRepository = new InMemoryAcademicRepository();
  const auditSink = { record: vi.fn() };
  const service = new ReportService({
    repository,
    resultRepository,
    attendanceRepository,
    enrollmentRepository,
    studentRepository,
    academicRepository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["report-1", "report-2", "report-3", "report-4"]),
    teacherAssignmentResolver: async ({ actorId, schoolId, classId }) => actorId === "teacher-1" && schoolId === "school-1" && classId === "class-1"
  });

  return {
    repository,
    resultRepository,
    attendanceRepository,
    enrollmentRepository,
    studentRepository,
    academicRepository,
    auditSink,
    service
  };
}

describe("ReportService", () => {
  it("generates reports with attendance, totals, positions, and grading remarks", async () => {
    const { service, resultRepository, attendanceRepository, enrollmentRepository, studentRepository, academicRepository, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-1", "ADM-001");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-2", "ADM-002");
    await seedResults(resultRepository, "school-1", "student-1", { math: 80, english: 70 });
    await seedResults(resultRepository, "school-1", "student-2", { math: 60, english: 50 });
    await seedAttendance(attendanceRepository, "school-1", "student-1");

    const report = await service.generateReport({
      actor,
      schoolId: "school-1",
      studentId: "student-1",
      classId: "class-1",
      academicYearId: "year-1",
      termId: "term-1",
      teacherComments: "Well done",
      principalComments: "Keep it up"
    });

    expect(report.totalScore).toBe(150);
    expect(report.average).toBe(75);
    expect(report.overallPosition).toBe(1);
    expect(report.subjectResults.find((entry) => entry.subjectId === "subject-1")?.position).toBe(1);
    expect(report.subjectResults.find((entry) => entry.subjectId === "subject-2")?.position).toBe(2);
    expect(report.attendanceSummary.totalDays).toBe(2);
    expect(report.attendanceSummary.attendancePercentage).toBe(100);
    expect(report.gradingRemarks).toHaveLength(2);
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "report_card.generated" }));
  });

  it("publishes and unpublishes reports while blocking regeneration when published", async () => {
    const { service, resultRepository, attendanceRepository, enrollmentRepository, studentRepository, academicRepository, auditSink, repository } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-1", "ADM-001");
    await seedResults(resultRepository, "school-1", "student-1", { math: 80, english: 70 });
    await seedAttendance(attendanceRepository, "school-1", "student-1");

    const report = await service.generateReport({
      actor,
      schoolId: "school-1",
      studentId: "student-1",
      classId: "class-1",
      academicYearId: "year-1",
      termId: "term-1"
    });

    const published = await service.publishReport({
      actor,
      schoolId: "school-1",
      reportId: report.id
    });

    await expect(
      service.regenerateReport({
        actor,
        schoolId: "school-1",
        reportId: published.id
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "report_card_published"
    });

    const unpublished = await service.unpublishReport({
      actor,
      schoolId: "school-1",
      reportId: report.id
    });

    const regenerated = await service.regenerateReport({
      actor,
      schoolId: "school-1",
      reportId: unpublished.id,
      teacherComments: "Updated"
    });

    await expect(service.publishReport({ actor, schoolId: "school-1", reportId: regenerated.id })).resolves.toBeTruthy();

    expect(published.status).toBe("published");
    expect(unpublished.status).toBe("generated");
    expect(regenerated.teacherComments).toBe("Updated");
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "report_card.published" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "report_card.unpublished" }));
    expect(await repository.findReportById(report.id)).toBeTruthy();
  });

  it("enforces tenant isolation and authorization", async () => {
    const { service, resultRepository, attendanceRepository, enrollmentRepository, studentRepository, academicRepository } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");
    const teacher = createTeacherActor("school-1");
    const superAdmin = createSuperAdminActor();
    await seedAcademicData(academicRepository, "school-1");
    await seedStudent(studentRepository, enrollmentRepository, "school-1", "student-1", "ADM-001");
    await seedResults(resultRepository, "school-1", "student-1", { math: 80, english: 70 });
    await seedAttendance(attendanceRepository, "school-1", "student-1");

    const report = await service.generateReport({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      studentId: "student-1",
      classId: "class-1",
      academicYearId: "year-1",
      termId: "term-1"
    });

    await expect(service.getReport({ actor: schoolTwoAdmin, schoolId: "school-1", reportId: report.id })).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.getReport({
        actor: superAdmin,
        schoolId: "school-2",
        reportId: report.id
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "report_card_not_found"
    });

    const unauthorizedService = new ReportService({
      repository: new InMemoryReportCardRepository(),
      resultRepository,
      attendanceRepository,
      enrollmentRepository,
      studentRepository,
      academicRepository,
      clock: createClock,
      idFactory: createSequenceFactory(["report-5"]),
      teacherAssignmentResolver: async () => false
    });

    await expect(
      unauthorizedService.generateReport({
        actor: teacher,
        schoolId: "school-1",
        studentId: "student-1",
        classId: "class-1",
        academicYearId: "year-1",
        termId: "term-1"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });
  });
});
