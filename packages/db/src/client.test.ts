import { beforeEach, describe, expect, it, vi } from "vitest";

const disconnect = vi.fn().mockResolvedValue(undefined);
const queryRaw = vi.fn().mockResolvedValue(undefined);
const prismaClientMock = vi.fn().mockImplementation(() => ({
  $disconnect: disconnect,
  $queryRaw: queryRaw
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaClientMock
}));

import { closePrismaClient, getPrismaClient } from "./client.js";

describe("@myschoolos/db", () => {
  beforeEach(() => {
    disconnect.mockClear();
    queryRaw.mockClear();
    prismaClientMock.mockClear();
  });

  it("returns a singleton prisma client", () => {
    const first = getPrismaClient();
    const second = getPrismaClient();

    expect(first).toBe(second);
    expect(prismaClientMock).toHaveBeenCalledTimes(1);
  });

  it("disconnects the prisma client", async () => {
    getPrismaClient();
    await closePrismaClient();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
