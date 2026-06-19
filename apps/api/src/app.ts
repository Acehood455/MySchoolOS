import fastify from "fastify";
import cors from "@fastify/cors";
import type { AuthService } from "./auth/auth.service.js";
import { registerFoundationPlugin, type FoundationIntegrationOptions } from "./foundation/foundation.plugin.js";
import { registerRoutes } from "./routes/index.js";
import { toProblemDetails } from "./errors.js";
import { apiLogger } from "./logger.js";

export interface CreateAppOptions {
  readonly foundation?: FoundationIntegrationOptions;
  readonly authService?: AuthService;
  readonly cookieName?: string;
}

export function createApp(options: CreateAppOptions = {}) {
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

  if (options.foundation) {
    void registerFoundationPlugin(app, {
      ...options.foundation,
      cookieName: options.cookieName ?? options.foundation.cookieName ?? "myschoolos_session"
    });
  }

  void app.register(registerRoutes, {
    authService: options.authService ?? options.foundation?.authService,
    cookieName: options.cookieName ?? "myschoolos_session"
  });

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
