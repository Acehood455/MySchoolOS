import { getPrismaClient } from "./client.js";
import type { PrismaClient } from "@prisma/client";

export interface DatabaseHealth {
  readonly status: "connected" | "unavailable";
}

export async function checkDatabaseHealth(client?: PrismaClient): Promise<DatabaseHealth> {
  try {
    const prisma = client ?? getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return { status: "connected" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function pingDatabase(client?: PrismaClient): Promise<void> {
  const result = await checkDatabaseHealth(client);

  if (result.status !== "connected") {
    throw new Error("Database is unavailable");
  }
}
