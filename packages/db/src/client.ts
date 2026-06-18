import { PrismaClient } from "@prisma/client";
import { createLogger } from "@myschoolos/observability";

const logger = createLogger("db");

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
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
