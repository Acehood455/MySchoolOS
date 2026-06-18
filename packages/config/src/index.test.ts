import { describe, expect, it } from "vitest";
import { packageScope, supportedNodeEnvironments, workspaceName } from "./index.js";

describe("@myschoolos/config", () => {
  it("exports workspace constants", () => {
    expect(workspaceName).toBe("myschoolos");
    expect(packageScope).toBe("@myschoolos");
    expect(supportedNodeEnvironments).toContain("development");
  });
});
