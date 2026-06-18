import { loadWorkerEnvironment } from "./env.js";
import { startWorker } from "./worker.js";
import { createLogger } from "./logger.js";

const logger = createLogger("worker");

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const shutdown = () => resolve();

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

async function main(): Promise<void> {
  loadWorkerEnvironment();
  await startWorker();
  logger.info("Worker ready");
  await waitForShutdown();
  logger.info("Worker stopped");
}

void main();
