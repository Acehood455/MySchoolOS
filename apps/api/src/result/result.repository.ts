import type { ResultRecord } from "./result-context.js";

export interface ResultScope {
  readonly studentId?: string;
  readonly classId?: string;
  readonly subjectId?: string;
  readonly academicYearId?: string;
  readonly termId?: string;
}

export interface ResultRepository {
  createResult(record: ResultRecord): Promise<ResultRecord>;
  findResultById(resultId: string): Promise<ResultRecord | null>;
  findResultsBySchoolId(schoolId: string): Promise<readonly ResultRecord[]>;
  findResultsByScope(schoolId: string, scope: ResultScope): Promise<readonly ResultRecord[]>;
  findResultByScope(schoolId: string, scope: Required<ResultScope>): Promise<ResultRecord | null>;
  updateResult(
    resultId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        ResultRecord,
        | "gradingPolicyId"
        | "ca1Score"
        | "ca2Score"
        | "examScore"
        | "continuousAssessmentTotal"
        | "finalScore"
        | "grade"
        | "remark"
        | "status"
        | "computedAt"
      >
    > & { readonly updatedAt: Date }
  ): Promise<ResultRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryResultRepository implements ResultRepository {
  private readonly results = new Map<string, ResultRecord>();

  public async createResult(record: ResultRecord): Promise<ResultRecord> {
    this.results.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findResultById(resultId: string): Promise<ResultRecord | null> {
    const record = this.results.get(resultId);
    return record ? cloneRecord(record) : null;
  }

  public async findResultsBySchoolId(schoolId: string): Promise<readonly ResultRecord[]> {
    return [...this.results.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async findResultsByScope(schoolId: string, scope: ResultScope): Promise<readonly ResultRecord[]> {
    return [...this.results.values()]
      .filter((record) => {
        if (record.schoolId !== schoolId) {
          return false;
        }

        if (scope.studentId && record.studentId !== scope.studentId) {
          return false;
        }

        if (scope.classId && record.classId !== scope.classId) {
          return false;
        }

        if (scope.subjectId && record.subjectId !== scope.subjectId) {
          return false;
        }

        if (scope.academicYearId && record.academicYearId !== scope.academicYearId) {
          return false;
        }

        if (scope.termId && record.termId !== scope.termId) {
          return false;
        }

        return true;
      })
      .map(cloneRecord);
  }

  public async findResultByScope(schoolId: string, scope: Required<ResultScope>): Promise<ResultRecord | null> {
    for (const record of this.results.values()) {
      if (
        record.schoolId === schoolId &&
        record.studentId === scope.studentId &&
        record.classId === scope.classId &&
        record.subjectId === scope.subjectId &&
        record.academicYearId === scope.academicYearId &&
        record.termId === scope.termId
      ) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async updateResult(
    resultId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        ResultRecord,
        | "gradingPolicyId"
        | "ca1Score"
        | "ca2Score"
        | "examScore"
        | "continuousAssessmentTotal"
        | "finalScore"
        | "grade"
        | "remark"
        | "status"
        | "computedAt"
      >
    > & { readonly updatedAt: Date }
  ): Promise<ResultRecord | null> {
    const current = this.results.get(resultId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: ResultRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.results.set(resultId, cloneRecord(next));
    return cloneRecord(next);
  }
}
