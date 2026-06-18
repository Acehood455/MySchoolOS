import { PrismaClient } from "@prisma/client";
import { createLogger } from "@myschoolos/observability";

const logger = createLogger("db");

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    const datasourceUrl = process.env.DATABASE_URL;

    if (!datasourceUrl) {
      throw new Error("DATABASE_URL is required to initialize PrismaClient");
    }

    client = new PrismaClient({
      datasourceUrl
    });
    logger.info("Prisma client initialized");
  }

  return client;
}

export async function closePrismaClient(): Promise<void> {
  if (!client) {
    return;
  }

  await client.$disconnect();
  client = null;
  logger.info("Prisma client disconnected");
}
