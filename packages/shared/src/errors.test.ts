import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";

describe("AppError", () => {
  it("converts to problem details", () => {
    const error = new AppError("Boom", { status: 400, code: "bad_request" });

    expect(error.toProblemDetails("/test")).toMatchObject({
      title: "Boom",
      status: 400,
      instance: "/test",
      code: "bad_request"
    });
  });
});
