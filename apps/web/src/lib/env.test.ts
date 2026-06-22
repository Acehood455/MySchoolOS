import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWebEnvironment, resolveApiBaseUrl } from "./env.js";

describe("loadWebEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("leaves the API base url unset when not provided", () => {
    vi.stubEnv("VITE_APP_NAME", "MySchoolOS");

    expect(loadWebEnvironment()).toMatchObject({
      VITE_APP_NAME: "MySchoolOS"
    });
  });

  it("respects an explicit API base url", () => {
    vi.stubEnv("VITE_APP_NAME", "MySchoolOS");
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:4000");

    expect(loadWebEnvironment()).toMatchObject({
      VITE_API_BASE_URL: "http://127.0.0.1:4000"
    });
  });
});

describe("resolveApiBaseUrl", () => {
  it("prefers an explicit API base url", () => {
    expect(
      resolveApiBaseUrl({
        VITE_APP_NAME: "MySchoolOS",
        VITE_API_BASE_URL: "http://127.0.0.1:4000"
      })
    ).toBe("http://127.0.0.1:4000");
  });

  it("falls back to localhost in development", () => {
    expect(
      resolveApiBaseUrl({
        VITE_APP_NAME: "MySchoolOS"
      })
    ).toBe("http://localhost:3000");
  });
});
