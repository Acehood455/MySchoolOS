import { z } from "zod";

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().min(1).default("info"),
  PORT: z.coerce.number().int().positive().default(3001)
});

export type WorkerEnvironment = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnvironment(source: NodeJS.ProcessEnv = process.env): WorkerEnvironment {
  return workerEnvSchema.parse(source);
}
