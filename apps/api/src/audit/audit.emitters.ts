import type { AuditOutcome, AuditSeverity } from "@myschoolos/shared";
import type { AuditEventInput, AuditService } from "./audit.service.js";

function emit(
  auditService: AuditService,
  input: Omit<AuditEventInput, "severity" | "outcome"> & { readonly severity?: AuditSeverity; readonly outcome?: AuditOutcome }
): ReturnType<AuditService["record"]> {
  return auditService.record({
    ...input,
    severity: input.severity ?? "low",
    outcome: input.outcome ?? "success"
  });
}

export interface AuthAuditEmitters {
  loginSucceeded(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
  loginFailed(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
  logout(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
  sessionCreated(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
  sessionRefreshed(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
  sessionRevoked(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
  passwordResetRequested(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
  passwordResetCompleted(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
}

export interface AuthorizationAuditEmitters {
  permissionDenied(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
}

export interface TenantAuditEmitters {
  resolutionFailed(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
  resolutionConflict(input: Omit<AuditEventInput, "eventName" | "severity" | "outcome">): ReturnType<AuditService["record"]>;
}

export interface SecurityAuditEmitters {
  auth: AuthAuditEmitters;
  authorization: AuthorizationAuditEmitters;
  tenant: TenantAuditEmitters;
}

export function createSecurityAuditEmitters(auditService: AuditService): SecurityAuditEmitters {
  return {
    auth: {
      loginSucceeded: (input) =>
        emit(auditService, {
          ...input,
          eventName: "auth.login.succeeded",
          severity: "low",
          outcome: "success"
        }),
      loginFailed: (input) =>
        emit(auditService, {
          ...input,
          eventName: "auth.login.failed",
          severity: "medium",
          outcome: "failure"
        }),
      logout: (input) =>
        emit(auditService, {
          ...input,
          eventName: "auth.logout",
          severity: "low",
          outcome: "success"
        }),
      sessionCreated: (input) =>
        emit(auditService, {
          ...input,
          eventName: "auth.session.created",
          severity: "low",
          outcome: "success"
        }),
      sessionRefreshed: (input) =>
        emit(auditService, {
          ...input,
          eventName: "auth.session.refreshed",
          severity: "low",
          outcome: "success"
        }),
      sessionRevoked: (input) =>
        emit(auditService, {
          ...input,
          eventName: "auth.session.revoked",
          severity: "medium",
          outcome: "success"
        }),
      passwordResetRequested: (input) =>
        emit(auditService, {
          ...input,
          eventName: "auth.password.reset.requested",
          severity: "medium",
          outcome: "success"
        }),
      passwordResetCompleted: (input) =>
        emit(auditService, {
          ...input,
          eventName: "auth.password.reset.completed",
          severity: "high",
          outcome: "success"
        })
    },
    authorization: {
      permissionDenied: (input) =>
        emit(auditService, {
          ...input,
          eventName: "permission.denied",
          severity: "medium",
          outcome: "failure"
        })
    },
    tenant: {
      resolutionFailed: (input) =>
        emit(auditService, {
          ...input,
          eventName: "tenant.resolution.failed",
          severity: "medium",
          outcome: "failure"
        }),
      resolutionConflict: (input) =>
        emit(auditService, {
          ...input,
          eventName: "tenant.resolution.conflict",
          severity: "high",
          outcome: "failure"
        })
    }
  };
}
