import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "./client.js";
import type { TenantScope } from "./types.js";

export type TransactionClient = Prisma.TransactionClient;
export type TransactionOptions = Parameters<PrismaClient["$transaction"]>[1];

export interface TenantDatabase {
  readonly schoolId: TenantScope["schoolId"];
  readonly client: PrismaClient;
  where<Where extends Record<string, unknown>>(where?: Where): Where & { schoolId: TenantScope["schoolId"] };
  data<Data extends Record<string, unknown>>(data: Data): Data & { schoolId: TenantScope["schoolId"] };
  transaction<T>(callback: (tx: TransactionClient) => Promise<T>, options?: TransactionOptions): Promise<T>;
}

function cloneRecord<T extends Record<string, unknown>>(record: T): T {
  return { ...record };
}

export function tenantWhere<Where extends Record<string, unknown>>(
  scope: TenantScope,
  where: Where = {} as Where
): Where & { schoolId: TenantScope["schoolId"] } {
  return {
    ...cloneRecord(where),
    schoolId: scope.schoolId
  };
}

export function tenantData<Data extends Record<string, unknown>>(
  scope: TenantScope,
  data: Data
): Data & { schoolId: TenantScope["schoolId"] } {
  return {
    ...cloneRecord(data),
    schoolId: scope.schoolId
  };
}

export function createTenantDatabase(scope: TenantScope, client: PrismaClient = getPrismaClient()): TenantDatabase {
  return {
    schoolId: scope.schoolId,
    client,
    where<Where extends Record<string, unknown>>(where: Where = {} as Where) {
      return tenantWhere(scope, where);
    },
    data<Data extends Record<string, unknown>>(data: Data) {
      return tenantData(scope, data);
    },
    transaction<T>(callback: (tx: TransactionClient) => Promise<T>, options?: TransactionOptions) {
      return client.$transaction(callback, options);
    }
  };
}

