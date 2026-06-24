import type { EnrollmentHistoryRecord, EnrollmentRecord } from "./enrollment-context.js";

export interface EnrollmentRepository {
  createEnrollment(record: EnrollmentRecord): Promise<EnrollmentRecord>;
  findEnrollmentById(enrollmentId: string): Promise<EnrollmentRecord | null>;
  findEnrollmentsBySchoolId(schoolId: string): Promise<readonly EnrollmentRecord[]>;
  findEnrollmentsByStudentId(schoolId: string, studentId: string): Promise<readonly EnrollmentRecord[]>;
  findEnrollmentsByClassId(schoolId: string, classId: string): Promise<readonly EnrollmentRecord[]>;
  findActiveEnrollmentByStudentAcademicYear(
    schoolId: string,
    studentId: string,
    academicYearId: string
  ): Promise<EnrollmentRecord | null>;
  updateEnrollment(
    enrollmentId: string,
    schoolId: string,
    patch: Partial<Pick<EnrollmentRecord, "academicYearId" | "classId" | "admissionDate" | "enrollmentStatus">> & {
      readonly updatedAt: Date;
    }
  ): Promise<EnrollmentRecord | null>;

  createEnrollmentHistory(record: EnrollmentHistoryRecord): Promise<EnrollmentHistoryRecord>;
  findEnrollmentHistoryByStudentId(
    schoolId: string,
    studentId: string
  ): Promise<readonly EnrollmentHistoryRecord[]>;
  findEnrollmentHistoryByClassId(schoolId: string, classId: string): Promise<readonly EnrollmentHistoryRecord[]>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryEnrollmentRepository implements EnrollmentRepository {
  private readonly enrollments = new Map<string, EnrollmentRecord>();
  private readonly history = new Map<string, EnrollmentHistoryRecord>();

  public async createEnrollment(record: EnrollmentRecord): Promise<EnrollmentRecord> {
    this.enrollments.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findEnrollmentById(enrollmentId: string): Promise<EnrollmentRecord | null> {
    const record = this.enrollments.get(enrollmentId);
    return record ? cloneRecord(record) : null;
  }

  public async findEnrollmentsBySchoolId(schoolId: string): Promise<readonly EnrollmentRecord[]> {
    return [...this.enrollments.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async findEnrollmentsByStudentId(schoolId: string, studentId: string): Promise<readonly EnrollmentRecord[]> {
    return [...this.enrollments.values()]
      .filter((record) => record.schoolId === schoolId && record.studentId === studentId)
      .map(cloneRecord);
  }

  public async findEnrollmentsByClassId(schoolId: string, classId: string): Promise<readonly EnrollmentRecord[]> {
    return [...this.enrollments.values()].filter((record) => record.schoolId === schoolId && record.classId === classId).map(cloneRecord);
  }

  public async findActiveEnrollmentByStudentAcademicYear(
    schoolId: string,
    studentId: string,
    academicYearId: string
  ): Promise<EnrollmentRecord | null> {
    for (const record of this.enrollments.values()) {
      if (
        record.schoolId === schoolId &&
        record.studentId === studentId &&
        record.academicYearId === academicYearId &&
        record.enrollmentStatus === "active"
      ) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async updateEnrollment(
    enrollmentId: string,
    schoolId: string,
    patch: Partial<Pick<EnrollmentRecord, "academicYearId" | "classId" | "admissionDate" | "enrollmentStatus">> & {
      readonly updatedAt: Date;
    }
  ): Promise<EnrollmentRecord | null> {
    const current = this.enrollments.get(enrollmentId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: EnrollmentRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.enrollments.set(enrollmentId, cloneRecord(next));
    return cloneRecord(next);
  }

  public async createEnrollmentHistory(record: EnrollmentHistoryRecord): Promise<EnrollmentHistoryRecord> {
    this.history.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findEnrollmentHistoryByStudentId(schoolId: string, studentId: string): Promise<readonly EnrollmentHistoryRecord[]> {
    return [...this.history.values()]
      .filter((record) => record.schoolId === schoolId && record.studentId === studentId)
      .map(cloneRecord);
  }

  public async findEnrollmentHistoryByClassId(schoolId: string, classId: string): Promise<readonly EnrollmentHistoryRecord[]> {
    return [...this.history.values()]
      .filter((record) => record.schoolId === schoolId && (record.classId === classId || record.fromClassId === classId || record.toClassId === classId))
      .map(cloneRecord);
  }
}

