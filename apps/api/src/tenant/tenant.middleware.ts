import type { FastifyInstance } from "fastify";
import type { TenantContext } from "@myschoolos/shared";
import { TenantResolutionService } from "./tenant-resolution.service.js";

export interface TenantMiddlewareOptions {
  readonly resolver: TenantResolutionService;
}

export const tenantContextKey = "tenantContext" as const;

export async function registerTenantMiddleware(app: FastifyInstance, options: TenantMiddlewareOptions): Promise<void> {
  app.decorateRequest(tenantContextKey, null);

  app.addHook("onRequest", async (request) => {
    const tenantContext = await options.resolver.resolve(request.headers.host);

    request.tenantContext = tenantContext;
  });
}

export function requireTenantContext(tenantContext: TenantContext | null): asserts tenantContext is TenantContext {
  if (!tenantContext) {
    throw new Error("Tenant context is required");
  }
}
