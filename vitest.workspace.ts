import { defineProject } from "vitest/config";

export default [
  defineProject({
    test: {
      root: "./",
      include: ["apps/*/src/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "**/coverage/**"],
      name: "unit",
      environment: "node",
    }
  })
];
