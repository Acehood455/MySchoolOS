import type {
  StaffRecord,
  TeacherClassAssignmentRecord,
  TeacherSubjectAssignmentRecord
} from "./staff-context.js";

export interface StaffRepository {
  createStaff(record: StaffRecord): Promise<StaffRecord>;
  findStaffById(staffId: string): Promise<StaffRecord | null>;
  findStaffByEmployeeNumber(schoolId: string, employeeNumber: string): Promise<StaffRecord | null>;
  findStaffBySchoolId(schoolId: string): Promise<readonly StaffRecord[]>;
  updateStaff(
    staffId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        StaffRecord,
        | "employeeNumber"
        | "firstName"
        | "lastName"
        | "middleName"
        | "email"
        | "phone"
        | "gender"
        | "dateOfBirth"
        | "employmentDate"
        | "roleType"
        | "status"
        | "activatedAt"
        | "inactivatedAt"
        | "archivedAt"
        | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<StaffRecord | null>;

  createTeacherClassAssignment(record: TeacherClassAssignmentRecord): Promise<TeacherClassAssignmentRecord>;
  findTeacherClassAssignmentById(assignmentId: string): Promise<TeacherClassAssignmentRecord | null>;
  findTeacherClassAssignmentsBySchoolId(schoolId: string): Promise<readonly TeacherClassAssignmentRecord[]>;
  findTeacherClassAssignmentsByStaffId(schoolId: string, staffId: string): Promise<readonly TeacherClassAssignmentRecord[]>;
  findActiveTeacherClassAssignment(
    schoolId: string,
    staffId: string,
    classId: string
  ): Promise<TeacherClassAssignmentRecord | null>;
  updateTeacherClassAssignment(
    assignmentId: string,
    schoolId: string,
    patch: Partial<Pick<TeacherClassAssignmentRecord, "status" | "removedAt" | "removedBy" | "removalReason" | "metadata">> & {
      readonly updatedAt: Date;
    }
  ): Promise<TeacherClassAssignmentRecord | null>;

  createTeacherSubjectAssignment(record: TeacherSubjectAssignmentRecord): Promise<TeacherSubjectAssignmentRecord>;
  findTeacherSubjectAssignmentById(assignmentId: string): Promise<TeacherSubjectAssignmentRecord | null>;
  findTeacherSubjectAssignmentsBySchoolId(schoolId: string): Promise<readonly TeacherSubjectAssignmentRecord[]>;
  findTeacherSubjectAssignmentsByStaffId(schoolId: string, staffId: string): Promise<readonly TeacherSubjectAssignmentRecord[]>;
  findActiveTeacherSubjectAssignment(
    schoolId: string,
    staffId: string,
    subjectId: string
  ): Promise<TeacherSubjectAssignmentRecord | null>;
  updateTeacherSubjectAssignment(
    assignmentId: string,
    schoolId: string,
    patch: Partial<Pick<TeacherSubjectAssignmentRecord, "status" | "removedAt" | "removedBy" | "removalReason" | "metadata">> & {
      readonly updatedAt: Date;
    }
  ): Promise<TeacherSubjectAssignmentRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryStaffRepository implements StaffRepository {
  private readonly staff = new Map<string, StaffRecord>();
  private readonly teacherClassAssignments = new Map<string, TeacherClassAssignmentRecord>();
  private readonly teacherSubjectAssignments = new Map<string, TeacherSubjectAssignmentRecord>();

  public async createStaff(record: StaffRecord): Promise<StaffRecord> {
    this.staff.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findStaffById(staffId: string): Promise<StaffRecord | null> {
    const record = this.staff.get(staffId);
    return record ? cloneRecord(record) : null;
  }

  public async findStaffByEmployeeNumber(schoolId: string, employeeNumber: string): Promise<StaffRecord | null> {
    for (const record of this.staff.values()) {
      if (record.schoolId === schoolId && record.employeeNumber === employeeNumber) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async findStaffBySchoolId(schoolId: string): Promise<readonly StaffRecord[]> {
    return [...this.staff.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async updateStaff(
    staffId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        StaffRecord,
        | "employeeNumber"
        | "firstName"
        | "lastName"
        | "middleName"
        | "email"
        | "phone"
        | "gender"
        | "dateOfBirth"
        | "employmentDate"
        | "roleType"
        | "status"
        | "activatedAt"
        | "inactivatedAt"
        | "archivedAt"
        | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<StaffRecord | null> {
    const current = this.staff.get(staffId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: StaffRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.staff.set(staffId, cloneRecord(next));
    return cloneRecord(next);
  }

  public async createTeacherClassAssignment(record: TeacherClassAssignmentRecord): Promise<TeacherClassAssignmentRecord> {
    this.teacherClassAssignments.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findTeacherClassAssignmentById(assignmentId: string): Promise<TeacherClassAssignmentRecord | null> {
    const record = this.teacherClassAssignments.get(assignmentId);
    return record ? cloneRecord(record) : null;
  }

  public async findTeacherClassAssignmentsBySchoolId(schoolId: string): Promise<readonly TeacherClassAssignmentRecord[]> {
    return [...this.teacherClassAssignments.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async findTeacherClassAssignmentsByStaffId(
    schoolId: string,
    staffId: string
  ): Promise<readonly TeacherClassAssignmentRecord[]> {
    return [...this.teacherClassAssignments.values()]
      .filter((record) => record.schoolId === schoolId && record.staffId === staffId)
      .map(cloneRecord);
  }

  public async findActiveTeacherClassAssignment(
    schoolId: string,
    staffId: string,
    classId: string
  ): Promise<TeacherClassAssignmentRecord | null> {
    for (const record of this.teacherClassAssignments.values()) {
      if (record.schoolId === schoolId && record.staffId === staffId && record.classId === classId && record.status === "active") {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async updateTeacherClassAssignment(
    assignmentId: string,
    schoolId: string,
    patch: Partial<Pick<TeacherClassAssignmentRecord, "status" | "removedAt" | "removedBy" | "removalReason" | "metadata">> & {
      readonly updatedAt: Date;
    }
  ): Promise<TeacherClassAssignmentRecord | null> {
    const current = this.teacherClassAssignments.get(assignmentId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: TeacherClassAssignmentRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.teacherClassAssignments.set(assignmentId, cloneRecord(next));
    return cloneRecord(next);
  }

  public async createTeacherSubjectAssignment(record: TeacherSubjectAssignmentRecord): Promise<TeacherSubjectAssignmentRecord> {
    this.teacherSubjectAssignments.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findTeacherSubjectAssignmentById(assignmentId: string): Promise<TeacherSubjectAssignmentRecord | null> {
    const record = this.teacherSubjectAssignments.get(assignmentId);
    return record ? cloneRecord(record) : null;
  }

  public async findTeacherSubjectAssignmentsBySchoolId(schoolId: string): Promise<readonly TeacherSubjectAssignmentRecord[]> {
    return [...this.teacherSubjectAssignments.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async findTeacherSubjectAssignmentsByStaffId(
    schoolId: string,
    staffId: string
  ): Promise<readonly TeacherSubjectAssignmentRecord[]> {
    return [...this.teacherSubjectAssignments.values()]
      .filter((record) => record.schoolId === schoolId && record.staffId === staffId)
      .map(cloneRecord);
  }

  public async findActiveTeacherSubjectAssignment(
    schoolId: string,
    staffId: string,
    subjectId: string
  ): Promise<TeacherSubjectAssignmentRecord | null> {
    for (const record of this.teacherSubjectAssignments.values()) {
      if (record.schoolId === schoolId && record.staffId === staffId && record.subjectId === subjectId && record.status === "active") {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async updateTeacherSubjectAssignment(
    assignmentId: string,
    schoolId: string,
    patch: Partial<Pick<TeacherSubjectAssignmentRecord, "status" | "removedAt" | "removedBy" | "removalReason" | "metadata">> & {
      readonly updatedAt: Date;
    }
  ): Promise<TeacherSubjectAssignmentRecord | null> {
    const current = this.teacherSubjectAssignments.get(assignmentId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: TeacherSubjectAssignmentRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.teacherSubjectAssignments.set(assignmentId, cloneRecord(next));
    return cloneRecord(next);
  }
}
