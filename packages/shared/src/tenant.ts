export type TenantResolutionSource = "verified_custom_domain" | "subdomain_fallback";

export type TenantDomainHostType = "custom_domain" | "subdomain";

export type TenantDomainVerificationStatus = "pending" | "verified" | "revoked";

export type TenantDomainRecordStatus = "active" | "archived" | "revoked";

export interface TenantContext {
  readonly schoolId: string;
  readonly host: string;
  readonly resolvedBy: TenantResolutionSource;
  readonly schoolDomainId: string;
}

export interface TenantDomainRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly host: string;
  readonly hostType: TenantDomainHostType;
  readonly verificationStatus: TenantDomainVerificationStatus;
  readonly status: TenantDomainRecordStatus;
  readonly subdomain?: string;
}

export interface TenantResolutionSettings {
  readonly subdomainBaseHost: string;
}

export interface TenantResolutionFailure {
  readonly reason: "missing_host" | "invalid_host" | "unresolved" | "conflict" | "unverified_mapping";
  readonly host?: string;
  readonly candidateCount?: number;
  readonly schoolIds?: readonly string[];
}

export interface TenantResolutionAuditEvent {
  readonly eventName: "tenant.resolution.failed" | "tenant.resolution.conflict";
  readonly host: string;
  readonly reason: TenantResolutionFailure["reason"];
  readonly details?: Record<string, unknown>;
}

export function normalizeRequestHost(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withoutTrailingDot = trimmed.replace(/\.+$/, "");

  if (!withoutTrailingDot) {
    return null;
  }

  try {
    return new URL(`http://${withoutTrailingDot}`).hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return null;
  }
}

export function extractSubdomainHost(host: string, baseHost: string): string | null {
  const normalizedHost = normalizeRequestHost(host);
  const normalizedBaseHost = normalizeRequestHost(baseHost);

  if (!normalizedHost || !normalizedBaseHost) {
    return null;
  }

  if (normalizedHost === normalizedBaseHost) {
    return null;
  }

  const suffix = `.${normalizedBaseHost}`;

  if (!normalizedHost.endsWith(suffix)) {
    return null;
  }

  return normalizedHost.slice(0, -suffix.length);
}

