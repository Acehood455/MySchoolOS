import type { AttendanceRecord } from "./attendance-context.js";

export interface AttendanceRepository {
  createAttendance(record: AttendanceRecord): Promise<AttendanceRecord>;
  findAttendanceById(attendanceId: string): Promise<AttendanceRecord | null>;
  findAttendanceBySchoolId(schoolId: string): Promise<readonly AttendanceRecord[]>;
  findAttendanceByEnrollmentId(schoolId: string, enrollmentId: string): Promise<readonly AttendanceRecord[]>;
  findAttendanceByClassId(schoolId: string, classId: string): Promise<readonly AttendanceRecord[]>;
  findAttendanceByDate(schoolId: string, attendanceDate: Date): Promise<readonly AttendanceRecord[]>;
  findAttendanceByEnrollmentAndDate(
    schoolId: string,
    enrollmentId: string,
    attendanceDate: Date
  ): Promise<AttendanceRecord | null>;
  updateAttendance(
    attendanceId: string,
    schoolId: string,
    patch: Partial<Pick<AttendanceRecord, "attendanceDate" | "status" | "remarks">> & { readonly updatedAt: Date }
  ): Promise<AttendanceRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryAttendanceRepository implements AttendanceRepository {
  private readonly attendance = new Map<string, AttendanceRecord>();

  public async createAttendance(record: AttendanceRecord): Promise<AttendanceRecord> {
    this.attendance.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findAttendanceById(attendanceId: string): Promise<AttendanceRecord | null> {
    const record = this.attendance.get(attendanceId);
    return record ? cloneRecord(record) : null;
  }

  public async findAttendanceBySchoolId(schoolId: string): Promise<readonly AttendanceRecord[]> {
    return [...this.attendance.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async findAttendanceByEnrollmentId(schoolId: string, enrollmentId: string): Promise<readonly AttendanceRecord[]> {
    return [...this.attendance.values()]
      .filter((record) => record.schoolId === schoolId && record.enrollmentId === enrollmentId)
      .map(cloneRecord);
  }

  public async findAttendanceByClassId(schoolId: string, classId: string): Promise<readonly AttendanceRecord[]> {
    return [...this.attendance.values()].filter((record) => record.schoolId === schoolId && record.classId === classId).map(cloneRecord);
  }

  public async findAttendanceByDate(schoolId: string, attendanceDate: Date): Promise<readonly AttendanceRecord[]> {
    const key = attendanceDate.toISOString().slice(0, 10);
    return [...this.attendance.values()]
      .filter((record) => record.schoolId === schoolId && record.attendanceDate.toISOString().slice(0, 10) === key)
      .map(cloneRecord);
  }

  public async findAttendanceByEnrollmentAndDate(
    schoolId: string,
    enrollmentId: string,
    attendanceDate: Date
  ): Promise<AttendanceRecord | null> {
    const key = attendanceDate.toISOString().slice(0, 10);

    for (const record of this.attendance.values()) {
      if (record.schoolId === schoolId && record.enrollmentId === enrollmentId && record.attendanceDate.toISOString().slice(0, 10) === key) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async updateAttendance(
    attendanceId: string,
    schoolId: string,
    patch: Partial<Pick<AttendanceRecord, "attendanceDate" | "status" | "remarks">> & { readonly updatedAt: Date }
  ): Promise<AttendanceRecord | null> {
    const current = this.attendance.get(attendanceId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: AttendanceRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.attendance.set(attendanceId, cloneRecord(next));
    return cloneRecord(next);
  }
}

