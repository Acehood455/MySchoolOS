import type { ScoreRecord } from "./score-context.js";

export interface ScoreRepository {
  createScore(record: ScoreRecord): Promise<ScoreRecord>;
  findScoreById(scoreId: string): Promise<ScoreRecord | null>;
  findScoresBySchoolId(schoolId: string): Promise<readonly ScoreRecord[]>;
  findScoresByAssessmentId(schoolId: string, assessmentId: string): Promise<readonly ScoreRecord[]>;
  findScoresByStudentId(schoolId: string, studentId: string): Promise<readonly ScoreRecord[]>;
  findScoreByAssessmentAndStudent(schoolId: string, assessmentId: string, studentId: string): Promise<ScoreRecord | null>;
  updateScore(
    scoreId: string,
    schoolId: string,
    patch: Partial<Pick<ScoreRecord, "score" | "submittedBy" | "submittedAt">> & { readonly updatedAt: Date }
  ): Promise<ScoreRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryScoreRepository implements ScoreRepository {
  private readonly scores = new Map<string, ScoreRecord>();

  public async createScore(record: ScoreRecord): Promise<ScoreRecord> {
    this.scores.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findScoreById(scoreId: string): Promise<ScoreRecord | null> {
    const record = this.scores.get(scoreId);
    return record ? cloneRecord(record) : null;
  }

  public async findScoresBySchoolId(schoolId: string): Promise<readonly ScoreRecord[]> {
    return [...this.scores.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async findScoresByAssessmentId(schoolId: string, assessmentId: string): Promise<readonly ScoreRecord[]> {
    return [...this.scores.values()].filter((record) => record.schoolId === schoolId && record.assessmentId === assessmentId).map(cloneRecord);
  }

  public async findScoresByStudentId(schoolId: string, studentId: string): Promise<readonly ScoreRecord[]> {
    return [...this.scores.values()].filter((record) => record.schoolId === schoolId && record.studentId === studentId).map(cloneRecord);
  }

  public async findScoreByAssessmentAndStudent(
    schoolId: string,
    assessmentId: string,
    studentId: string
  ): Promise<ScoreRecord | null> {
    for (const record of this.scores.values()) {
      if (record.schoolId === schoolId && record.assessmentId === assessmentId && record.studentId === studentId) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async updateScore(
    scoreId: string,
    schoolId: string,
    patch: Partial<Pick<ScoreRecord, "score" | "submittedBy" | "submittedAt">> & { readonly updatedAt: Date }
  ): Promise<ScoreRecord | null> {
    const current = this.scores.get(scoreId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: ScoreRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.scores.set(scoreId, cloneRecord(next));
    return cloneRecord(next);
  }
}
