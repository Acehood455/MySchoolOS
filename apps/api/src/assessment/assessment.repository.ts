import type { AssessmentRecord } from "./assessment-context.js";

export interface AssessmentRepository {
  createAssessment(record: AssessmentRecord): Promise<AssessmentRecord>;
  findAssessmentById(assessmentId: string): Promise<AssessmentRecord | null>;
  findAssessmentsBySchoolId(schoolId: string): Promise<readonly AssessmentRecord[]>;
  findAssessmentsByClassId(schoolId: string, classId: string): Promise<readonly AssessmentRecord[]>;
  findAssessmentsByTermId(schoolId: string, termId: string): Promise<readonly AssessmentRecord[]>;
  findAssessmentsBySubjectId(schoolId: string, subjectId: string): Promise<readonly AssessmentRecord[]>;
  findAssessmentByScope(
    schoolId: string,
    input: {
      readonly academicYearId: string;
      readonly termId: string;
      readonly classId: string;
      readonly subjectId: string;
      readonly assessmentType: AssessmentRecord["assessmentType"];
    }
  ): Promise<AssessmentRecord | null>;
  updateAssessment(
    assessmentId: string,
    schoolId: string,
    patch: Partial<
      Pick<AssessmentRecord, "title" | "description" | "maxScore" | "status" | "opensAt" | "closesAt">
    > & { readonly updatedAt: Date }
  ): Promise<AssessmentRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryAssessmentRepository implements AssessmentRepository {
  private readonly assessments = new Map<string, AssessmentRecord>();

  public async createAssessment(record: AssessmentRecord): Promise<AssessmentRecord> {
    this.assessments.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findAssessmentById(assessmentId: string): Promise<AssessmentRecord | null> {
    const record = this.assessments.get(assessmentId);
    return record ? cloneRecord(record) : null;
  }

  public async findAssessmentsBySchoolId(schoolId: string): Promise<readonly AssessmentRecord[]> {
    return [...this.assessments.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async findAssessmentsByClassId(schoolId: string, classId: string): Promise<readonly AssessmentRecord[]> {
    return [...this.assessments.values()].filter((record) => record.schoolId === schoolId && record.classId === classId).map(cloneRecord);
  }

  public async findAssessmentsByTermId(schoolId: string, termId: string): Promise<readonly AssessmentRecord[]> {
    return [...this.assessments.values()].filter((record) => record.schoolId === schoolId && record.termId === termId).map(cloneRecord);
  }

  public async findAssessmentsBySubjectId(schoolId: string, subjectId: string): Promise<readonly AssessmentRecord[]> {
    return [...this.assessments.values()].filter((record) => record.schoolId === schoolId && record.subjectId === subjectId).map(cloneRecord);
  }

  public async findAssessmentByScope(
    schoolId: string,
    input: {
      readonly academicYearId: string;
      readonly termId: string;
      readonly classId: string;
      readonly subjectId: string;
      readonly assessmentType: AssessmentRecord["assessmentType"];
    }
  ): Promise<AssessmentRecord | null> {
    for (const record of this.assessments.values()) {
      if (
        record.schoolId === schoolId &&
        record.academicYearId === input.academicYearId &&
        record.termId === input.termId &&
        record.classId === input.classId &&
        record.subjectId === input.subjectId &&
        record.assessmentType === input.assessmentType
      ) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async updateAssessment(
    assessmentId: string,
    schoolId: string,
    patch: Partial<Pick<AssessmentRecord, "title" | "description" | "maxScore" | "status" | "opensAt" | "closesAt">> & {
      readonly updatedAt: Date;
    }
  ): Promise<AssessmentRecord | null> {
    const current = this.assessments.get(assessmentId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: AssessmentRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.assessments.set(assessmentId, cloneRecord(next));
    return cloneRecord(next);
  }
}
