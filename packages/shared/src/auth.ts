declare const sessionIdBrand: unique symbol;
declare const passwordResetIdBrand: unique symbol;

export type SessionId = string & { readonly [sessionIdBrand]: "SessionId" };
export type PasswordResetId = string & { readonly [passwordResetIdBrand]: "PasswordResetId" };

export type SessionStatus = "active" | "revoked" | "expired";
export type PasswordResetStatus = "pending" | "completed" | "revoked" | "expired";

export interface AuthSessionContext {
  readonly sessionId: SessionId;
  readonly userId: string;
  readonly schoolId: string;
  readonly expiresAt: Date;
}

export interface PasswordResetContext {
  readonly resetId: PasswordResetId;
  readonly userId: string;
  readonly schoolId: string;
  readonly expiresAt: Date;
}

export interface AuthCookieSettings {
  readonly name: string;
  readonly domain?: string;
  readonly secure: boolean;
  readonly sameSite?: "lax" | "strict" | "none";
  readonly path?: string;
}

