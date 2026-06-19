import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

function parseJsonLog(entry: unknown): Record<string, unknown> {
  return JSON.parse(String(entry));
}

describe("createApp observability", () => {
  it("logs request lifecycle events and failures with request context", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp({
      foundation: {
        tenantResolver: {
          async resolve() {
            return {
              schoolId: "school-123",
              host: "alpha.example.com",
              resolvedBy: "verified_custom_domain" as const,
              schoolDomainId: "domain-1"
            };
          }
        }
      }
    });

    app.get(
      "/boom",
      {
        config: {
          foundation: {
            resolveTenant: true
          }
        }
      },
      async () => {
        throw new Error("boom");
      }
    );

    const response = await app.inject({
      method: "GET",
      url: "/boom",
      headers: {
        host: "alpha.example.com",
        "x-correlation-id": "corr-123"
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["permissions-policy"]).toContain("camera=()");
    expect(logSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const receivedLog = logSpy.mock.calls.map((call) => parseJsonLog(call[0])).find((entry) => entry.message === "request.received");
    const completedLog = logSpy.mock.calls.map((call) => parseJsonLog(call[0])).find((entry) => entry.message === "request.completed");
    const errorLog = parseJsonLog(errorSpy.mock.calls[0]?.[0]);

    expect(receivedLog).toMatchObject({
      scope: "api.foundation",
      message: "request.received",
      requestId: expect.any(String),
      correlationId: "corr-123",
      actorId: null,
      tenantId: null
    });
    expect(completedLog).toMatchObject({
      scope: "api.foundation",
      message: "request.completed",
      correlationId: "corr-123",
      tenantId: "school-123"
    });
    expect(errorLog).toMatchObject({
      scope: "api",
      message: "request.failed",
      correlationId: "corr-123",
      tenantId: "school-123",
      actorId: null,
      meta: expect.objectContaining({
        statusCode: 500
      })
    });

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
