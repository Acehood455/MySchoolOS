import { loadApiEnvironment } from "./env.js";
import { startApp } from "./app.js";
import { apiLogger } from "./logger.js";

async function main(): Promise<void> {
  const env = loadApiEnvironment();

  try {
    await startApp(env.PORT);
  } catch (error) {
    apiLogger.error("API failed to start", {
      error: error instanceof Error ? error.message : "unknown"
    });
    process.exitCode = 1;
  }
}

void main();
