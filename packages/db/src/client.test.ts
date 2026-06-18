import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tenantData, tenantWhere } from "./tenant.js";
import { createSchoolId, createTenantScope } from "./types.js";
import { checkDatabaseHealth } from "./health.js";

const { mockPrismaClient, mockDisconnect, mockQueryRaw } = vi.hoisted(() => {
  const disconnect = vi.fn().mockResolvedValue(undefined);
  const queryRaw = vi.fn().mockResolvedValue(undefined);

  // The mock implementation must be a regular function (not an arrow function)
  // to support being called with 'new' (e.g. new PrismaClient()).
  const prismaClient = vi.fn(function () {
    return {
      $disconnect: disconnect,
      $queryRaw: queryRaw,
    };
  });

  return { mockPrismaClient: prismaClient, mockDisconnect: disconnect, mockQueryRaw: queryRaw };
});

vi.mock("@prisma/client", () => ({
  PrismaClient: mockPrismaClient
}));

import { closePrismaClient, getPrismaClient } from "./client.js";

describe("@myschoolos/db", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/myschoolos-test");
    mockDisconnect.mockClear();
    mockQueryRaw.mockClear();
    mockPrismaClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a singleton prisma client", () => {
    const first = getPrismaClient();
    const second = getPrismaClient();

    expect(first).toBe(second);
    expect(mockPrismaClient).toHaveBeenCalledTimes(1);
  });

  it("disconnects the prisma client", async () => {
    getPrismaClient();
    await closePrismaClient();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("builds tenant-scoped query helpers", () => {
    const scope = createTenantScope("school-123");

    expect(scope.schoolId).toBe("school-123");
    expect(tenantWhere(scope, { status: "active" })).toEqual({
      schoolId: "school-123",
      status: "active"
    });
    expect(tenantData(scope, { name: "Primary School" })).toEqual({
      schoolId: "school-123",
      name: "Primary School"
    });
  });

  it("reports database health", async () => {
    await expect(checkDatabaseHealth()).resolves.toEqual({ status: "connected" });
  });
});
