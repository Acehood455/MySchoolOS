import { AppError } from "@myschoolos/shared";
import {
  extractSubdomainHost,
  normalizeRequestHost,
  type TenantContext,
  type TenantDomainRecord,
  type TenantResolutionAuditEvent
} from "@myschoolos/shared";
import type {
  TenantResolutionAuditSink,
  TenantResolutionServiceOptions
} from "./tenant-context.js";

function isActiveVerifiedCustomDomain(record: TenantDomainRecord): boolean {
  return record.hostType === "custom_domain" && record.status === "active" && record.verificationStatus === "verified";
}

function isActiveSubdomain(record: TenantDomainRecord, subdomain: string): boolean {
  return record.hostType === "subdomain" && record.status === "active" && record.subdomain === subdomain;
}

export class TenantResolutionService {
  public constructor(private readonly options: TenantResolutionServiceOptions) {}

  public async resolve(host: string | null | undefined): Promise<TenantContext> {
    const normalizedHost = host ? normalizeRequestHost(host) : null;

    if (!normalizedHost) {
      await this.auditFailure({
        eventName: "tenant.resolution.failed",
        host: host?.trim() ?? "",
        reason: host ? "invalid_host" : "missing_host",
        details: {
          stage: "request_host"
        }
      });

      throw new AppError("Tenant Not Found", {
        status: 404,
        code: host ? "tenant_resolution_invalid_host" : "tenant_not_found"
      });
    }

    const domainMatches = await this.options.repository.findDomainsByHost(normalizedHost);
    const verifiedCustomDomainMatches = domainMatches.filter(isActiveVerifiedCustomDomain);

    if (verifiedCustomDomainMatches.length > 1) {
      await this.auditFailure({
        eventName: "tenant.resolution.conflict",
        host: normalizedHost,
        reason: "conflict",
        details: {
          stage: "verified_custom_domain",
          candidateCount: verifiedCustomDomainMatches.length,
          schoolIds: verifiedCustomDomainMatches.map((record) => record.schoolId),
          domainIds: verifiedCustomDomainMatches.map((record) => record.id)
        }
      });

      throw new AppError("Tenant Not Found", {
        status: 409,
        code: "tenant_conflict"
      });
    }

    if (verifiedCustomDomainMatches.length === 1) {
      const matchedDomain = verifiedCustomDomainMatches[0];

      if (!matchedDomain) {
        throw new AppError("Tenant Not Found", {
          status: 404,
          code: "tenant_not_found"
        });
      }

      return this.buildContext(matchedDomain, normalizedHost, "verified_custom_domain");
    }

    if (domainMatches.length > 0) {
      const activeVerifiedCandidates = domainMatches.filter(
        (record) => record.verificationStatus === "verified" && record.status === "active"
      );

      await this.auditFailure({
        eventName: "tenant.resolution.failed",
        host: normalizedHost,
        reason: "unverified_mapping",
        details: {
          stage: "verified_custom_domain",
          candidateCount: domainMatches.length,
          verifiedCandidateCount: activeVerifiedCandidates.length
        }
      });
    }

    const subdomain = extractSubdomainHost(normalizedHost, this.options.subdomainBaseHost);

    if (!subdomain) {
      await this.auditFailure({
        eventName: "tenant.resolution.failed",
        host: normalizedHost,
        reason: "unresolved",
        details: {
          stage: "subdomain_fallback",
          baseHost: this.options.subdomainBaseHost
        }
      });

      throw new AppError("Tenant Not Found", {
        status: 404,
        code: "tenant_not_found"
      });
    }

    const subdomainMatches = (await this.options.repository.findDomainsBySubdomain(subdomain)).filter((record) =>
      isActiveSubdomain(record, subdomain)
    );

    if (subdomainMatches.length > 1) {
      await this.auditFailure({
        eventName: "tenant.resolution.conflict",
        host: normalizedHost,
        reason: "conflict",
        details: {
          stage: "subdomain_fallback",
          subdomain,
          candidateCount: subdomainMatches.length,
          schoolIds: subdomainMatches.map((record) => record.schoolId),
          domainIds: subdomainMatches.map((record) => record.id)
        }
      });

      throw new AppError("Tenant Not Found", {
        status: 409,
        code: "tenant_conflict"
      });
    }

    if (subdomainMatches.length === 1) {
      const matchedDomain = subdomainMatches[0];

      if (!matchedDomain) {
        throw new AppError("Tenant Not Found", {
          status: 404,
          code: "tenant_not_found"
        });
      }

      return this.buildContext(matchedDomain, normalizedHost, "subdomain_fallback");
    }

    await this.auditFailure({
      eventName: "tenant.resolution.failed",
      host: normalizedHost,
      reason: "unresolved",
      details: {
        stage: "subdomain_fallback",
        subdomain,
        baseHost: this.options.subdomainBaseHost
      }
    });

    throw new AppError("Tenant Not Found", {
      status: 404,
      code: "tenant_not_found"
    });
  }

  private buildContext(record: TenantDomainRecord, host: string, resolvedBy: TenantContext["resolvedBy"]): TenantContext {
    return {
      schoolId: record.schoolId,
      host,
      resolvedBy,
      schoolDomainId: record.id
    };
  }

  private async auditFailure(event: TenantResolutionAuditEvent): Promise<void> {
    const sink: TenantResolutionAuditSink | undefined = this.options.auditSink;

    if (!sink) {
      return;
    }

    await sink.record(event);
  }
}
