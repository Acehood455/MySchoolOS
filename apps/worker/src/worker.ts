import { createLogger } from "./logger.js";

const workerLogger = createLogger("worker");

export async function startWorker(): Promise<void> {
  workerLogger.info("Worker booted", {
    scope: "bootstrap"
  });
}
