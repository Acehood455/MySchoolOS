import type { ParentRecord, ParentStudentLinkRecord } from "./parent-context.js";

export interface ParentRepository {
  createParent(record: ParentRecord): Promise<ParentRecord>;
  findParentById(parentId: string): Promise<ParentRecord | null>;
  findParentByEmail(schoolId: string, email: string): Promise<ParentRecord | null>;
  findParentsBySchoolId(schoolId: string): Promise<readonly ParentRecord[]>;
  updateParent(
    parentId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        ParentRecord,
        | "firstName"
        | "lastName"
        | "middleName"
        | "email"
        | "phone"
        | "address"
        | "occupation"
        | "relationshipType"
        | "status"
      >
    > & { readonly updatedAt: Date }
  ): Promise<ParentRecord | null>;

  createParentStudentLink(record: ParentStudentLinkRecord): Promise<ParentStudentLinkRecord>;
  findParentStudentLinkById(linkId: string): Promise<ParentStudentLinkRecord | null>;
  findActiveParentStudentLink(schoolId: string, parentId: string, studentId: string): Promise<ParentStudentLinkRecord | null>;
  findParentStudentLinksByParentId(schoolId: string, parentId: string): Promise<readonly ParentStudentLinkRecord[]>;
  findParentStudentLinksByStudentId(schoolId: string, studentId: string): Promise<readonly ParentStudentLinkRecord[]>;
  updateParentStudentLink(
    linkId: string,
    schoolId: string,
    patch: Partial<Pick<ParentStudentLinkRecord, "status" | "unlinkedAt" | "unlinkedBy">> & { readonly updatedAt: Date }
  ): Promise<ParentStudentLinkRecord | null>;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class InMemoryParentRepository implements ParentRepository {
  private readonly parents = new Map<string, ParentRecord>();
  private readonly links = new Map<string, ParentStudentLinkRecord>();

  public async createParent(record: ParentRecord): Promise<ParentRecord> {
    this.parents.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findParentById(parentId: string): Promise<ParentRecord | null> {
    const record = this.parents.get(parentId);
    return record ? cloneRecord(record) : null;
  }

  public async findParentByEmail(schoolId: string, email: string): Promise<ParentRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();

    for (const record of this.parents.values()) {
      if (record.schoolId === schoolId && record.email?.trim().toLowerCase() === normalizedEmail) {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async findParentsBySchoolId(schoolId: string): Promise<readonly ParentRecord[]> {
    return [...this.parents.values()].filter((record) => record.schoolId === schoolId).map(cloneRecord);
  }

  public async updateParent(
    parentId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        ParentRecord,
        | "firstName"
        | "lastName"
        | "middleName"
        | "email"
        | "phone"
        | "address"
        | "occupation"
        | "relationshipType"
        | "status"
      >
    > & { readonly updatedAt: Date }
  ): Promise<ParentRecord | null> {
    const current = this.parents.get(parentId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: ParentRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.parents.set(parentId, cloneRecord(next));
    return cloneRecord(next);
  }

  public async createParentStudentLink(record: ParentStudentLinkRecord): Promise<ParentStudentLinkRecord> {
    this.links.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  public async findParentStudentLinkById(linkId: string): Promise<ParentStudentLinkRecord | null> {
    const record = this.links.get(linkId);
    return record ? cloneRecord(record) : null;
  }

  public async findActiveParentStudentLink(schoolId: string, parentId: string, studentId: string): Promise<ParentStudentLinkRecord | null> {
    for (const record of this.links.values()) {
      if (record.schoolId === schoolId && record.parentId === parentId && record.studentId === studentId && record.status === "active") {
        return cloneRecord(record);
      }
    }

    return null;
  }

  public async findParentStudentLinksByParentId(schoolId: string, parentId: string): Promise<readonly ParentStudentLinkRecord[]> {
    return [...this.links.values()].filter((record) => record.schoolId === schoolId && record.parentId === parentId).map(cloneRecord);
  }

  public async findParentStudentLinksByStudentId(schoolId: string, studentId: string): Promise<readonly ParentStudentLinkRecord[]> {
    return [...this.links.values()].filter((record) => record.schoolId === schoolId && record.studentId === studentId).map(cloneRecord);
  }

  public async updateParentStudentLink(
    linkId: string,
    schoolId: string,
    patch: Partial<Pick<ParentStudentLinkRecord, "status" | "unlinkedAt" | "unlinkedBy">> & { readonly updatedAt: Date }
  ): Promise<ParentStudentLinkRecord | null> {
    const current = this.links.get(linkId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    const next: ParentStudentLinkRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.links.set(linkId, cloneRecord(next));
    return cloneRecord(next);
  }
}

