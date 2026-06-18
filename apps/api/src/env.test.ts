import { describe, expect, it } from "vitest";
import { loadApiEnvironment } from "./env.js";

describe("loadApiEnvironment", () => {
  it("parses the required api environment", () => {
    const env = loadApiEnvironment({
      NODE_ENV: "development",
      APP_NAME: "MySchoolOS",
      APP_URL: "http://localhost:5173",
      API_URL: "http://localhost:3000",
      PORT: "3000",
      DEFAULT_TIMEZONE: "Africa/Lagos",
      LOG_LEVEL: "info",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/myschoolos"
    });

    expect(env.PORT).toBe(3000);
    expect(env.APP_NAME).toBe("MySchoolOS");
  });
});
