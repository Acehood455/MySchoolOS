import { getPrismaClient } from "./client.js";
import type { PrismaClient } from "@prisma/client";

export interface DatabaseHealth {
  readonly status: "connected" | "unavailable";
}

export async function checkDatabaseHealth(client: PrismaClient = getPrismaClient()): Promise<DatabaseHealth> {
  try {
    await client.$queryRaw`SELECT 1`;
    return { status: "connected" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function pingDatabase(client: PrismaClient = getPrismaClient()): Promise<void> {
  const result = await checkDatabaseHealth(client);

  if (result.status !== "connected") {
    throw new Error("Database is unavailable");
  }
}
