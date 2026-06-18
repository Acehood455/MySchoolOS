import { getPrismaClient } from "./client.js";

export async function pingDatabase(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$queryRaw`SELECT 1`;
}
