import { defineConfig, env } from "@prisma/config";

process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations"
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
    ...(process.env.DIRECT_URL ? { directUrl: process.env.DIRECT_URL } : {})
  }
});
