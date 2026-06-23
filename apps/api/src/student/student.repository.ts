import type { StudentRecord, StudentStatus } from "./student-context.js";

export interface StudentRepository {
  createStudent(record: StudentRecord): Promise<StudentRecord>;
  findStudentById(studentId: string): Promise<StudentRecord | null>;
  findStudentByAdmissionNumber(schoolId: string, admissionNumber: string): Promise<StudentRecord | null>;
  findStudentsBySchoolId(schoolId: string): Promise<readonly StudentRecord[]>;
  updateStudent(
    studentId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        StudentRecord,
        | "admissionNumber"
        | "firstName"
        | "lastName"
        | "middleName"
        | "gender"
        | "dateOfBirth"
        | "admissionDate"
        | "status"
        | "contactInformation"
        | "address"
        | "profilePhotoReference"
        | "activatedAt"
        | "inactivatedAt"
        | "graduatedAt"
        | "withdrawnAt"
        | "archivedAt"
        | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<StudentRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryStudentRepository implements StudentRepository {
  private readonly students = new Map<string, StudentRecord>();

  public async createStudent(record: StudentRecord): Promise<StudentRecord> {
    this.students.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findStudentById(studentId: string): Promise<StudentRecord | null> {
    const record = this.students.get(studentId);
    return record ? cloneRecord(record) : null;
  }

  public async findStudentByAdmissionNumber(schoolId: string, admissionNumber: string): Promise<StudentRecord | null> {
    for (const record of this.students.values()) {
      if (record.schoolId === schoolId && record.admissionNumber === admissionNumber) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async findStudentsBySchoolId(schoolId: string): Promise<readonly StudentRecord[]> {
    return [...this.students.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async updateStudent(
    studentId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        StudentRecord,
        | "admissionNumber"
        | "firstName"
        | "lastName"
        | "middleName"
        | "gender"
        | "dateOfBirth"
        | "admissionDate"
        | "status"
        | "contactInformation"
        | "address"
        | "profilePhotoReference"
        | "activatedAt"
        | "inactivatedAt"
        | "graduatedAt"
        | "withdrawnAt"
        | "archivedAt"
        | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<StudentRecord | null> {
    const current = this.students.get(studentId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: StudentRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.students.set(studentId, cloneRecord(next));
    return cloneRecord(next);
  }
}
