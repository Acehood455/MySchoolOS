import { AppError, normalizeRequestHost, type CanonicalRole } from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import type {
  SchoolActorContext,
  SchoolAuditSink,
  SchoolDomainRecord,
  SchoolRecord,
  SchoolLifecycleAuditEvent,
  SchoolSettingsRecord,
  SchoolThemeRecord
} from "./school-context.js";
import type { SchoolRepository } from "./school.repository.js";

export interface SchoolServiceOptions {
  readonly repository: SchoolRepository;
  readonly auditSink?: SchoolAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}

interface SchoolAuditRecord {
  readonly eventName: SchoolLifecycleAuditEvent["eventName"];
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: SchoolLifecycleAuditEvent["resourceType"];
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateSchoolInput {
  readonly actor: SchoolActorContext;
  readonly name: string;
  readonly legalName?: string;
  readonly code?: string;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateSchoolInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly name?: string;
  readonly legalName?: string;
  readonly code?: string;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateSchoolSettingsInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly timezone: string;
  readonly locale: string;
  readonly academicSessionDefaults: Readonly<Record<string, unknown>>;
  readonly platformConfiguration: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateSchoolThemeInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly logo: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly brandingConfiguration: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AddSchoolDomainInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly host: string;
  readonly hostType: SchoolDomainRecord["hostType"];
  readonly subdomain?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface VerifySchoolDomainInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly domainId: string;
  readonly verifiedBy: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ActivateDeactivateDomainInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly domainId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function defaultClock(): Date {
  return new Date();
}

function defaultIdFactory(): string {
  return `school_${randomUUID().replace(/-/g, "")}`;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

function hasRole(actor: SchoolActorContext, role: CanonicalRole): boolean {
  return actor.roles.includes(role);
}

function canManageSchool(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
}

function canCreateSchool(actor: SchoolActorContext): boolean {
  return hasRole(actor, "super_admin");
}

function requireActorPermission(
  actor: SchoolActorContext,
  allowed: boolean,
  eventName: string,
  resourceType: "School" | "SchoolSettings" | "SchoolTheme" | "SchoolDomain",
  resourceId: string
): void {
  if (allowed) {
    return;
  }

  throw new AppError("Permission denied", {
    status: 403,
    code: "permission_denied",
    details: {
      eventName,
      resourceType,
      resourceId,
      actorId: actor.actorId
    }
  });
}

function assertSchoolAccessible(actor: SchoolActorContext, schoolId: string): void {
  requireActorPermission(actor, canManageSchool(actor, schoolId), "school.access", "School", schoolId);
}

function normalizeDomainHost(host: string): string {
  const normalized = normalizeRequestHost(host);

  if (!normalized) {
    throw new AppError("Domain host is invalid", {
      status: 400,
      code: "school_domain_invalid"
    });
  }

  return normalized;
}

function sortDomains(domains: readonly SchoolDomainRecord[]): SchoolDomainRecord[] {
  return [...domains].sort((left, right) => {
    const leftPriority = left.hostType === "custom_domain" && left.verificationStatus === "verified" ? 0 : left.hostType === "subdomain" ? 1 : 2;
    const rightPriority = right.hostType === "custom_domain" && right.verificationStatus === "verified" ? 0 : right.hostType === "subdomain" ? 1 : 2;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.host.localeCompare(right.host);
  });
}

export class SchoolService {
  public constructor(private readonly options: SchoolServiceOptions) {}

  public async createSchool(input: CreateSchoolInput): Promise<SchoolRecord> {
    requireActorPermission(input.actor, canCreateSchool(input.actor), "school.created", "School", "new");

    const now = this.clock();
    const schoolId = this.idFactory();
    const existing = await this.options.repository.findSchoolById(schoolId);

    if (existing) {
      throw new AppError("School already exists", {
        status: 409,
        code: "school_conflict"
      });
    }

    const school: SchoolRecord = {
      id: schoolId,
      name: input.name.trim(),
      legalName: input.legalName?.trim(),
      code: input.code?.trim(),
      description: input.description?.trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createSchool(school);

    await this.audit({
      eventName: "school.created",
      actorId: input.actor.actorId,
      schoolId: created.id,
      resourceType: "School",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        status: created.status
      }
    });

    return created;
  }

  public async updateSchool(input: UpdateSchoolInput): Promise<SchoolRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);

    const current = await this.mustFindSchool(input.schoolId);
    const updatedAt = this.clock();

    const updated = await this.options.repository.updateSchool(input.schoolId, {
      name: input.name?.trim() ?? current.name,
      legalName: input.legalName?.trim() ?? current.legalName,
      code: input.code?.trim() ?? current.code,
      description: input.description?.trim() ?? current.description,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata,
      updatedAt
    });

    if (!updated) {
      throw new AppError("School not found", {
        status: 404,
        code: "school_not_found"
      });
    }

    await this.audit({
      eventName: "school.updated",
      actorId: input.actor.actorId,
      schoolId: updated.id,
      resourceType: "School",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async activateSchool(actor: SchoolActorContext, schoolId: string): Promise<SchoolRecord> {
    requireActorPermission(actor, hasRole(actor, "super_admin"), "school.activated", "School", schoolId);
    const current = await this.mustFindSchool(schoolId);

    if (current.status !== "pending" && current.status !== "suspended") {
      throw new AppError("School cannot be activated from the current state", {
        status: 409,
        code: "school_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "active"
        }
      });
    }

    const updated = await this.options.repository.updateSchool(schoolId, {
      status: "active",
      activatedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("School not found", {
        status: 404,
        code: "school_not_found"
      });
    }

    await this.audit({
      eventName: "school.activated",
      actorId: actor.actorId,
      schoolId,
      resourceType: "School",
      resourceId: schoolId,
      outcome: "success"
    });

    return updated;
  }

  public async suspendSchool(actor: SchoolActorContext, schoolId: string): Promise<SchoolRecord> {
    requireActorPermission(actor, hasRole(actor, "super_admin"), "school.suspended", "School", schoolId);
    const current = await this.mustFindSchool(schoolId);

    if (current.status !== "active") {
      throw new AppError("School cannot be suspended from the current state", {
        status: 409,
        code: "school_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "suspended"
        }
      });
    }

    const updated = await this.options.repository.updateSchool(schoolId, {
      status: "suspended",
      suspendedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("School not found", {
        status: 404,
        code: "school_not_found"
      });
    }

    await this.audit({
      eventName: "school.suspended",
      actorId: actor.actorId,
      schoolId,
      resourceType: "School",
      resourceId: schoolId,
      outcome: "success"
    });

    return updated;
  }

  public async archiveSchool(actor: SchoolActorContext, schoolId: string): Promise<SchoolRecord> {
    requireActorPermission(actor, hasRole(actor, "super_admin"), "school.archived", "School", schoolId);
    const current = await this.mustFindSchool(schoolId);

    if (current.status !== "active" && current.status !== "suspended") {
      throw new AppError("School cannot be archived from the current state", {
        status: 409,
        code: "school_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "archived"
        }
      });
    }

    const updated = await this.options.repository.updateSchool(schoolId, {
      status: "archived",
      archivedAt: this.clock(),
      updatedAt: this.clock()
    });

    if (!updated) {
      throw new AppError("School not found", {
        status: 404,
        code: "school_not_found"
      });
    }

    await this.audit({
      eventName: "school.archived",
      actorId: actor.actorId,
      schoolId,
      resourceType: "School",
      resourceId: schoolId,
      outcome: "success"
    });

    return updated;
  }

  public async getSchoolDetails(actor: SchoolActorContext, schoolId: string): Promise<SchoolRecord> {
    assertSchoolAccessible(actor, schoolId);
    return this.mustFindSchool(schoolId);
  }

  public async getSettings(actor: SchoolActorContext, schoolId: string): Promise<SchoolSettingsRecord> {
    assertSchoolAccessible(actor, schoolId);
    await this.mustFindSchool(schoolId);
    const settings = await this.options.repository.getSettings(schoolId);

    if (!settings) {
      throw new AppError("School settings not found", {
        status: 404,
        code: "school_settings_not_found"
      });
    }

    return settings;
  }

  public async updateSettings(input: UpdateSchoolSettingsInput): Promise<SchoolSettingsRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    await this.mustFindSchool(input.schoolId);

    const current = await this.options.repository.getSettings(input.schoolId);
    const now = this.clock();

    const settings: SchoolSettingsRecord = {
      schoolId: input.schoolId,
      timezone: input.timezone.trim(),
      locale: input.locale.trim(),
      academicSessionDefaults: cloneRecord(input.academicSessionDefaults),
      platformConfiguration: cloneRecord(input.platformConfiguration),
      status: "active",
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      createdBy: current?.createdBy ?? input.actor.actorId,
      metadata: input.metadata ? cloneRecord(input.metadata) : current?.metadata
    };

    const saved = await this.options.repository.upsertSettings(settings);

    await this.audit({
      eventName: "school.settings.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "SchoolSettings",
      resourceId: input.schoolId,
      outcome: "success",
      metadata: {
        timezone: saved.timezone,
        locale: saved.locale
      }
    });

    return saved;
  }

  public async getTheme(actor: SchoolActorContext, schoolId: string): Promise<SchoolThemeRecord> {
    assertSchoolAccessible(actor, schoolId);
    await this.mustFindSchool(schoolId);
    const theme = await this.options.repository.getTheme(schoolId);

    if (!theme) {
      throw new AppError("School theme not found", {
        status: 404,
        code: "school_theme_not_found"
      });
    }

    return theme;
  }

  public async updateTheme(input: UpdateSchoolThemeInput): Promise<SchoolThemeRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    await this.mustFindSchool(input.schoolId);

    const current = await this.options.repository.getTheme(input.schoolId);
    const now = this.clock();

    const theme: SchoolThemeRecord = {
      schoolId: input.schoolId,
      logo: input.logo.trim(),
      primaryColor: input.primaryColor.trim(),
      secondaryColor: input.secondaryColor.trim(),
      brandingConfiguration: cloneRecord(input.brandingConfiguration),
      status: "active",
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      createdBy: current?.createdBy ?? input.actor.actorId,
      metadata: input.metadata ? cloneRecord(input.metadata) : current?.metadata
    };

    const saved = await this.options.repository.upsertTheme(theme);

    await this.audit({
      eventName: "school.theme.updated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "SchoolTheme",
      resourceId: input.schoolId,
      outcome: "success",
      metadata: {
        primaryColor: saved.primaryColor,
        secondaryColor: saved.secondaryColor
      }
    });

    return saved;
  }

  public async addDomain(input: AddSchoolDomainInput): Promise<SchoolDomainRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    await this.mustFindSchool(input.schoolId);

    const host = normalizeDomainHost(input.host);
    const existing = await this.options.repository.findDomainsByHost(host);

    if (existing.some((domain) => domain.status !== "archived")) {
      throw new AppError("Domain host is already mapped", {
        status: 409,
        code: "school_domain_conflict",
        details: {
          host
        }
      });
    }

    const now = this.clock();
    const domain: SchoolDomainRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      host,
      hostType: input.hostType,
      verificationStatus: input.hostType === "subdomain" ? "verified" : "pending",
      status: input.hostType === "subdomain" ? "active" : "inactive",
      subdomain: input.subdomain?.trim() || (input.hostType === "subdomain" ? host.split(".")[0] : undefined),
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createDomain(domain);

    await this.audit({
      eventName: "school.domain.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "SchoolDomain",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        host: created.host,
        hostType: created.hostType
      }
    });

    return created;
  }

  public async verifyDomain(input: VerifySchoolDomainInput): Promise<SchoolDomainRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    const current = await this.mustFindDomain(input.schoolId, input.domainId);

    if (current.verificationStatus === "verified") {
      return current;
    }

    const updated = await this.options.repository.updateDomain(input.domainId, {
      verificationStatus: "verified",
      verifiedAt: this.clock(),
      verifiedBy: input.verifiedBy,
      updatedAt: this.clock(),
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata
    });

    if (!updated) {
      throw new AppError("Domain not found", {
        status: 404,
        code: "school_domain_not_found"
      });
    }

    await this.audit({
      eventName: "school.domain.verified",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "SchoolDomain",
      resourceId: input.domainId,
      outcome: "success",
      metadata: {
        host: updated.host,
        verifiedBy: input.verifiedBy
      }
    });

    return updated;
  }

  public async activateDomain(input: ActivateDeactivateDomainInput): Promise<SchoolDomainRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    const current = await this.mustFindDomain(input.schoolId, input.domainId);

    if (current.hostType === "custom_domain" && current.verificationStatus !== "verified") {
      throw new AppError("Custom domains must be verified before activation", {
        status: 409,
        code: "school_domain_unverified"
      });
    }

    const normalizedHost = normalizeDomainHost(current.host);
    const conflicts = await this.options.repository.findDomainsByHost(normalizedHost);
    const activeConflict = conflicts.find(
      (domain) => domain.id !== current.id && domain.status === "active" && domain.verificationStatus === "verified"
    );

    if (activeConflict) {
      throw new AppError("Domain host is already active for another school", {
        status: 409,
        code: "school_domain_conflict",
        details: {
          host: normalizedHost,
          conflictingSchoolId: activeConflict.schoolId
        }
      });
    }

    const updated = await this.options.repository.updateDomain(input.domainId, {
      status: "active",
      activatedAt: this.clock(),
      updatedAt: this.clock(),
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata
    });

    if (!updated) {
      throw new AppError("Domain not found", {
        status: 404,
        code: "school_domain_not_found"
      });
    }

    await this.audit({
      eventName: "school.domain.activated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "SchoolDomain",
      resourceId: input.domainId,
      outcome: "success",
      metadata: {
        host: updated.host
      }
    });

    return updated;
  }

  public async deactivateDomain(input: ActivateDeactivateDomainInput): Promise<SchoolDomainRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    const current = await this.mustFindDomain(input.schoolId, input.domainId);

    const updated = await this.options.repository.updateDomain(input.domainId, {
      status: "inactive",
      deactivatedAt: this.clock(),
      updatedAt: this.clock(),
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata
    });

    if (!updated) {
      throw new AppError("Domain not found", {
        status: 404,
        code: "school_domain_not_found"
      });
    }

    await this.audit({
      eventName: "school.domain.deactivated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "SchoolDomain",
      resourceId: input.domainId,
      outcome: "success",
      metadata: {
        host: updated.host
      }
    });

    return updated;
  }

  public async listDomains(actor: SchoolActorContext, schoolId: string): Promise<readonly SchoolDomainRecord[]> {
    assertSchoolAccessible(actor, schoolId);
    await this.mustFindSchool(schoolId);
    const domains = await this.options.repository.findDomainsBySchoolId(schoolId);
    return sortDomains(domains);
  }

  private async mustFindSchool(schoolId: string): Promise<SchoolRecord> {
    const school = await this.options.repository.findSchoolById(schoolId);

    if (!school) {
      throw new AppError("School not found", {
        status: 404,
        code: "school_not_found"
      });
    }

    return school;
  }

  private async mustFindDomain(schoolId: string, domainId: string): Promise<SchoolDomainRecord> {
    const domain = await this.options.repository.findDomainById(domainId);

    if (!domain || domain.schoolId !== schoolId) {
      throw new AppError("Domain not found", {
        status: 404,
        code: "school_domain_not_found"
      });
    }

    return domain;
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(): string {
    return this.options.idFactory?.() ?? defaultIdFactory();
  }

  private async audit(event: SchoolAuditRecord): Promise<void> {
    await this.options.auditSink?.record(event as never);
  }
}
