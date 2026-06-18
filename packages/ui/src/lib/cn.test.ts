import { describe, expect, it } from "vitest";
import { cn } from "./cn.js";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", false, "b", undefined, "c")).toBe("a b c");
  });
});
