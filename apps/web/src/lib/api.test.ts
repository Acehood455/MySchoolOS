import { describe, expect, it, vi } from "vitest";
import { fetchHealth } from "./api.js";

describe("fetchHealth", () => {
  it("returns health data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        service: "api",
        timestamp: "2026-06-18T00:00:00.000Z"
      })
    }) as typeof fetch);

    await expect(fetchHealth("http://localhost:3000")).resolves.toMatchObject({
      status: "ok",
      service: "api"
    });
  });
});
