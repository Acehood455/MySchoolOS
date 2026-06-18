import { describe, expect, it } from "vitest";
import { loadWorkerEnvironment } from "./env.js";

describe("loadWorkerEnvironment", () => {
  it("parses worker defaults", () => {
    const env = loadWorkerEnvironment({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      PORT: "3001"
    });

    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe("development");
  });
});
