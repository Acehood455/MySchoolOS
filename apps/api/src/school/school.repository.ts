import { normalizeRequestHost, type TenantDomainRecord } from "@myschoolos/shared";
import type {
  SchoolDomainRecord,
  SchoolRecord,
  SchoolSettingsRecord,
  SchoolThemeRecord
} from "./school-context.js";

export interface SchoolRepository {
  createSchool(record: SchoolRecord): Promise<SchoolRecord>;
  findSchoolById(schoolId: string): Promise<SchoolRecord | null>;
  updateSchool(
    schoolId: string,
    patch: Partial<Pick<SchoolRecord, "name" | "legalName" | "code" | "description" | "metadata">> & {
      readonly status?: SchoolRecord["status"];
      readonly activatedAt?: Date;
      readonly suspendedAt?: Date;
      readonly archivedAt?: Date;
      readonly updatedAt: Date;
    }
  ): Promise<SchoolRecord | null>;

  getSettings(schoolId: string): Promise<SchoolSettingsRecord | null>;
  upsertSettings(record: SchoolSettingsRecord): Promise<SchoolSettingsRecord>;

  getTheme(schoolId: string): Promise<SchoolThemeRecord | null>;
  upsertTheme(record: SchoolThemeRecord): Promise<SchoolThemeRecord>;

  createDomain(record: SchoolDomainRecord): Promise<SchoolDomainRecord>;
  findDomainById(domainId: string): Promise<SchoolDomainRecord | null>;
  findDomainsBySchoolId(schoolId: string): Promise<readonly SchoolDomainRecord[]>;
  findDomainsByHost(host: string): Promise<readonly SchoolDomainRecord[]>;
  updateDomain(
    domainId: string,
    patch: Partial<
      Pick<
        SchoolDomainRecord,
        "verificationStatus" | "status" | "verifiedAt" | "verifiedBy" | "activatedAt" | "deactivatedAt" | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<SchoolDomainRecord | null>;
}

export class InMemorySchoolRepository implements SchoolRepository {
  private readonly schools = new Map<string, SchoolRecord>();
  private readonly settings = new Map<string, SchoolSettingsRecord>();
  private readonly themes = new Map<string, SchoolThemeRecord>();
  private readonly domains = new Map<string, SchoolDomainRecord>();

  public async createSchool(record: SchoolRecord): Promise<SchoolRecord> {
    this.schools.set(record.id, record);
    return record;
  }

  public async findSchoolById(schoolId: string): Promise<SchoolRecord | null> {
    return this.schools.get(schoolId) ?? null;
  }

  public async updateSchool(
    schoolId: string,
    patch: Partial<Pick<SchoolRecord, "name" | "legalName" | "code" | "description" | "metadata">> & {
      readonly status?: SchoolRecord["status"];
      readonly activatedAt?: Date;
      readonly suspendedAt?: Date;
      readonly archivedAt?: Date;
      readonly updatedAt: Date;
    }
  ): Promise<SchoolRecord | null> {
    const current = this.schools.get(schoolId);

    if (!current) {
      return null;
    }

    const next: SchoolRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.schools.set(schoolId, next);
    return next;
  }

  public async getSettings(schoolId: string): Promise<SchoolSettingsRecord | null> {
    return this.settings.get(schoolId) ?? null;
  }

  public async upsertSettings(record: SchoolSettingsRecord): Promise<SchoolSettingsRecord> {
    this.settings.set(record.schoolId, record);
    return record;
  }

  public async getTheme(schoolId: string): Promise<SchoolThemeRecord | null> {
    return this.themes.get(schoolId) ?? null;
  }

  public async upsertTheme(record: SchoolThemeRecord): Promise<SchoolThemeRecord> {
    this.themes.set(record.schoolId, record);
    return record;
  }

  public async createDomain(record: SchoolDomainRecord): Promise<SchoolDomainRecord> {
    this.domains.set(record.id, record);
    return record;
  }

  public async findDomainById(domainId: string): Promise<SchoolDomainRecord | null> {
    return this.domains.get(domainId) ?? null;
  }

  public async findDomainsBySchoolId(schoolId: string): Promise<readonly SchoolDomainRecord[]> {
    return [...this.domains.values()].filter((domain) => domain.schoolId === schoolId);
  }

  public async findDomainsByHost(host: string): Promise<readonly SchoolDomainRecord[]> {
    const normalizedHost = normalizeRequestHost(host);

    if (!normalizedHost) {
      return [];
    }

    return [...this.domains.values()].filter((domain) => domain.host === normalizedHost);
  }

  public async updateDomain(
    domainId: string,
    patch: Partial<
      Pick<
        SchoolDomainRecord,
        "verificationStatus" | "status" | "verifiedAt" | "verifiedBy" | "activatedAt" | "deactivatedAt" | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<SchoolDomainRecord | null> {
    const current = this.domains.get(domainId);

    if (!current) {
      return null;
    }

    const next: SchoolDomainRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.domains.set(domainId, next);
    return next;
  }
}

export function toTenantDomainRecord(domain: SchoolDomainRecord): TenantDomainRecord {
  return {
    id: domain.id,
    schoolId: domain.schoolId,
    host: domain.host,
    hostType: domain.hostType,
    verificationStatus: domain.verificationStatus,
    status: domain.status === "inactive" ? "revoked" : domain.status,
    subdomain: domain.subdomain
  };
}
