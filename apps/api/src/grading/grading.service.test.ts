import { describe, expect, it, vi } from "vitest";
import type { SchoolActorContext } from "../school/school-context.js";
import { InMemoryGradingRepository } from "./grading.repository.js";
import { GradingService } from "./grading.service.js";

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

function createSuperAdminActor(): SchoolActorContext {
  return {
    actorId: "super-admin-1",
    roles: ["super_admin"],
    schoolId: null
  };
}

function createTeacherActor(schoolId: string): SchoolActorContext {
  return {
    actorId: "teacher-1",
    roles: ["teacher"],
    schoolId
  };
}

function createService() {
  const repository = new InMemoryGradingRepository();
  const auditSink = { record: vi.fn() };
  const service = new GradingService({
    repository,
    auditSink,
    clock: createClock,
    idFactory: createSequenceFactory(["policy-1", "policy-2", "policy-3", "policy-4"])
  });

  return {
    repository,
    auditSink,
    service
  };
}

describe("GradingService", () => {
  it("validates weights, boundaries, activation behavior, version uniqueness, and audits", async () => {
    const { service, repository, auditSink } = createService();
    const actor = createSchoolAdminActor("school-1");

    const created = await service.createPolicy({
      actor,
      schoolId: "school-1",
      name: "2026 Policy",
      version: "1",
      ca1Weight: 20,
      ca2Weight: 30,
      examWeight: 50,
      gradeBoundaries: [
        { grade: "F", minScore: 0, maxScore: 39, remark: "Fail" },
        { grade: "C", minScore: 40, maxScore: 69, remark: "Pass" },
        { grade: "A", minScore: 70, maxScore: 100, remark: "Excellent" }
      ],
      effectiveFrom: new Date("2026-09-01T00:00:00.000Z")
    });

    const updated = await service.updatePolicy({
      actor,
      schoolId: "school-1",
      policyId: created.id,
      name: "2026/2027 Policy",
      remarks: "Revised wording"
    });

    const second = await service.createPolicy({
      actor,
      schoolId: "school-1",
      name: "2027 Policy",
      version: "2",
      ca1Weight: 25,
      ca2Weight: 25,
      examWeight: 50,
      gradeBoundaries: [
        { grade: "F", minScore: 0, maxScore: 39 },
        { grade: "P", minScore: 40, maxScore: 59 },
        { grade: "B", minScore: 60, maxScore: 79 },
        { grade: "A", minScore: 80, maxScore: 100 }
      ],
      effectiveFrom: new Date("2027-09-01T00:00:00.000Z")
    });

    const activated = await service.activatePolicy(actor, "school-1", second.id);
    const activePolicy = await service.getActivePolicy(actor, "school-1");
    const listed = await service.listPolicies({
      actor,
      schoolId: "school-1"
    });

    await expect(
      service.createPolicy({
        actor,
        schoolId: "school-1",
        name: "Duplicate Version",
        version: "1",
        ca1Weight: 20,
        ca2Weight: 30,
        examWeight: 50,
        gradeBoundaries: [
          { grade: "F", minScore: 0, maxScore: 39 },
          { grade: "A", minScore: 40, maxScore: 100 }
        ],
        effectiveFrom: new Date("2028-09-01T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "grading_policy_duplicate_version"
    });

    const archived = await service.archivePolicy(actor, "school-1", created.id);

    await expect(
      service.updatePolicy({
        actor,
        schoolId: "school-1",
        policyId: archived.id,
        name: "Should fail"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "grading_policy_lifecycle_invalid_transition"
    });

    expect(updated.name).toBe("2026/2027 Policy");
    expect(activated.status).toBe("active");
    expect(activePolicy.id).toBe(second.id);
    expect(listed[0].status).toBe("active");
    await expect(repository.findActivePolicyBySchoolId("school-1")).resolves.toBeTruthy();
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "grading_policy.created" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "grading_policy.updated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "grading_policy.activated" }));
    expect(auditSink.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: "grading_policy.archived" }));
  });

  it("rejects invalid weights and boundary definitions", async () => {
    const { service } = createService();
    const actor = createSchoolAdminActor("school-1");

    await expect(
      service.createPolicy({
        actor,
        schoolId: "school-1",
        name: "Bad Weights",
        version: "1",
        ca1Weight: 10,
        ca2Weight: 20,
        examWeight: 40,
        gradeBoundaries: [{ grade: "A", minScore: 0, maxScore: 100 }],
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "grading_policy_weights_invalid"
    });

    await expect(
      service.createPolicy({
        actor,
        schoolId: "school-1",
        name: "Gap Boundaries",
        version: "2",
        ca1Weight: 20,
        ca2Weight: 30,
        examWeight: 50,
        gradeBoundaries: [
          { grade: "C", minScore: 0, maxScore: 39 },
          { grade: "A", minScore: 41, maxScore: 100 }
        ],
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "grading_policy_boundaries_invalid"
    });
  });

  it("enforces tenant isolation and authorization", async () => {
    const { service } = createService();
    const schoolOneAdmin = createSchoolAdminActor("school-1");
    const schoolTwoAdmin = createSchoolAdminActor("school-2");
    const teacher = createTeacherActor("school-1");
    const superAdmin = createSuperAdminActor();

    const created = await service.createPolicy({
      actor: schoolOneAdmin,
      schoolId: "school-1",
      name: "School One Policy",
      version: "1",
      ca1Weight: 20,
      ca2Weight: 30,
      examWeight: 50,
      gradeBoundaries: [
        { grade: "F", minScore: 0, maxScore: 39 },
        { grade: "A", minScore: 40, maxScore: 100 }
      ],
      effectiveFrom: new Date("2026-09-01T00:00:00.000Z")
    });

    await expect(service.getPolicy(schoolTwoAdmin, "school-1", created.id)).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(service.getPolicy(teacher, "school-1", created.id)).rejects.toMatchObject({
      status: 403,
      code: "permission_denied"
    });

    await expect(
      service.getPolicy(superAdmin, "school-2", created.id)
    ).rejects.toMatchObject({
      status: 404,
      code: "grading_policy_not_found"
    });
  });

  it("supports super admin management across school boundaries", async () => {
    const { service } = createService();
    const superAdmin = createSuperAdminActor();

    const created = await service.createPolicy({
      actor: superAdmin,
      schoolId: "school-1",
      name: "Platform Policy",
      version: "1",
      ca1Weight: 20,
      ca2Weight: 30,
      examWeight: 50,
      gradeBoundaries: [
        { grade: "F", minScore: 0, maxScore: 39 },
        { grade: "A", minScore: 40, maxScore: 100 }
      ],
      effectiveFrom: new Date("2026-09-01T00:00:00.000Z")
    });

    const fetched = await service.getPolicy(superAdmin, "school-1", created.id);
    expect(fetched.id).toBe(created.id);
  });
});
