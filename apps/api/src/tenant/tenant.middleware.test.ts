import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerTenantMiddleware } from "./tenant.middleware.js";
import { TenantResolutionService } from "./tenant-resolution.service.js";
import type { TenantResolutionRepository } from "./tenant-context.js";

describe("registerTenantMiddleware", () => {
  it("binds tenant context onto the request", async () => {
    const repository: TenantResolutionRepository = {
      async findDomainsByHost(host) {
        return host === "alpha.example.com"
          ? [
              {
                id: "domain-1",
                schoolId: "school-123",
                host: "alpha.example.com",
                hostType: "custom_domain",
                verificationStatus: "verified",
                status: "active"
              }
            ]
          : [];
      },
      async findDomainsBySubdomain() {
        return [];
      }
    };
    const auditSink = { record: vi.fn() };
    const resolver = new TenantResolutionService({
      repository,
      subdomainBaseHost: "example.com",
      auditSink
    });
    const app = fastify();

    await registerTenantMiddleware(app, { resolver });

    app.get("/tenant", async (request) => ({
      schoolId: request.tenantContext?.schoolId ?? null,
      resolvedBy: request.tenantContext?.resolvedBy ?? null
    }));

    const response = await app.inject({
      method: "GET",
      url: "/tenant",
      headers: {
        host: "alpha.example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      schoolId: "school-123",
      resolvedBy: "verified_custom_domain"
    });
  });

  it("fails closed when the host cannot be resolved", async () => {
    const resolver = new TenantResolutionService({
      repository: {
        async findDomainsByHost() {
          return [];
        },
        async findDomainsBySubdomain() {
          return [];
        }
      },
      subdomainBaseHost: "example.com"
    });
    const app = fastify();

    await registerTenantMiddleware(app, { resolver });

    app.get("/tenant", async () => ({ ok: true }));

    const response = await app.inject({
      method: "GET",
      url: "/tenant"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "tenant_not_found"
    });
  });
});
