import type { FastifyRequest } from "fastify";
import type {
  TenantContext,
  TenantDomainRecord,
  TenantResolutionAuditEvent,
  TenantResolutionFailure,
  TenantResolutionSettings
} from "@myschoolos/shared";

export interface TenantResolutionRepository {
  findDomainsByHost(host: string): Promise<readonly TenantDomainRecord[]>;
  findDomainsBySubdomain(subdomain: string): Promise<readonly TenantDomainRecord[]>;
}

export interface TenantResolutionAuditSink {
  record(event: TenantResolutionAuditEvent): Promise<void> | void;
}

export interface TenantResolutionServiceOptions extends TenantResolutionSettings {
  readonly repository: TenantResolutionRepository;
  readonly auditSink?: TenantResolutionAuditSink;
}

export interface TenantResolutionErrorDetails extends TenantResolutionFailure {
  readonly code: "tenant_not_found" | "tenant_conflict" | "tenant_resolution_invalid_host";
}

declare module "fastify" {
  interface FastifyRequest {
    tenantContext: TenantContext | null;
  }
}

export type { TenantContext } from "@myschoolos/shared";
export type { TenantDomainRecord } from "@myschoolos/shared";

export function hasTenantContext(request: FastifyRequest): request is FastifyRequest & { tenantContext: TenantContext } {
  return request.tenantContext !== null;
}

