import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("emits structured JSON with request context fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger("test");

    logger.info("hello", { feature: "foundation" });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(spy.mock.calls[0]?.[0] ?? "{}"))).toMatchObject({
      level: "info",
      scope: "test",
      message: "hello",
      requestId: null,
      correlationId: null,
      actorId: null,
      tenantId: null,
      meta: {
        feature: "foundation"
      }
    });

    spy.mockRestore();
  });

  it("merges contextual fields into child loggers", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const logger = createLogger("test", {
      requestId: "req-1",
      correlationId: "corr-1",
      actorId: "user-1",
      tenantId: "school-1"
    });

    logger.withContext({ actorId: "user-2" }).warn("permission denied");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(spy.mock.calls[0]?.[0] ?? "{}"))).toMatchObject({
      level: "warn",
      scope: "test",
      requestId: "req-1",
      correlationId: "corr-1",
      actorId: "user-2",
      tenantId: "school-1"
    });

    spy.mockRestore();
  });
});
