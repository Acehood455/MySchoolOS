import { describe, expect, it, vi } from "vitest";
import type { AuthRepository, AuthUserRecord, PasswordResetRecord, SessionRecord } from "./auth-context.js";
import { AuthService } from "./auth.service.js";
import { createPasswordHash } from "./password.service.js";

function createTenantContext() {
  return {
    schoolId: "school-123",
    host: "alpha.example.com",
    resolvedBy: "verified_custom_domain" as const,
    schoolDomainId: "domain-1"
  };
}

function createTokenFactory(tokens: string[]) {
  return () => {
    const token = tokens.shift();

    if (!token) {
      throw new Error("No token available");
    }

    return token;
  };
}

async function createRepository() {
  const passwordHash = await createPasswordHash("initial-password");
  const users = new Map<string, AuthUserRecord>([
    [
      "school-123:teacher@example.com",
      {
        id: "user-1",
        schoolId: "school-123",
        loginIdentifier: "teacher@example.com",
        passwordHash,
        status: "active"
      }
    ]
  ]);
  const usersById = new Map<string, AuthUserRecord>([
    [
      "school-123:user-1",
      {
        id: "user-1",
        schoolId: "school-123",
        loginIdentifier: "teacher@example.com",
        passwordHash,
        status: "active"
      }
    ]
  ]);
  const sessions = new Map<string, SessionRecord>();
  const passwordResets = new Map<string, PasswordResetRecord>();

  const repository: AuthRepository = {
    async findUserByLogin(loginIdentifier, schoolId) {
      return users.get(`${schoolId}:${loginIdentifier}`) ?? null;
    },
    async findUserById(userId, schoolId) {
      return usersById.get(`${schoolId}:${userId}`) ?? null;
    },
    async createSession(record) {
      sessions.set(record.id, record);

      return record;
    },
    async findSessionByTokenHash(tokenHash) {
      for (const session of sessions.values()) {
        if (session.tokenHash === tokenHash) {
          return session;
        }
      }

      return null;
    },
    async updateSessionStatus(sessionId, status, details) {
      const current = sessions.get(sessionId);

      if (!current) {
        return;
      }

      sessions.set(sessionId, {
        ...current,
        status,
        revokedAt: details?.revokedAt ?? current.revokedAt,
        revokedReason: details?.revokedReason ?? current.revokedReason,
        lastRefreshedAt: details?.lastRefreshedAt ?? current.lastRefreshedAt,
        expiresAt: details?.expiresAt ?? current.expiresAt,
        tokenHash: details?.tokenHash ?? current.tokenHash
      });
    },
    async revokeSessionsForUser(userId, schoolId, reason, revokedAt) {
      let revokedCount = 0;

      for (const [sessionId, session] of sessions.entries()) {
        if (session.userId === userId && session.schoolId === schoolId && session.status === "active") {
          sessions.set(sessionId, {
            ...session,
            status: "revoked",
            revokedAt,
            revokedReason: reason
          });
          revokedCount += 1;
        }
      }

      return revokedCount;
    },
    async updateUserPassword(userId, schoolId, newPasswordHash) {
      const userKey = `${schoolId}:${userId}`;
      const current = usersById.get(userKey);

      if (!current) {
        return;
      }

      const updated = {
        ...current,
        passwordHash: newPasswordHash
      };

      usersById.set(userKey, updated);
      users.set(`${schoolId}:${current.loginIdentifier}`, updated);
    },
    async createPasswordResetRecord(record) {
      passwordResets.set(record.id, record);

      return record;
    },
    async findPasswordResetByTokenHash(tokenHash) {
      for (const reset of passwordResets.values()) {
        if (reset.tokenHash === tokenHash) {
          return reset;
        }
      }

      return null;
    },
    async updatePasswordResetStatus(resetId, status, details) {
      const current = passwordResets.get(resetId);

      if (!current) {
        return;
      }

      passwordResets.set(resetId, {
        ...current,
        status,
        completedAt: details?.completedAt ?? current.completedAt,
        revokedAt: details?.revokedAt ?? current.revokedAt
      });
    }
  };

  return {
    repository,
    sessions,
    passwordResets,
    usersById
  };
}

describe("AuthService", () => {
  it("revokes active sessions when the account is no longer active", async () => {
    const { repository, sessions, usersById } = await createRepository();
    const auditSink = { record: vi.fn() };
    const service = new AuthService({
      repository,
      auditSink,
      sessionTtlMs: 60_000,
      passwordResetTtlMs: 60_000,
      name: "myschoolos_session",
      secure: true,
      sameSite: "lax",
      tokenFactory: createTokenFactory(["session-token-1"])
    });

    const login = await service.login({
      tenantContext: createTenantContext(),
      loginIdentifier: "teacher@example.com",
      password: "initial-password"
    });

    const user = usersById.get("school-123:user-1");

    if (!user) {
      throw new Error("Missing user");
    }

    usersById.set("school-123:user-1", {
      ...user,
      status: "suspended"
    });

    await expect(
      service.validateSession({
        tenantContext: createTenantContext(),
        sessionToken: login.sessionToken
      })
    ).rejects.toMatchObject({
      status: 401,
      code: "auth_session_revoked"
    });

    expect(sessions.get(login.authContext.sessionId)?.status).toBe("revoked");
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "auth.session.validation_failed",
        reason: "user_suspended"
      })
    );
  });

  it("completes a password reset and revokes the user's existing sessions", async () => {
    const { repository, sessions } = await createRepository();
    const auditSink = { record: vi.fn() };
    const service = new AuthService({
      repository,
      auditSink,
      sessionTtlMs: 60_000,
      passwordResetTtlMs: 60_000,
      name: "myschoolos_session",
      secure: true,
      sameSite: "lax",
      tokenFactory: createTokenFactory(["session-token-1", "reset-token-1"])
    });

    const login = await service.login({
      tenantContext: createTenantContext(),
      loginIdentifier: "teacher@example.com",
      password: "initial-password"
    });

    const reset = await service.requestPasswordReset({
      tenantContext: createTenantContext(),
      loginIdentifier: "teacher@example.com"
    });

    expect(reset).toMatchObject({
      requested: true,
      resetToken: "reset-token-1"
    });

    await expect(
      service.completePasswordReset({
        tenantContext: createTenantContext(),
        resetToken: "reset-token-1",
        newPassword: "new-password-123"
      })
    ).resolves.toEqual({
      completed: true
    });

    expect(sessions.get(login.authContext.sessionId)?.status).toBe("revoked");

    await expect(
      service.validateSession({
        tenantContext: createTenantContext(),
        sessionToken: login.sessionToken
      })
    ).rejects.toMatchObject({
      status: 401,
      code: "auth_session_revoked"
    });
  });
});
