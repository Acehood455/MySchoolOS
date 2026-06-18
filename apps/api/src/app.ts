import fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes/index.js";
import { toProblemDetails } from "./errors.js";
import { apiLogger } from "./logger.js";

export function createApp() {
  const app = fastify({
    logger: true
  });

  app.setErrorHandler((error, request, reply) => {
    const details = toProblemDetails(error, request.url);
    request.log.error({ error: details }, "request failed");
    void reply.status(details.status).send(details);
  });

  void app.register(cors, {
    origin: true
  });

  void app.register(registerRoutes);

  app.get("/", async () => ({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString()
  }));

  return app;
}

export async function startApp(port: number): Promise<void> {
  const app = createApp();

  await app.listen({ port, host: "0.0.0.0" });
  apiLogger.info("API listening", { port });
}
