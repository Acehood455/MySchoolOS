import { z } from "zod";
import type { AppEnvironment } from "@myschoolos/shared";

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("MySchoolOS"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  API_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(3000),
  DEFAULT_TIMEZONE: z.string().min(1).default("Africa/Lagos"),
  LOG_LEVEL: z.string().min(1).default("info"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional()
});

export type ApiEnvironment = AppEnvironment & {
  PORT: number;
  DATABASE_URL: string;
  DIRECT_URL?: string;
};

export function loadApiEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  const parsed = apiEnvSchema.parse(source);

  return {
    NODE_ENV: parsed.NODE_ENV,
    APP_NAME: parsed.APP_NAME,
    APP_URL: parsed.APP_URL,
    API_URL: parsed.API_URL,
    PORT: parsed.PORT,
    DEFAULT_TIMEZONE: parsed.DEFAULT_TIMEZONE,
    LOG_LEVEL: parsed.LOG_LEVEL,
    DATABASE_URL: parsed.DATABASE_URL,
    DIRECT_URL: parsed.DIRECT_URL
  };
}
