import type { ReportCardRecord } from "./report-context.js";

export interface ReportCardScope {
  readonly studentId: string;
  readonly classId: string;
  readonly academicYearId: string;
  readonly termId: string;
}

export interface ReportCardRepository {
  createReport(record: ReportCardRecord): Promise<ReportCardRecord>;
  findReportById(reportId: string): Promise<ReportCardRecord | null>;
  findReportsBySchoolId(schoolId: string): Promise<readonly ReportCardRecord[]>;
  findReportByScope(schoolId: string, scope: ReportCardScope): Promise<ReportCardRecord | null>;
  findReportsByScope(schoolId: string, scope: Partial<ReportCardScope>): Promise<readonly ReportCardRecord[]>;
  updateReport(
    reportId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        ReportCardRecord,
        | "student"
        | "class"
        | "academicYear"
        | "term"
        | "enrollment"
        | "attendanceSummary"
        | "subjectResults"
        | "subjectPositions"
        | "gradingRemarks"
        | "totalScore"
        | "average"
        | "overallPosition"
        | "teacherComments"
        | "principalComments"
        | "status"
        | "generatedAt"
        | "publishedAt"
        | "publishedBy"
        | "unpublishedAt"
        | "unpublishedBy"
      >
    > & { readonly updatedAt: Date }
  ): Promise<ReportCardRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryReportCardRepository implements ReportCardRepository {
  private readonly reports = new Map<string, ReportCardRecord>();

  public async createReport(record: ReportCardRecord): Promise<ReportCardRecord> {
    this.reports.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findReportById(reportId: string): Promise<ReportCardRecord | null> {
    const record = this.reports.get(reportId);
    return record ? cloneRecord(record) : null;
  }

  public async findReportsBySchoolId(schoolId: string): Promise<readonly ReportCardRecord[]> {
    return [...this.reports.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async findReportByScope(schoolId: string, scope: ReportCardScope): Promise<ReportCardRecord | null> {
    for (const record of this.reports.values()) {
      if (
        record.schoolId === schoolId &&
        record.studentId === scope.studentId &&
        record.classId === scope.classId &&
        record.academicYearId === scope.academicYearId &&
        record.termId === scope.termId
      ) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async findReportsByScope(schoolId: string, scope: Partial<ReportCardScope>): Promise<readonly ReportCardRecord[]> {
    return [...this.reports.values()]
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

  public async updateReport(
    reportId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        ReportCardRecord,
        | "student"
        | "class"
        | "academicYear"
        | "term"
        | "enrollment"
        | "attendanceSummary"
        | "subjectResults"
        | "subjectPositions"
        | "gradingRemarks"
        | "totalScore"
        | "average"
        | "overallPosition"
        | "teacherComments"
        | "principalComments"
        | "status"
        | "generatedAt"
        | "publishedAt"
        | "publishedBy"
        | "unpublishedAt"
        | "unpublishedBy"
      >
    > & { readonly updatedAt: Date }
  ): Promise<ReportCardRecord | null> {
    const current = this.reports.get(reportId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: ReportCardRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.reports.set(reportId, cloneRecord(next));
    return cloneRecord(next);
  }
}
