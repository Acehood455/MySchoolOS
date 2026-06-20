import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWebEnvironment } from "./env.js";

describe("loadWebEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults the API base url for local development", () => {
    vi.stubEnv("VITE_APP_NAME", "MySchoolOS");

    expect(loadWebEnvironment()).toMatchObject({
      VITE_APP_NAME: "MySchoolOS",
      VITE_API_BASE_URL: "http://localhost:3000"
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
