import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type {
  GradingPolicyAuditSink,
  GradingPolicyRecord,
  GradingPolicyStatus,
  GradeBoundaryRecord
} from "./grading-context.js";
import type { GradingRepository } from "./grading.repository.js";
import type { SchoolActorContext } from "../school/school-context.js";

export interface GradingServiceOptions {
  readonly repository: GradingRepository;
  readonly auditSink?: GradingPolicyAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: (prefix: string) => string;
}

export interface CreateGradingPolicyInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly name: string;
  readonly version: string;
  readonly ca1Weight: number;
  readonly ca2Weight: number;
  readonly examWeight: number;
  readonly gradeBoundaries: readonly GradeBoundaryRecord[];
  readonly remarks?: string;
  readonly effectiveFrom: Date;
}

export interface UpdateGradingPolicyInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly policyId: string;
  readonly name?: string;
  readonly version?: string;
  readonly ca1Weight?: number;
  readonly ca2Weight?: number;
  readonly examWeight?: number;
  readonly gradeBoundaries?: readonly GradeBoundaryRecord[];
  readonly remarks?: string;
  readonly effectiveFrom?: Date;
}

export interface ListGradingPoliciesInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
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

function canManagePolicies(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
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
      resourceType: "GradingPolicy",
      resourceId,
      actorId: actor.actorId
    }
  });
}

function sortPolicies(records: readonly GradingPolicyRecord[]): GradingPolicyRecord[] {
  const statusPriority: Record<GradingPolicyStatus, number> = {
    active: 0,
    draft: 1,
    archived: 2
  };

  return [...records].sort((left, right) => {
    if (statusPriority[left.status] !== statusPriority[right.status]) {
      return statusPriority[left.status] - statusPriority[right.status];
    }

    if (left.effectiveFrom.getTime() !== right.effectiveFrom.getTime()) {
      return right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
    }

    return left.version.localeCompare(right.version);
  });
}

export class GradingService {
  public constructor(private readonly options: GradingServiceOptions) {}

  public async createPolicy(input: CreateGradingPolicyInput): Promise<GradingPolicyRecord> {
    this.assertActorCanManagePolicies(input.actor, input.schoolId);
    this.assertWeightsTotal(input.ca1Weight, input.ca2Weight, input.examWeight);
    this.assertGradeBoundaries(input.gradeBoundaries);
    await this.assertVersionIsUnique(input.schoolId, input.version);

    const now = this.clock();
    const record: GradingPolicyRecord = {
      id: this.idFactory("grading_policy"),
      schoolId: input.schoolId,
      name: input.name.trim(),
      version: this.normalizeVersion(input.version),
      ca1Weight: input.ca1Weight,
      ca2Weight: input.ca2Weight,
      examWeight: input.examWeight,
      gradeBoundaries: cloneRecord(input.gradeBoundaries),
      remarks: input.remarks?.trim() || undefined,
      status: "draft",
      effectiveFrom: cloneRecord(input.effectiveFrom),
      createdAt: now,
      updatedAt: now
    };

    const created = await this.options.repository.createPolicy(record);

    await this.audit({
      eventName: "grading_policy.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "GradingPolicy",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        version: created.version,
        status: created.status
      }
    });

    return created;
  }

  public async updatePolicy(input: UpdateGradingPolicyInput): Promise<GradingPolicyRecord> {
    const current = await this.mustFindPolicy(input.schoolId, input.policyId);
    this.assertActorCanManagePolicies(input.actor, input.schoolId);

    if (current.status !== "draft") {
      throw new AppError("Grading policy cannot transition from the current state", {
        status: 409,
        code: "grading_policy_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "draft"
        }
      });
    }

    const nextVersion = input.version !== undefined ? this.normalizeVersion(input.version) : current.version;
    const nextName = input.name?.trim() ?? current.name;
    const nextCa1Weight = input.ca1Weight ?? current.ca1Weight;
    const nextCa2Weight = input.ca2Weight ?? current.ca2Weight;
    const nextExamWeight = input.examWeight ?? current.examWeight;
    const nextGradeBoundaries = input.gradeBoundaries ? cloneRecord(input.gradeBoundaries) : current.gradeBoundaries;
    const nextRemarks = input.remarks !== undefined ? input.remarks.trim() || undefined : current.remarks;
    const nextEffectiveFrom = input.effectiveFrom ? cloneRecord(input.effectiveFrom) : current.effectiveFrom;

    this.assertWeightsTotal(nextCa1Weight, nextCa2Weight, nextExamWeight);
    this.assertGradeBoundaries(nextGradeBoundaries);

    if (nextVersion !== current.version) {
      await this.assertVersionIsUnique(input.schoolId, nextVersion, current.id);
    }

    const updated = await this.options.repository.updatePolicy(input.policyId, input.schoolId, {
      name: nextName,
      version: nextVersion,
      ca1Weight: nextCa1Weight,
      ca2Weight: nextCa2Weight,
      examWeight: nextExamWeight,
      gradeBoundaries: nextGradeBoundaries,
      remarks: nextRemarks,
      effectiveFrom: nextEffectiveFrom,
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("Grading policy not found", {
        status: 404,
        code: "grading_policy_not_found"
      });
    }

    await this.audit({
      eventName: "grading_policy.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "GradingPolicy",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        version: updated.version,
        status: updated.status
      }
    });

    return updated;
  }

  public async activatePolicy(actor: SchoolActorContext, schoolId: string, policyId: string): Promise<GradingPolicyRecord> {
    this.assertActorCanManagePolicies(actor, schoolId);
    const current = await this.mustFindPolicy(schoolId, policyId);

    if (current.status === "archived") {
      throw new AppError("Grading policy cannot transition from the current state", {
        status: 409,
        code: "grading_policy_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "active"
        }
      });
    }

    if (current.status === "active") {
      throw new AppError("Grading policy is already active", {
        status: 409,
        code: "grading_policy_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "active"
        }
      });
    }

    const existingActive = await this.options.repository.findActivePolicyBySchoolId(schoolId);

    if (existingActive && existingActive.id !== current.id) {
      const deactivated = await this.options.repository.updatePolicy(existingActive.id, schoolId, {
        status: "draft",
        updatedAt: this.clock()
      });

      if (!deactivated) {
        throw new AppError("Active grading policy not found", {
          status: 404,
          code: "grading_policy_not_found"
        });
      }
    }

    const activated = await this.options.repository.updatePolicy(policyId, schoolId, {
      status: "active",
      updatedAt: this.clock()
    });

    if (!activated) {
      throw new AppError("Grading policy not found", {
        status: 404,
        code: "grading_policy_not_found"
      });
    }

    await this.audit({
      eventName: "grading_policy.activated",
      actorId: actor.actorId,
      schoolId,
      resourceType: "GradingPolicy",
      resourceId: activated.id,
      outcome: "success",
      metadata: {
        version: activated.version,
        status: activated.status
      }
    });

    return activated;
  }

  public async archivePolicy(actor: SchoolActorContext, schoolId: string, policyId: string): Promise<GradingPolicyRecord> {
    this.assertActorCanManagePolicies(actor, schoolId);
    const current = await this.mustFindPolicy(schoolId, policyId);

    if (current.status === "archived") {
      throw new AppError("Grading policy cannot transition from the current state", {
        status: 409,
        code: "grading_policy_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "archived"
        }
      });
    }

    const archived = await this.options.repository.updatePolicy(policyId, schoolId, {
      status: "archived",
      updatedAt: this.clock()
    });

    if (!archived) {
      throw new AppError("Grading policy not found", {
        status: 404,
        code: "grading_policy_not_found"
      });
    }

    await this.audit({
      eventName: "grading_policy.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "GradingPolicy",
      resourceId: archived.id,
      outcome: "success",
      metadata: {
        version: archived.version,
        status: archived.status
      }
    });

    return archived;
  }

  public async getPolicy(actor: SchoolActorContext, schoolId: string, policyId: string): Promise<GradingPolicyRecord> {
    this.assertActorCanManagePolicies(actor, schoolId);
    return this.mustFindPolicy(schoolId, policyId);
  }

  public async listPolicies(input: ListGradingPoliciesInput): Promise<readonly GradingPolicyRecord[]> {
    this.assertActorCanManagePolicies(input.actor, input.schoolId);
    const policies = await this.options.repository.findPoliciesBySchoolId(input.schoolId);
    return sortPolicies(policies);
  }

  public async getActivePolicy(actor: SchoolActorContext, schoolId: string): Promise<GradingPolicyRecord> {
    this.assertActorCanManagePolicies(actor, schoolId);
    const active = await this.options.repository.findActivePolicyBySchoolId(schoolId);

    if (!active) {
      throw new AppError("Grading policy not found", {
        status: 404,
        code: "grading_policy_not_found"
      });
    }

    return active;
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(prefix: string): string {
    return this.options.idFactory?.(prefix) ?? defaultIdFactory(prefix);
  }

  private async audit(event: Parameters<NonNullable<GradingPolicyAuditSink["record"]>>[0]): Promise<void> {
    if (!this.options.auditSink) {
      return;
    }

    await this.options.auditSink.record(event);
  }

  private assertActorCanManagePolicies(actor: SchoolActorContext, schoolId: string): void {
    requirePermission(actor, canManagePolicies(actor, schoolId), "grading_policy.access", schoolId);
  }

  private assertWeightsTotal(ca1Weight: number, ca2Weight: number, examWeight: number): void {
    const total = Math.round((ca1Weight + ca2Weight + examWeight) * 1000) / 1000;

    if (total !== 100) {
      throw new AppError("Weights must total exactly 100", {
        status: 400,
        code: "grading_policy_weights_invalid",
        details: {
          total
        }
      });
    }
  }

  private assertGradeBoundaries(boundaries: readonly GradeBoundaryRecord[]): void {
    if (boundaries.length === 0) {
      throw new AppError("gradeBoundaries must contain at least one range", {
        status: 400,
        code: "grading_policy_boundaries_invalid"
      });
    }

    const sorted = [...boundaries].sort((left, right) => left.minScore - right.minScore || left.maxScore - right.maxScore);
    const seenGrades = new Set<string>();
    let expectedMin = 0;

    for (const [index, boundary] of sorted.entries()) {
      if (seenGrades.has(boundary.grade)) {
        throw new AppError("Duplicate grade labels are not allowed", {
          status: 400,
          code: "grading_policy_boundaries_invalid",
          details: {
            index,
            grade: boundary.grade
          }
        });
      }
      seenGrades.add(boundary.grade);

      if (!Number.isInteger(boundary.minScore) || !Number.isInteger(boundary.maxScore) || boundary.minScore < 0 || boundary.maxScore > 100 || boundary.minScore > boundary.maxScore) {
        throw new AppError("Invalid grade boundary score range", {
          status: 400,
          code: "grading_policy_boundaries_invalid",
          details: {
            index,
            minScore: boundary.minScore,
            maxScore: boundary.maxScore
          }
        });
      }

      if (boundary.minScore !== expectedMin) {
        throw new AppError("gradeBoundaries must cover 0-100 without gaps", {
          status: 400,
          code: "grading_policy_boundaries_invalid",
          details: {
            index,
            expectedMin
          }
        });
      }

      if (index > 0) {
        const previous = sorted[index - 1]!;

        if (boundary.minScore <= previous.maxScore) {
          throw new AppError("gradeBoundaries cannot overlap", {
            status: 400,
            code: "grading_policy_boundaries_invalid",
            details: {
              index,
              previousMaxScore: previous.maxScore
            }
          });
        }
      }

      expectedMin = boundary.maxScore + 1;
    }

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!first || !last) {
      throw new AppError("gradeBoundaries must cover 0-100 without gaps", {
        status: 400,
        code: "grading_policy_boundaries_invalid"
      });
    }

    if (first.minScore !== 0 || last.maxScore !== 100) {
      throw new AppError("gradeBoundaries must cover 0-100 without gaps", {
        status: 400,
        code: "grading_policy_boundaries_invalid"
      });
    }
  }

  private async assertVersionIsUnique(schoolId: string, version: string, ignorePolicyId?: string): Promise<void> {
    const existing = await this.options.repository.findPolicyBySchoolAndVersion(schoolId, this.normalizeVersion(version));

    if (existing && existing.id !== ignorePolicyId) {
      throw new AppError("Version already exists for this school", {
        status: 409,
        code: "grading_policy_duplicate_version",
        details: {
          version: existing.version
        }
      });
    }
  }

  private normalizeVersion(version: string): string {
    return version.trim();
  }

  private async mustFindPolicy(schoolId: string, policyId: string): Promise<GradingPolicyRecord> {
    const policy = await this.options.repository.findPolicyById(policyId);

    if (!policy || policy.schoolId !== schoolId) {
      throw new AppError("Grading policy not found", {
        status: 404,
        code: "grading_policy_not_found"
      });
    }

    return policy;
  }
}
