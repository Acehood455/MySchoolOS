import type { AuditQuery, AuditRecord } from "@myschoolos/shared";

export interface AuditPersistence {
  append(record: AuditRecord): Promise<AuditRecord>;
  list(query?: AuditQuery): Promise<readonly AuditRecord[]>;
}

function cloneRecord(record: AuditRecord): AuditRecord {
  return {
    ...record,
    beforeState: record.beforeState ? { ...record.beforeState } : undefined,
    afterState: record.afterState ? { ...record.afterState } : undefined,
    metadata: record.metadata ? { ...record.metadata } : undefined
  };
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    const entry = (value as Record<string, unknown>)[key];

    if (entry && typeof entry === "object") {
      deepFreeze(entry);
    }
  }

  return Object.freeze(value);
}

function freezeRecord(record: AuditRecord): AuditRecord {
  const frozen = cloneRecord(record);
  return deepFreeze(frozen);
}

export class InMemoryAuditPersistence implements AuditPersistence {
  private readonly records: AuditRecord[] = [];

  public async append(record: AuditRecord): Promise<AuditRecord> {
    const stored = freezeRecord(record);
    this.records.push(stored);

    return stored;
  }

  public async list(query: AuditQuery = {}): Promise<readonly AuditRecord[]> {
    const filtered = this.records.filter((record) => {
      if (query.schoolId && record.schoolId !== query.schoolId) {
        return false;
      }

      if (query.eventName && record.eventName !== query.eventName) {
        return false;
      }

      if (query.actorId && record.actorId !== query.actorId) {
        return false;
      }

      if (query.resourceType && record.resourceType !== query.resourceType) {
        return false;
      }

      if (query.resourceId && record.resourceId !== query.resourceId) {
        return false;
      }

      if (query.outcome && record.outcome !== query.outcome) {
        return false;
      }

      return true;
    });

    const limit = query.limit ?? filtered.length;

    return filtered.slice(0, limit).map((record) => freezeRecord(record));
  }
}

export function freezeAuditRecord(record: AuditRecord): AuditRecord {
  return freezeRecord(record);
}
