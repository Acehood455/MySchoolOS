import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn()
}));

vi.mock("../lib/env.js", () => ({
  loadWebEnvironment: () => ({
    VITE_APP_NAME: "MySchoolOS",
    VITE_API_BASE_URL: "http://localhost:3000"
  })
}));

vi.mock("../lib/api.js", () => ({
  fetchHealth: vi.fn()
}));

const { RootRoute } = await import("./root.js");

describe("RootRoute", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        status: "ok",
        service: "api",
        timestamp: "2026-06-18T00:00:00.000Z"
      },
      error: null,
      refetch: vi.fn()
    } as never);
  });

  it("renders the bootstrap copy and health status", () => {
    const html = renderToStaticMarkup(<RootRoute />);

    expect(html).toContain("Foundation bootstrap is live.");
    expect(html).toContain("Vite + React");
    expect(html).toContain(">ok<");
    expect(html).toContain('href="http://localhost:3000"');
    expect(html).toContain("Refresh health");
  });
});
