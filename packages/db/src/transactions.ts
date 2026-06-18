import { type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "./client.js";
import type { TransactionClient, TransactionOptions } from "./tenant.js";
import type { TenantScope } from "./types.js";

export async function withTransaction<T>(
  callback: (tx: TransactionClient) => Promise<T>,
  options?: TransactionOptions,
  client: PrismaClient = getPrismaClient()
): Promise<T> {
  return client.$transaction(callback, options);
}

export async function withTenantTransaction<T>(
  scope: TenantScope,
  callback: (tx: TransactionClient, tenant: TenantScope) => Promise<T>,
  options?: TransactionOptions,
  client: PrismaClient = getPrismaClient()
): Promise<T> {
  return client.$transaction((tx) => callback(tx, scope), options);
}

