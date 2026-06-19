import { AppError } from "@myschoolos/shared";
import type { PasswordResetId, SessionId } from "@myschoolos/shared";
import type {
  AuthContext,
  AuthServiceOptions,
  CompletePasswordResetInput,
  CompletePasswordResetResult,
  LoginInput,
  LoginResult,
  LogoutInput,
  LogoutResult,
  PasswordResetRecord,
  RequestPasswordResetInput,
  RequestPasswordResetResult,
  ValidateSessionInput,
  ValidateSessionResult
} from "./auth-context.js";
import { createOpaqueToken, createPasswordHash, hashToken, verifyPassword } from "./password.service.js";
import { clearSessionCookie, serializeSessionCookie } from "./session.service.js";

function defaultClock(): Date {
  return new Date();
}

export class AuthService {
  public constructor(private readonly options: AuthServiceOptions) {}

  public async login(input: LoginInput): Promise<LoginResult> {
    const now = this.clock();
    const user = await this.options.repository.findUserByLogin(input.loginIdentifier, input.tenantContext.schoolId);

    if (!user || user.status !== "active" || user.schoolId !== input.tenantContext.schoolId) {
      await this.audit({
        eventName: "auth.login.failed",
        schoolId: input.tenantContext.schoolId,
        outcome: "failure",
        reason: "invalid_credentials",
        details: {
          loginIdentifier: input.loginIdentifier
        }
      });

      throw new AppError("Invalid credentials", {
        status: 401,
        code: "auth_invalid_credentials"
      });
    }

    const passwordVerifier = this.options.passwordVerifier ?? verifyPassword;
    const valid = await passwordVerifier(input.password, user.passwordHash);

    if (!valid) {
      await this.audit({
        eventName: "auth.login.failed",
        schoolId: input.tenantContext.schoolId,
        userId: user.id,
        outcome: "failure",
        reason: "invalid_credentials",
        details: {
          loginIdentifier: input.loginIdentifier
        }
      });

      throw new AppError("Invalid credentials", {
        status: 401,
        code: "auth_invalid_credentials"
      });
    }

    const sessionToken = this.options.tokenFactory?.() ?? createOpaqueToken();
    const expiresAt = new Date(now.getTime() + this.options.sessionTtlMs);
    const sessionRecord = await this.options.repository.createSession({
      id: this.createSessionId(),
      schoolId: input.tenantContext.schoolId,
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      status: "active",
      createdAt: now,
      expiresAt,
      lastRefreshedAt: now
    });

    const authContext = this.toAuthContext(sessionRecord, user.loginIdentifier, user.status);

    await this.audit({
      eventName: "auth.login.succeeded",
      schoolId: input.tenantContext.schoolId,
      userId: user.id,
      sessionId: sessionRecord.id,
      outcome: "success"
    });

    await this.audit({
      eventName: "auth.session.created",
      schoolId: input.tenantContext.schoolId,
      userId: user.id,
      sessionId: sessionRecord.id,
      outcome: "success"
    });

    return {
      authContext,
      sessionToken,
      setCookie: serializeSessionCookie(sessionToken, this.options, this.options.sessionTtlMs / 1000)
    };
  }

  public async validateSession(input: ValidateSessionInput): Promise<ValidateSessionResult> {
    const now = this.clock();
    const session = await this.options.repository.findSessionByTokenHash(hashToken(input.sessionToken));

    if (!session || session.schoolId !== input.tenantContext.schoolId) {
      await this.audit({
        eventName: "auth.session.validation_failed",
        schoolId: input.tenantContext.schoolId,
        outcome: "failure",
        reason: !session ? "session_not_found" : "tenant_mismatch"
      });

      throw new AppError("Authentication required", {
        status: 401,
        code: "auth_session_invalid"
      });
    }

    if (session.status !== "active") {
      await this.audit({
        eventName: "auth.session.validation_failed",
        schoolId: input.tenantContext.schoolId,
        userId: session.userId,
        sessionId: session.id,
        outcome: "failure",
        reason: session.status
      });

      throw new AppError("Authentication required", {
        status: 401,
        code: session.status === "revoked" ? "auth_session_revoked" : "auth_session_expired"
      });
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      await this.options.repository.updateSessionStatus(session.id, "expired", {
        lastRefreshedAt: session.lastRefreshedAt
      });
      await this.audit({
        eventName: "auth.session.validation_failed",
        schoolId: input.tenantContext.schoolId,
        userId: session.userId,
        sessionId: session.id,
        outcome: "failure",
        reason: "expired"
      });

      throw new AppError("Authentication required", {
        status: 401,
        code: "auth_session_expired"
      });
    }

    const user = await this.options.repository.findUserById(session.userId, session.schoolId);

    if (!user) {
      await this.options.repository.updateSessionStatus(session.id, "revoked", {
        revokedAt: now,
        revokedReason: "user_not_found"
      });
      await this.options.repository.revokeSessionsForUser(session.userId, session.schoolId, "user_not_found", now);
      await this.audit({
        eventName: "auth.session.validation_failed",
        schoolId: input.tenantContext.schoolId,
        userId: session.userId,
        sessionId: session.id,
        outcome: "failure",
        reason: "user_not_found"
      });

      throw new AppError("Authentication required", {
        status: 401,
        code: "auth_session_invalid"
      });
    }

    if (user.status !== "active") {
      await this.options.repository.updateSessionStatus(session.id, "revoked", {
        revokedAt: now,
        revokedReason: `user_${user.status}`
      });
      await this.options.repository.revokeSessionsForUser(user.id, session.schoolId, `user_${user.status}`, now);
      await this.audit({
        eventName: "auth.session.validation_failed",
        schoolId: input.tenantContext.schoolId,
        userId: session.userId,
        sessionId: session.id,
        outcome: "failure",
        reason: `user_${user.status}`
      });

      throw new AppError("Authentication required", {
        status: 401,
        code: "auth_session_revoked"
      });
    }

    return {
      authContext: this.toAuthContext(session, user.loginIdentifier, user.status)
    };
  }

  public async refreshSession(input: ValidateSessionInput): Promise<LoginResult> {
    const now = this.clock();
    const validation = await this.validateSession(input);
    const session = await this.options.repository.findSessionByTokenHash(hashToken(input.sessionToken));

    if (!session) {
      throw new AppError("Authentication required", {
        status: 401,
        code: "auth_session_invalid"
      });
    }

    const refreshedToken = this.options.tokenFactory?.() ?? createOpaqueToken();
    const refreshedExpiresAt = new Date(now.getTime() + this.options.sessionTtlMs);

    await this.options.repository.updateSessionStatus(session.id, "active", {
      lastRefreshedAt: now,
      expiresAt: refreshedExpiresAt,
      tokenHash: hashToken(refreshedToken)
    });

    await this.audit({
      eventName: "auth.session.refreshed",
      schoolId: input.tenantContext.schoolId,
      userId: validation.authContext.userId,
      sessionId: session.id,
      outcome: "success"
    });

    return {
      authContext: {
        ...validation.authContext,
        expiresAt: refreshedExpiresAt
      },
      sessionToken: refreshedToken,
      setCookie: serializeSessionCookie(refreshedToken, this.options, this.options.sessionTtlMs / 1000)
    };
  }

  public async logout(input: LogoutInput): Promise<LogoutResult> {
    const session = await this.options.repository.findSessionByTokenHash(hashToken(input.sessionToken));

    if (!session || session.schoolId !== input.tenantContext.schoolId) {
      await this.audit({
        eventName: "auth.logout",
        schoolId: input.tenantContext.schoolId,
        outcome: "failure",
        reason: !session ? "session_not_found" : "tenant_mismatch"
      });

      return {
        revoked: false,
        clearCookie: clearSessionCookie(this.options)
      };
    }

    if (session.status !== "active") {
      await this.audit({
        eventName: "auth.logout",
        schoolId: input.tenantContext.schoolId,
        userId: session.userId,
        sessionId: session.id,
        outcome: "failure",
        reason: session.status
      });

      return {
        revoked: false,
        clearCookie: clearSessionCookie(this.options)
      };
    }

    await this.options.repository.updateSessionStatus(session.id, "revoked", {
      revokedAt: this.clock(),
      revokedReason: input.reason ?? "logout"
    });

    await this.audit({
      eventName: "auth.logout",
      schoolId: input.tenantContext.schoolId,
      userId: session.userId,
      sessionId: session.id,
      outcome: "success",
      reason: input.reason ?? "logout"
    });

    await this.audit({
      eventName: "auth.session.revoked",
      schoolId: input.tenantContext.schoolId,
      userId: session.userId,
      sessionId: session.id,
      outcome: "success",
      reason: input.reason ?? "logout"
    });

    return {
      revoked: true,
      clearCookie: clearSessionCookie(this.options)
    };
  }

  public async revokeSession(sessionToken: string, tenantSchoolId: string, reason: string): Promise<boolean> {
    const session = await this.options.repository.findSessionByTokenHash(hashToken(sessionToken));

    if (!session || session.schoolId !== tenantSchoolId || session.status !== "active") {
      return false;
    }

    await this.options.repository.updateSessionStatus(session.id, "revoked", {
      revokedAt: this.clock(),
      revokedReason: reason
    });

    await this.audit({
      eventName: "auth.session.revoked",
      schoolId: tenantSchoolId,
      userId: session.userId,
      sessionId: session.id,
      outcome: "success",
      reason
    });

    return true;
  }

  public async requestPasswordReset(input: RequestPasswordResetInput): Promise<RequestPasswordResetResult> {
    const now = this.clock();
    const user = await this.options.repository.findUserByLogin(input.loginIdentifier, input.tenantContext.schoolId);

    if (!user || user.status !== "active") {
      await this.audit({
        eventName: "user.password_reset_requested",
        schoolId: input.tenantContext.schoolId,
        outcome: "failure",
        reason: "user_not_found",
        details: {
          loginIdentifier: input.loginIdentifier
        }
      });

      return {
        requested: false
      };
    }

    const resetToken = this.options.tokenFactory?.() ?? createOpaqueToken();
    const expiresAt = new Date(now.getTime() + this.options.passwordResetTtlMs);
    const resetRecord: PasswordResetRecord = {
      id: this.createResetId(),
      schoolId: input.tenantContext.schoolId,
      userId: user.id,
      tokenHash: hashToken(resetToken),
      status: "pending",
      requestedAt: now,
      expiresAt
    };

    await this.options.repository.createPasswordResetRecord(resetRecord);

    await this.audit({
      eventName: "user.password_reset_requested",
      schoolId: input.tenantContext.schoolId,
      userId: user.id,
      resetId: resetRecord.id,
      outcome: "success"
    });

    return {
      requested: true,
      resetToken,
      expiresAt
    };
  }

  public async completePasswordReset(input: CompletePasswordResetInput): Promise<CompletePasswordResetResult> {
    const resetRecord = await this.options.repository.findPasswordResetByTokenHash(hashToken(input.resetToken));

    if (!resetRecord || resetRecord.schoolId !== input.tenantContext.schoolId || resetRecord.status !== "pending") {
      await this.audit({
        eventName: "user.password_reset_completed",
        schoolId: input.tenantContext.schoolId,
        outcome: "failure",
        reason: !resetRecord ? "token_not_found" : resetRecord.schoolId !== input.tenantContext.schoolId ? "tenant_mismatch" : resetRecord.status
      });

      throw new AppError("Password reset token is invalid", {
        status: 400,
        code: "password_reset_invalid"
      });
    }

    const now = this.clock();

    if (resetRecord.expiresAt.getTime() <= now.getTime()) {
      await this.options.repository.updatePasswordResetStatus(resetRecord.id, "expired", {
        revokedAt: now
      });
      await this.audit({
        eventName: "user.password_reset_completed",
        schoolId: input.tenantContext.schoolId,
        userId: resetRecord.userId,
        resetId: resetRecord.id,
        outcome: "failure",
        reason: "expired"
      });

      throw new AppError("Password reset token is expired", {
        status: 400,
        code: "password_reset_expired"
      });
    }

    const newPasswordHash = await (this.options.passwordHasher ?? createPasswordHash)(input.newPassword);
    await this.options.repository.updateUserPassword(resetRecord.userId, resetRecord.schoolId, newPasswordHash);
    await this.options.repository.updatePasswordResetStatus(resetRecord.id, "completed", {
      completedAt: now
    });
    await this.options.repository.revokeSessionsForUser(resetRecord.userId, resetRecord.schoolId, "password_reset", now);

    await this.audit({
      eventName: "user.password_reset_completed",
      schoolId: resetRecord.schoolId,
      userId: resetRecord.userId,
      resetId: resetRecord.id,
      outcome: "success"
    });

    await this.audit({
      eventName: "auth.session.revoked",
      schoolId: resetRecord.schoolId,
      userId: resetRecord.userId,
      outcome: "success",
      reason: "password_reset"
    });

    return {
      completed: true
    };
  }

  private toAuthContext(session: { id: { toString(): string }; userId: string; schoolId: string; expiresAt: Date }, loginIdentifier: string, userStatus: AuthContext["userStatus"]): AuthContext {
    return {
      sessionId: session.id as SessionId,
      userId: session.userId,
      schoolId: session.schoolId,
      expiresAt: session.expiresAt,
      loginIdentifier,
      userStatus
    };
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private createSessionId(): AuthContext["sessionId"] {
    return this.createBrandId("session") as SessionId;
  }

  private createResetId(): PasswordResetId {
    return this.createBrandId("reset") as PasswordResetId;
  }

  private createBrandId(prefix: string): string {
    return `${prefix}_${createOpaqueToken(12)}`;
  }

  private async audit(event: Parameters<NonNullable<AuthServiceOptions["auditSink"]>["record"]>[0]): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
