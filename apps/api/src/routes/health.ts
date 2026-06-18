import type { FastifyInstance } from "fastify";
import { pingDatabase } from "@myschoolos/db";
import type { HealthResponse } from "@myschoolos/shared";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    let database: HealthResponse["database"] = "unavailable";

    try {
      await pingDatabase();
      database = "connected";
    } catch {
      database = "unavailable";
    }

    const response: HealthResponse = {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
      database
    };

    return response;
  });
}
