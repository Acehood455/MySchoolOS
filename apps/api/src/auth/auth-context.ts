import type { FastifyRequest } from "fastify";
import type {
  AuthCookieSettings,
  AuthSessionContext,
  PasswordResetContext,
  PasswordResetId,
  SessionId,
  SessionStatus
} from "@myschoolos/shared";
import type { TenantContext } from "../tenant/tenant-context.js";

export interface AuthUserRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly loginIdentifier: string;
  readonly passwordHash: string;
  readonly status: "active" | "suspended" | "deactivated" | "archived";
}

export interface SessionRecord {
  readonly id: SessionId;
  readonly schoolId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly status: SessionStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt?: Date;
  readonly revokedReason?: string;
  readonly lastRefreshedAt?: Date;
}

export interface PasswordResetRecord {
  readonly id: PasswordResetId;
  readonly schoolId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly status: "pending" | "completed" | "revoked" | "expired";
  readonly requestedAt: Date;
  readonly expiresAt: Date;
  readonly completedAt?: Date;
  readonly revokedAt?: Date;
}

export interface AuthContext extends AuthSessionContext {
  readonly loginIdentifier: string;
  readonly userStatus: AuthUserRecord["status"];
}

export interface AuthAuditEvent {
  readonly eventName:
    | "auth.login.succeeded"
    | "auth.login.failed"
    | "auth.logout"
    | "auth.session.created"
    | "auth.session.refreshed"
    | "auth.session.revoked"
    | "auth.session.validation_failed"
    | "user.password_reset_requested"
    | "user.password_reset_completed";
  readonly schoolId: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly resetId?: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly details?: Record<string, unknown>;
}

export interface LoginAttemptState {
  readonly failedCount: number;
  readonly windowStartedAt: number;
  readonly lockedUntil?: number;
}

export interface AuthAuditSink {
  record(event: AuthAuditEvent): Promise<void> | void;
}

export interface AuthRepository {
  findUserByLogin(loginIdentifier: string, schoolId: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string, schoolId: string): Promise<AuthUserRecord | null>;
  createSession(record: SessionRecord): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  updateSessionStatus(
    sessionId: SessionId,
    status: SessionStatus,
    details?: { revokedAt?: Date; revokedReason?: string; lastRefreshedAt?: Date; expiresAt?: Date; tokenHash?: string }
  ): Promise<void>;
  revokeSessionsForUser(userId: string, schoolId: string, reason: string, revokedAt: Date): Promise<number>;
  updateUserPassword(userId: string, schoolId: string, passwordHash: string): Promise<void>;
  createPasswordResetRecord(record: PasswordResetRecord): Promise<PasswordResetRecord>;
  findPasswordResetByTokenHash(tokenHash: string): Promise<PasswordResetRecord | null>;
  updatePasswordResetStatus(resetId: PasswordResetId, status: PasswordResetRecord["status"], details?: { completedAt?: Date; revokedAt?: Date }): Promise<void>;
}

export interface AuthServiceOptions extends AuthCookieSettings {
  readonly repository: AuthRepository;
  readonly auditSink?: AuthAuditSink;
  readonly sessionTtlMs: number;
  readonly passwordResetTtlMs: number;
  readonly loginFailureThreshold?: number;
  readonly loginFailureWindowMs?: number;
  readonly loginLockoutMs?: number;
  readonly csrfCookieName?: string;
  readonly clock?: () => Date;
  readonly tokenFactory?: () => string;
  readonly passwordHasher?: (password: string) => Promise<string>;
  readonly passwordVerifier?: (password: string, passwordHash: string) => Promise<boolean>;
}

export interface LoginInput {
  readonly tenantContext: TenantContext;
  readonly loginIdentifier: string;
  readonly password: string;
  readonly priorSessionToken?: string | null;
}

export interface LoginResult {
  readonly authContext: AuthContext;
  readonly sessionToken: string;
  readonly setCookie: string;
  readonly csrfToken: string;
  readonly setCsrfCookie: string;
}

export interface ValidateSessionInput {
  readonly tenantContext: TenantContext;
  readonly sessionToken: string;
}

export interface ValidateSessionResult {
  readonly authContext: AuthContext;
}

export interface RefreshSessionResult extends LoginResult {}

export interface LogoutInput {
  readonly tenantContext: TenantContext;
  readonly sessionToken: string;
  readonly reason?: string;
}

export interface LogoutResult {
  readonly revoked: boolean;
  readonly clearCookie: string;
  readonly clearCsrfCookie: string;
}

export interface RequestPasswordResetInput {
  readonly tenantContext: TenantContext;
  readonly loginIdentifier: string;
}

export interface RequestPasswordResetResult {
  readonly requested: boolean;
  readonly resetToken?: string;
  readonly expiresAt?: Date;
}

export interface CompletePasswordResetInput {
  readonly tenantContext: TenantContext;
  readonly resetToken: string;
  readonly newPassword: string;
}

export interface CompletePasswordResetResult {
  readonly completed: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    authContext: AuthContext | null;
  }
}

export function hasAuthContext(request: FastifyRequest): request is FastifyRequest & { authContext: AuthContext } {
  return request.authContext !== null;
}
