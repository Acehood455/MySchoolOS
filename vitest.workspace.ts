import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      root: "./",
      include: ["apps/*/src/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "**/coverage/**"],
      name: "unit",
      environment: "node",
    },
  }
]);
