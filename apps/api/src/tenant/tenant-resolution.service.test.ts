import { describe, expect, it, vi } from "vitest";
import { TenantResolutionService } from "./tenant-resolution.service.js";
import type { TenantResolutionRepository } from "./tenant-context.js";

function createRecord(overrides: Partial<{
  id: string;
  schoolId: string;
  host: string;
  hostType: "custom_domain" | "subdomain";
  verificationStatus: "pending" | "verified" | "revoked";
  status: "active" | "archived" | "revoked";
  subdomain?: string;
}> = {}) {
  return {
    id: "domain-1",
    schoolId: "school-123",
    host: "alpha.example.com",
    hostType: "custom_domain",
    verificationStatus: "verified",
    status: "active",
    ...overrides
  } as const;
}

describe("TenantResolutionService", () => {
  it("resolves a verified custom domain first", async () => {
    const repository: TenantResolutionRepository = {
      async findDomainsByHost(host) {
        return host === "alpha.example.com" ? [createRecord()] : [];
      },
      async findDomainsBySubdomain() {
        return [];
      }
    };
    const auditSink = { record: vi.fn() };
    const service = new TenantResolutionService({
      repository,
      subdomainBaseHost: "example.com",
      auditSink
    });

    await expect(service.resolve(" Alpha.Example.com:443 ")).resolves.toEqual({
      schoolId: "school-123",
      host: "alpha.example.com",
      resolvedBy: "verified_custom_domain",
      schoolDomainId: "domain-1"
    });
    expect(auditSink.record).not.toHaveBeenCalled();
  });

  it("falls back to a subdomain mapping", async () => {
    const repository: TenantResolutionRepository = {
      async findDomainsByHost() {
        return [];
      },
      async findDomainsBySubdomain(subdomain) {
        return subdomain === "beta" ? [createRecord({ id: "domain-2", host: "beta.example.com", hostType: "subdomain", subdomain: "beta" })] : [];
      }
    };
    const service = new TenantResolutionService({
      repository,
      subdomainBaseHost: "example.com"
    });

    await expect(service.resolve("beta.example.com")).resolves.toEqual({
      schoolId: "school-123",
      host: "beta.example.com",
      resolvedBy: "subdomain_fallback",
      schoolDomainId: "domain-2"
    });
  });

  it("rejects unresolved hosts and audits the failure", async () => {
    const auditSink = { record: vi.fn() };
    const service = new TenantResolutionService({
      repository: {
        async findDomainsByHost() {
          return [];
        },
        async findDomainsBySubdomain() {
          return [];
        }
      },
      subdomainBaseHost: "example.com",
      auditSink
    });

    await expect(service.resolve("unknown.example.com")).rejects.toMatchObject({
      status: 404,
      code: "tenant_not_found"
    });
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "tenant.resolution.failed",
        host: "unknown.example.com",
        reason: "unresolved"
      })
    );
  });

  it("rejects duplicate verified custom domains as a conflict", async () => {
    const auditSink = { record: vi.fn() };
    const service = new TenantResolutionService({
      repository: {
        async findDomainsByHost() {
          return [
            createRecord({ id: "domain-1", schoolId: "school-123" }),
            createRecord({ id: "domain-2", schoolId: "school-456" })
          ];
        },
        async findDomainsBySubdomain() {
          return [];
        }
      },
      subdomainBaseHost: "example.com",
      auditSink
    });

    await expect(service.resolve("alpha.example.com")).rejects.toMatchObject({
      status: 409,
      code: "tenant_conflict"
    });
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "tenant.resolution.conflict",
        host: "alpha.example.com",
        reason: "conflict"
      })
    );
  });
});
