import fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerAuthRoutes } from "./auth.routes.js";
import { AuthService } from "./auth.service.js";
import type { AuthRepository, AuthUserRecord, PasswordResetRecord, SessionRecord } from "./auth-context.js";
import { registerFoundationPlugin } from "../foundation/foundation.plugin.js";
import { createPasswordHash } from "./password.service.js";

function createTenantContext() {
  return {
    schoolId: "school-123",
    host: "alpha.example.com",
    resolvedBy: "verified_custom_domain" as const,
    schoolDomainId: "domain-1"
  };
}

function getSetCookieHeader(headers: Record<string, unknown>): string {
  const value = headers["set-cookie"];

  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }

  return String(value ?? "");
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
  const user: AuthUserRecord = {
    id: "user-1",
    schoolId: "school-123",
    loginIdentifier: "teacher@example.com",
    passwordHash,
    status: "active"
  };
  const users = new Map<string, AuthUserRecord>([["school-123:teacher@example.com", user]]);
  const usersById = new Map<string, AuthUserRecord>([["school-123:user-1", user]]);
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
      const current = usersById.get(`${schoolId}:${userId}`);

      if (!current) {
        return;
      }

      const updated = {
        ...current,
        passwordHash: newPasswordHash
      };

      usersById.set(`${schoolId}:${userId}`, updated);
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
    repository
  };
}

describe("auth routes", () => {
  it("logs in, validates the cookie-backed session, and logs out", async () => {
    const { repository } = await createRepository();
    const service = new AuthService({
      repository,
      sessionTtlMs: 60_000,
      passwordResetTtlMs: 60_000,
      name: "myschoolos_session",
      secure: true,
      sameSite: "lax",
      tokenFactory: createTokenFactory(["session-token-1", "csrf-token-1"])
    });
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve() {
          return createTenantContext();
        }
      },
      authService: service,
      cookieName: "myschoolos_session"
    });
    await registerAuthRoutes(app, {
      authService: service,
      cookieName: "myschoolos_session"
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        host: "alpha.example.com"
      },
      payload: {
        loginIdentifier: "teacher@example.com",
        password: "initial-password"
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toMatchObject({
      authContext: {
        userId: "user-1",
        schoolId: "school-123",
        loginIdentifier: "teacher@example.com"
      },
      csrfToken: "csrf-token-1"
    });
    expect(getSetCookieHeader(loginResponse.headers)).toContain("HttpOnly");
    expect(getSetCookieHeader(loginResponse.headers)).toContain("Secure");

    const sessionResponse = await app.inject({
      method: "GET",
      url: "/auth/session",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-token-1"
      }
    });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json()).toMatchObject({
      authenticated: true,
      authContext: {
        userId: "user-1",
        schoolId: "school-123"
      }
    });

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-token-1; myschoolos_csrf=csrf-token-1",
        "x-csrf-token": "csrf-token-1"
      },
      payload: {
        reason: "logout"
      }
    });

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.json()).toEqual({
      revoked: true
    });
    expect(getSetCookieHeader(logoutResponse.headers)).toContain("Max-Age=0");

    const revokedResponse = await app.inject({
      method: "GET",
      url: "/auth/session",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-token-1"
      }
    });

    expect(revokedResponse.statusCode).toBe(401);
    expect(revokedResponse.json()).toMatchObject({
      code: "auth_session_revoked"
    });
  });

  it("completes the password reset workflow and invalidates the prior session", async () => {
    const { repository } = await createRepository();
    const service = new AuthService({
      repository,
      sessionTtlMs: 60_000,
      passwordResetTtlMs: 60_000,
      name: "myschoolos_session",
      secure: true,
      sameSite: "lax",
      tokenFactory: createTokenFactory(["session-token-1", "csrf-token-1", "reset-token-1"])
    });
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve() {
          return createTenantContext();
        }
      },
      authService: service,
      cookieName: "myschoolos_session"
    });
    await registerAuthRoutes(app, {
      authService: service,
      cookieName: "myschoolos_session"
    });

    await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        host: "alpha.example.com"
      },
      payload: {
        loginIdentifier: "teacher@example.com",
        password: "initial-password"
      }
    });

    const resetResponse = await app.inject({
      method: "POST",
      url: "/auth/password-reset/request",
      headers: {
        host: "alpha.example.com"
      },
      payload: {
        loginIdentifier: "teacher@example.com"
      }
    });

    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.json()).toMatchObject({
      requested: true,
      resetToken: "reset-token-1"
    });

    const completeResponse = await app.inject({
      method: "POST",
      url: "/auth/password-reset/complete",
      headers: {
        host: "alpha.example.com"
      },
      payload: {
        resetToken: "reset-token-1",
        newPassword: "new-password-123"
      }
    });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json()).toEqual({
      completed: true
    });

    const revokedResponse = await app.inject({
      method: "GET",
      url: "/auth/session",
      headers: {
        host: "alpha.example.com",
        cookie: "myschoolos_session=session-token-1"
      }
    });

    expect(revokedResponse.statusCode).toBe(401);
    expect(revokedResponse.json()).toMatchObject({
      code: "auth_session_revoked"
    });
  });

  it("throttles repeated login attempts at the route boundary", async () => {
    const { repository } = await createRepository();
    const service = new AuthService({
      repository,
      sessionTtlMs: 60_000,
      passwordResetTtlMs: 60_000,
      name: "myschoolos_session",
      secure: true,
      sameSite: "lax",
      tokenFactory: createTokenFactory([])
    });
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve() {
          return createTenantContext();
        }
      },
      authService: service,
      cookieName: "myschoolos_session"
    });
    await registerAuthRoutes(app, {
      authService: service,
      cookieName: "myschoolos_session"
    });

    for (let index = 0; index < 5; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        headers: {
          host: "alpha.example.com"
        },
        payload: {
          loginIdentifier: `missing-${index}@example.com`,
          password: "wrong-password"
        }
      });

      expect(response.statusCode).toBe(401);
    }

    const throttledResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        host: "alpha.example.com"
      },
      payload: {
        loginIdentifier: "missing-5@example.com",
        password: "wrong-password"
      }
    });

    expect(throttledResponse.statusCode).toBe(429);
    expect(throttledResponse.json()).toMatchObject({
      code: "rate_limited"
    });
  });

  it("throttles repeated password reset requests at the route boundary", async () => {
    const { repository } = await createRepository();
    const service = new AuthService({
      repository,
      sessionTtlMs: 60_000,
      passwordResetTtlMs: 60_000,
      name: "myschoolos_session",
      secure: true,
      sameSite: "lax",
      tokenFactory: createTokenFactory([])
    });
    const app = fastify();

    await registerFoundationPlugin(app, {
      tenantResolver: {
        async resolve() {
          return createTenantContext();
        }
      },
      authService: service,
      cookieName: "myschoolos_session"
    });
    await registerAuthRoutes(app, {
      authService: service,
      cookieName: "myschoolos_session"
    });

    for (let index = 0; index < 6; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/auth/password-reset/request",
        headers: {
          host: "alpha.example.com"
        },
        payload: {
          loginIdentifier: `missing-${index}@example.com`
        }
      });

      expect(response.statusCode).toBe(200);
    }

    const throttledResponse = await app.inject({
      method: "POST",
      url: "/auth/password-reset/request",
      headers: {
        host: "alpha.example.com"
      },
      payload: {
        loginIdentifier: "missing-6@example.com"
      }
    });

    expect(throttledResponse.statusCode).toBe(429);
    expect(throttledResponse.json()).toMatchObject({
      code: "rate_limited"
    });
  });
});
