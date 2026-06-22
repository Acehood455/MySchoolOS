import type {
  AcademicYearRecord,
  ClassRecord,
  SubjectRecord,
  TermRecord
} from "./academic-context.js";

export interface AcademicRepository {
  createAcademicYear(record: AcademicYearRecord): Promise<AcademicYearRecord>;
  findAcademicYearById(academicYearId: string): Promise<AcademicYearRecord | null>;
  findAcademicYearsBySchoolId(schoolId: string): Promise<readonly AcademicYearRecord[]>;
  findOpenAcademicYearBySchoolId(schoolId: string): Promise<AcademicYearRecord | null>;
  updateAcademicYear(
    academicYearId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        AcademicYearRecord,
        "name" | "code" | "startDate" | "endDate" | "status" | "openedAt" | "closedAt" | "archivedAt" | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<AcademicYearRecord | null>;

  createTerm(record: TermRecord): Promise<TermRecord>;
  findTermById(termId: string): Promise<TermRecord | null>;
  findTermsBySchoolId(schoolId: string): Promise<readonly TermRecord[]>;
  findTermsByAcademicYearId(academicYearId: string): Promise<readonly TermRecord[]>;
  findOpenTermBySchoolId(schoolId: string): Promise<TermRecord | null>;
  updateTerm(
    termId: string,
    schoolId: string,
    patch: Partial<
      Pick<TermRecord, "name" | "code" | "startDate" | "endDate" | "status" | "openedAt" | "closedAt" | "archivedAt" | "metadata">
    > & { readonly updatedAt: Date }
  ): Promise<TermRecord | null>;

  createClass(record: ClassRecord): Promise<ClassRecord>;
  findClassById(classId: string): Promise<ClassRecord | null>;
  findClassesBySchoolId(schoolId: string): Promise<readonly ClassRecord[]>;
  findClassesByAcademicYearId(academicYearId: string): Promise<readonly ClassRecord[]>;
  updateClass(
    classId: string,
    schoolId: string,
    patch: Partial<Pick<ClassRecord, "name" | "code" | "status" | "archivedAt" | "metadata">> & {
      readonly updatedAt: Date;
    }
  ): Promise<ClassRecord | null>;

  createSubject(record: SubjectRecord): Promise<SubjectRecord>;
  findSubjectById(subjectId: string): Promise<SubjectRecord | null>;
  findSubjectsBySchoolId(schoolId: string): Promise<readonly SubjectRecord[]>;
  updateSubject(
    subjectId: string,
    schoolId: string,
    patch: Partial<Pick<SubjectRecord, "name" | "code" | "status" | "archivedAt" | "metadata">> & {
      readonly updatedAt: Date;
    }
  ): Promise<SubjectRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

function cloneAcademicYear(record: AcademicYearRecord): AcademicYearRecord {
  return cloneRecord(record);
}

function cloneTerm(record: TermRecord): TermRecord {
  return cloneRecord(record);
}

function cloneClass(record: ClassRecord): ClassRecord {
  return cloneRecord(record);
}

function cloneSubject(record: SubjectRecord): SubjectRecord {
  return cloneRecord(record);
}

export class InMemoryAcademicRepository implements AcademicRepository {
  private readonly academicYears = new Map<string, AcademicYearRecord>();
  private readonly terms = new Map<string, TermRecord>();
  private readonly classes = new Map<string, ClassRecord>();
  private readonly subjects = new Map<string, SubjectRecord>();

  public async createAcademicYear(record: AcademicYearRecord): Promise<AcademicYearRecord> {
    this.academicYears.set(record.id, cloneAcademicYear(record));
    return cloneAcademicYear(record);
  }

  public async findAcademicYearById(academicYearId: string): Promise<AcademicYearRecord | null> {
    const record = this.academicYears.get(academicYearId);
    return record ? cloneAcademicYear(record) : null;
  }

  public async findAcademicYearsBySchoolId(schoolId: string): Promise<readonly AcademicYearRecord[]> {
    return [...this.academicYears.values()].filter((record) => record.schoolId === schoolId).map(cloneAcademicYear);
  }

  public async findOpenAcademicYearBySchoolId(schoolId: string): Promise<AcademicYearRecord | null> {
    for (const record of this.academicYears.values()) {
      if (record.schoolId === schoolId && record.status === "open") {
        return cloneAcademicYear(record);
      }
    }

    return null;
  }

  public async updateAcademicYear(
    academicYearId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        AcademicYearRecord,
        "name" | "code" | "startDate" | "endDate" | "status" | "openedAt" | "closedAt" | "archivedAt" | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<AcademicYearRecord | null> {
    const current = this.academicYears.get(academicYearId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: AcademicYearRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.academicYears.set(academicYearId, cloneAcademicYear(next));
    return cloneAcademicYear(next);
  }

  public async createTerm(record: TermRecord): Promise<TermRecord> {
    this.terms.set(record.id, cloneTerm(record));
    return cloneTerm(record);
  }

  public async findTermById(termId: string): Promise<TermRecord | null> {
    const record = this.terms.get(termId);
    return record ? cloneTerm(record) : null;
  }

  public async findTermsBySchoolId(schoolId: string): Promise<readonly TermRecord[]> {
    return [...this.terms.values()].filter((record) => record.schoolId === schoolId).map(cloneTerm);
  }

  public async findTermsByAcademicYearId(academicYearId: string): Promise<readonly TermRecord[]> {
    return [...this.terms.values()].filter((record) => record.academicYearId === academicYearId).map(cloneTerm);
  }

  public async findOpenTermBySchoolId(schoolId: string): Promise<TermRecord | null> {
    for (const record of this.terms.values()) {
      if (record.schoolId === schoolId && record.status === "open") {
        return cloneTerm(record);
      }
    }

    return null;
  }

  public async updateTerm(
    termId: string,
    schoolId: string,
    patch: Partial<
      Pick<TermRecord, "name" | "code" | "startDate" | "endDate" | "status" | "openedAt" | "closedAt" | "archivedAt" | "metadata">
    > & { readonly updatedAt: Date }
  ): Promise<TermRecord | null> {
    const current = this.terms.get(termId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: TermRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.terms.set(termId, cloneTerm(next));
    return cloneTerm(next);
  }

  public async createClass(record: ClassRecord): Promise<ClassRecord> {
    this.classes.set(record.id, cloneClass(record));
    return cloneClass(record);
  }

  public async findClassById(classId: string): Promise<ClassRecord | null> {
    const record = this.classes.get(classId);
    return record ? cloneClass(record) : null;
  }

  public async findClassesBySchoolId(schoolId: string): Promise<readonly ClassRecord[]> {
    return [...this.classes.values()].filter((record) => record.schoolId === schoolId).map(cloneClass);
  }

  public async findClassesByAcademicYearId(academicYearId: string): Promise<readonly ClassRecord[]> {
    return [...this.classes.values()].filter((record) => record.academicYearId === academicYearId).map(cloneClass);
  }

  public async updateClass(
    classId: string,
    schoolId: string,
    patch: Partial<Pick<ClassRecord, "name" | "code" | "status" | "archivedAt" | "metadata">> & {
      readonly updatedAt: Date;
    }
  ): Promise<ClassRecord | null> {
    const current = this.classes.get(classId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: ClassRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.classes.set(classId, cloneClass(next));
    return cloneClass(next);
  }

  public async createSubject(record: SubjectRecord): Promise<SubjectRecord> {
    this.subjects.set(record.id, cloneSubject(record));
    return cloneSubject(record);
  }

  public async findSubjectById(subjectId: string): Promise<SubjectRecord | null> {
    const record = this.subjects.get(subjectId);
    return record ? cloneSubject(record) : null;
  }

  public async findSubjectsBySchoolId(schoolId: string): Promise<readonly SubjectRecord[]> {
    return [...this.subjects.values()].filter((record) => record.schoolId === schoolId).map(cloneSubject);
  }

  public async updateSubject(
    subjectId: string,
    schoolId: string,
    patch: Partial<Pick<SubjectRecord, "name" | "code" | "status" | "archivedAt" | "metadata">> & {
      readonly updatedAt: Date;
    }
  ): Promise<SubjectRecord | null> {
    const current = this.subjects.get(subjectId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: SubjectRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.subjects.set(subjectId, cloneSubject(next));
    return cloneSubject(next);
  }
}
