import type { GradingPolicyRecord } from "./grading-context.js";

export interface GradingRepository {
  createPolicy(record: GradingPolicyRecord): Promise<GradingPolicyRecord>;
  findPolicyById(policyId: string): Promise<GradingPolicyRecord | null>;
  findPoliciesBySchoolId(schoolId: string): Promise<readonly GradingPolicyRecord[]>;
  findPolicyBySchoolAndVersion(schoolId: string, version: string): Promise<GradingPolicyRecord | null>;
  findActivePolicyBySchoolId(schoolId: string): Promise<GradingPolicyRecord | null>;
  updatePolicy(
    policyId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        GradingPolicyRecord,
        | "name"
        | "version"
        | "ca1Weight"
        | "ca2Weight"
        | "examWeight"
        | "gradeBoundaries"
        | "remarks"
        | "status"
        | "effectiveFrom"
      >
    > & { readonly updatedAt: Date }
  ): Promise<GradingPolicyRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryGradingRepository implements GradingRepository {
  private readonly policies = new Map<string, GradingPolicyRecord>();

  public async createPolicy(record: GradingPolicyRecord): Promise<GradingPolicyRecord> {
    this.policies.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findPolicyById(policyId: string): Promise<GradingPolicyRecord | null> {
    const record = this.policies.get(policyId);
    return record ? cloneRecord(record) : null;
  }

  public async findPoliciesBySchoolId(schoolId: string): Promise<readonly GradingPolicyRecord[]> {
    return [...this.policies.values()]
      .filter((record) => record.schoolId === schoolId)
      .sort((left, right) => {
        const statusPriority: Record<GradingPolicyRecord["status"], number> = {
          active: 0,
          draft: 1,
          archived: 2
        };

        if (statusPriority[left.status] !== statusPriority[right.status]) {
          return statusPriority[left.status] - statusPriority[right.status];
        }

        if (left.effectiveFrom.getTime() !== right.effectiveFrom.getTime()) {
          return right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
        }

        return left.version.localeCompare(right.version);
      })
      .map(cloneRecord);
  }

  public async findPolicyBySchoolAndVersion(schoolId: string, version: string): Promise<GradingPolicyRecord | null> {
    for (const record of this.policies.values()) {
      if (record.schoolId === schoolId && record.version === version) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async findActivePolicyBySchoolId(schoolId: string): Promise<GradingPolicyRecord | null> {
    for (const record of this.policies.values()) {
      if (record.schoolId === schoolId && record.status === "active") {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async updatePolicy(
    policyId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        GradingPolicyRecord,
        | "name"
        | "version"
        | "ca1Weight"
        | "ca2Weight"
        | "examWeight"
        | "gradeBoundaries"
        | "remarks"
        | "status"
        | "effectiveFrom"
      >
    > & { readonly updatedAt: Date }
  ): Promise<GradingPolicyRecord | null> {
    const current = this.policies.get(policyId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: GradingPolicyRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.policies.set(policyId, cloneRecord(next));
    return cloneRecord(next);
  }
}
