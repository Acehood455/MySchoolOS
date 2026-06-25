import { describe, expect, it, vi } from "vitest";
import { InMemoryAcademicRepository } from "../academic/academic.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";
import { AssessmentService } from "./assessment.service.js";
import { InMemoryAssessmentRepository } from "./assessment.repository.js";

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

function createSchoolAdminActor(schoolId: string, overrides: Partial<SchoolActorContext> = {}): SchoolActorContext {
  return {
    actorId: "school-admin-1",
    roles: ["school_admin"],
    schoolId,
    ...overrides
  };
}

function createTeacherActor(schoolId: string): SchoolActorContext {
  return {
    actorId: "teacher-1",
    roles: ["teacher"],
    schoolId
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

  await repository.createClass({
    id: "class-2",
    schoolId,
    academicYearId: "year-1",
    name: "Primary 2",
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

function createService() {
  const assessmentRepository = new InMemoryAssessmentRepository();
  const academicRepository = new InMemoryAcademicRepository();
  const auditSink = { record: vi.fn() };
  const service = new AssessmentService({
    repository: assessmentRepository,
    academicRepository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["assessment-1", "assessment-2", "assessment-3", "assessment-4"]),
    teacherAssignmentResolver: async ({ actorId, schoolId, classId }) => actorId === "teacher-1" && schoolId === "school-1" && classId === "class-1"
  });

  return {
    assessmentRepository,
    academicRepository,
    auditSink,
    service
  };
}

describe("AssessmentService", () => {
  it("enforces lifecycle rules, duplicate prevention, and audit events", async () => {
    const { service, academicRepository, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");
    await seedAcademicData(academicRepository, "school-1");

    const created = await service.createAssessment({
      actor,
      schoolId: "school-1",
      academicYearId: "year-1",
      termId: "term-1",
      classId: "class-1",
      subjectId: "subject-1",
      assessmentType: "CA1",
      title: "First Continuous Assessment",
      description: "Baseline work",
      maxScore: 20,
      opensAt: new Date("2026-09-05T00:00:00.000Z"),
      closesAt: new Date("2026-09-10T00:00:00.000Z")
    });

    const updatedDraft = await service.updateAssessment({
      actor,
      schoolId: "school-1",
      assessmentId: created.id,
      title: "Updated Continuous Assessment",
      maxScore: 25
    });

    const opened = await service.openAssessment(actor, "school-1", created.id);

    const duplicateDraft = await service.createAssessment({
      actor,
      schoolId: "school-1",
      academicYearId: "year-1",
      termId: "term-1",
      classId: "class-1",
      subjectId: "subject-1",
      assessmentType: "CA1",
      title: "Duplicate Draft",
      maxScore: 20,
      opensAt: new Date("2026-09-12T00:00:00.000Z"),
      closesAt: new Date("2026-09-15T00:00:00.000Z")
    });

    await expect(service.openAssessment(actor, "school-1", duplicateDraft.id)).rejects.toMatchObject({
      status: 409,
      code: "assessment_duplicate_active"
    });

    const closed = await service.closeAssessment(actor, "school-1", created.id);
    const archived = await service.archiveAssessment(actor, "school-1", created.id);

    await expect(
      service.updateAssessment({
        actor,
        schoolId: "school-1",
        assessmentId: created.id,
        title: "Should Fail"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "assessment_lifecycle_invalid_transition"
    });

    expect(updatedDraft.title).toBe("Updated Continuous Assessment");
    expect(opened.status).toBe("open");
    expect(closed.status).toBe("closed");
    expect(archived.status).toBe("archived");
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "assessment.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "assessment.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "assessment.opened" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "assessment.closed" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "assessment.archived" }));
  });

  it("enforces tenant isolation and authorization", async () => {
    const { service, academicRepository } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");
    const teacher = createTeacherActor("school-1");
    await seedAcademicData(academicRepository, "school-1");

    const assessment = await service.createAssessment({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      academicYearId: "year-1",
      termId: "term-1",
      classId: "class-1",
      subjectId: "subject-1",
      assessmentType: "CA2",
      title: "Second Continuous Assessment",
      maxScore: 20,
      opensAt: new Date("2026-09-16T00:00:00.000Z"),
      closesAt: new Date("2026-09-20T00:00:00.000Z")
    });

    await expect(service.getAssessment(schoolTwoAdmin, "school-1", assessment.id)).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.createAssessment({
        actor: teacher,
        schoolId: "school-1",
        academicYearId: "year-1",
        termId: "term-1",
        classId: "class-2",
        subjectId: "subject-2",
        assessmentType: "EXAM",
        title: "Unauthorized",
        maxScore: 100,
        opensAt: new Date("2026-10-01T00:00:00.000Z"),
        closesAt: new Date("2026-10-05T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });
  });

  it("supports class-filtered teacher access and sorted listing", async () => {
    const { service, academicRepository } = createService();
    const actor = createSchoolAdminActor("school-1");
    const teacher = createTeacherActor("school-1");
    await seedAcademicData(academicRepository, "school-1");

    await service.createAssessment({
      actor,
      schoolId: "school-1",
      academicYearId: "year-1",
      termId: "term-1",
      classId: "class-1",
      subjectId: "subject-1",
      assessmentType: "CA1",
      title: "Class One",
      maxScore: 20,
      opensAt: new Date("2026-09-05T00:00:00.000Z"),
      closesAt: new Date("2026-09-10T00:00:00.000Z")
    });

    await service.createAssessment({
      actor,
      schoolId: "school-1",
      academicYearId: "year-1",
      termId: "term-1",
      classId: "class-2",
      subjectId: "subject-2",
      assessmentType: "CA2",
      title: "Class Two",
      maxScore: 20,
      opensAt: new Date("2026-09-05T00:00:00.000Z"),
      closesAt: new Date("2026-09-10T00:00:00.000Z")
    });

    const teacherAssessments = await service.listAssessments({
      actor: teacher,
      schoolId: "school-1"
    });

    expect(teacherAssessments).toHaveLength(1);
    expect(teacherAssessments[0]?.classId).toBe("class-1");
  });
});
