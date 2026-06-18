import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("provides logging methods", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger("test");

    expect(() => logger.info("hello")).not.toThrow();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
