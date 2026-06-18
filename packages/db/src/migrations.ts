import type { DatabaseEnvironment } from "./types.js";

function readRequiredEnv(name: string, source: NodeJS.ProcessEnv): string {
  const value = source[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function readOptionalEnv(name: string, source: NodeJS.ProcessEnv): string | undefined {
  const value = source[name];

  return value && value.trim() ? value.trim() : undefined;
}

export function loadDatabaseEnvironment(source: NodeJS.ProcessEnv = process.env): DatabaseEnvironment {
  return {
    databaseUrl: readRequiredEnv("DATABASE_URL", source),
    directUrl: readOptionalEnv("DIRECT_URL", source),
    shadowDatabaseUrl: readOptionalEnv("SHADOW_DATABASE_URL", source)
  };
}

