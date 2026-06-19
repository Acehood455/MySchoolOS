import { describe, expect, it, vi } from "vitest";
import { createSecurityAuditEmitters } from "./audit.emitters.js";
import { InMemoryAuditPersistence } from "./audit.persistence.js";
import { AuditService } from "./audit.service.js";

describe("AuditService", () => {
  it("persists append-only immutable records with actor and tenant context", async () => {
    const persistence = new InMemoryAuditPersistence();
    const service = new AuditService({
      persistence,
      clock: () => new Date("2026-06-19T00:00:00.000Z"),
      idFactory: () => "audit-1"
    });

    const record = await service.record({
      eventName: "auth.login.succeeded",
      actorType: "user",
      actorId: "user-1",
      schoolId: "school-123",
      resourceType: "Session",
      resourceId: "session-1",
      severity: "low",
      outcome: "success",
      metadata: {
        source: "auth"
      }
    });

    expect(record).toMatchObject({
      id: "audit-1",
      eventName: "auth.login.succeeded",
      actorType: "user",
      actorId: "user-1",
      schoolId: "school-123",
      resourceType: "Session",
      resourceId: "session-1",
      severity: "low",
      outcome: "success",
      createdAt: "2026-06-19T00:00:00.000Z"
    });
    expect(Object.isFrozen(record)).toBe(true);

    const stored = await service.list({ schoolId: "school-123" });

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      eventName: "auth.login.succeeded",
      actorId: "user-1",
      schoolId: "school-123"
    });
    expect(Object.isFrozen(stored[0])).toBe(true);

    await expect(
      service.record({
        eventName: "permission.denied",
        actorType: "system",
        schoolId: "school-123",
        resourceType: "ProtectedRoute",
        resourceId: "/admin",
        severity: "medium",
        outcome: "failure",
        reason: "forbidden"
      })
    ).resolves.toMatchObject({
      outcome: "failure",
      reason: "forbidden"
    });
  });

  it("captures failure events through emitters", async () => {
    const persistence = new InMemoryAuditPersistence();
    const service = new AuditService({
      persistence,
      clock: () => new Date("2026-06-19T00:00:00.000Z"),
      idFactory: () => "audit-1"
    });
    const emitters = createSecurityAuditEmitters(service);

    await emitters.authorization.permissionDenied({
      actorType: "user",
      actorId: "user-1",
      schoolId: "school-123",
      resourceType: "Classroom",
      resourceId: "class-1",
      reason: "forbidden",
      metadata: {
        permission: "school.manage",
        route: "/classrooms"
      }
    });

    const records = await service.list({ eventName: "permission.denied" });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      eventName: "permission.denied",
      actorType: "user",
      actorId: "user-1",
      schoolId: "school-123",
      resourceType: "Classroom",
      resourceId: "class-1",
      severity: "medium",
      outcome: "failure",
      reason: "forbidden"
    });
  });

  it("supports tenant-scoped failure events for resolution issues", async () => {
    const persistence = new InMemoryAuditPersistence();
    const service = new AuditService({
      persistence,
      clock: () => new Date("2026-06-19T00:00:00.000Z"),
      idFactory: () => "audit-1"
    });
    const emitters = createSecurityAuditEmitters(service);

    await emitters.tenant.resolutionConflict({
      actorType: "system",
      schoolId: "school-123",
      resourceType: "SchoolDomain",
      resourceId: "alpha.example.com",
      reason: "conflict",
      metadata: {
        candidateCount: 2
      }
    });

    const records = await service.list({ schoolId: "school-123" });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      eventName: "tenant.resolution.conflict",
      actorType: "system",
      schoolId: "school-123",
      outcome: "failure"
    });
  });
});
