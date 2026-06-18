import { beforeEach, describe, expect, it, vi } from "vitest";

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
    mockDisconnect.mockClear();
    mockQueryRaw.mockClear();
    mockPrismaClient.mockClear();
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
});
