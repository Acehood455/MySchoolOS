import type { CanonicalRole } from "@myschoolos/shared";

export type SchoolStatus = "pending" | "active" | "suspended" | "archived";
export type SchoolDomainHostType = "custom_domain" | "subdomain";
export type SchoolDomainVerificationStatus = "pending" | "verified" | "revoked";
export type SchoolDomainStatus = "active" | "inactive" | "archived";
export type SchoolSettingsStatus = "active" | "archived";
export type SchoolThemeStatus = "active" | "archived";

export interface SchoolRecord {
  readonly id: string;
  readonly name: string;
  readonly legalName?: string;
  readonly code?: string;
  readonly description?: string;
  readonly status: SchoolStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly activatedAt?: Date;
  readonly suspendedAt?: Date;
  readonly archivedAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SchoolSettingsRecord {
  readonly schoolId: string;
  readonly timezone: string;
  readonly locale: string;
  readonly academicSessionDefaults: Readonly<Record<string, unknown>>;
  readonly platformConfiguration: Readonly<Record<string, unknown>>;
  readonly status: SchoolSettingsStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SchoolThemeRecord {
  readonly schoolId: string;
  readonly logo: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly brandingConfiguration: Readonly<Record<string, unknown>>;
  readonly status: SchoolThemeStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SchoolDomainRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly host: string;
  readonly hostType: SchoolDomainHostType;
  readonly verificationStatus: SchoolDomainVerificationStatus;
  readonly status: SchoolDomainStatus;
  readonly subdomain?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly verifiedAt?: Date;
  readonly verifiedBy?: string;
  readonly activatedAt?: Date;
  readonly deactivatedAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SchoolActorContext {
  readonly actorId: string;
  readonly roles: readonly CanonicalRole[];
  readonly schoolId?: string | null;
}

export interface SchoolLifecycleAuditEvent {
  readonly eventName:
    | "school.created"
    | "school.updated"
    | "school.activated"
    | "school.suspended"
    | "school.archived"
    | "school.settings.updated"
    | "school.theme.updated"
    | "school.domain.created"
    | "school.domain.verified"
    | "school.domain.activated"
    | "school.domain.deactivated";
  readonly actorId: string;
  readonly schoolId?: string;
  readonly resourceType: "School" | "SchoolSettings" | "SchoolTheme" | "SchoolDomain";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface SchoolAuditSink {
  record(event: SchoolLifecycleAuditEvent): Promise<void> | void;
}

