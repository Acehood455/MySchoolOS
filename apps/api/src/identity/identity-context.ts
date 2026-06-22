import type { CanonicalRole, RoleAssignmentRecord } from "@myschoolos/shared";
import type { SchoolActorContext } from "../school/school-context.js";

export type IdentityUserStatus = "invited" | "active" | "suspended" | "deactivated" | "archived";
export type IdentityInvitationStatus = "pending" | "sent" | "revoked" | "expired" | "accepted";

export interface IdentityUserRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly loginIdentifier: string;
  readonly displayName: string;
  readonly status: IdentityUserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly invitedAt?: Date;
  readonly activatedAt?: Date;
  readonly suspendedAt?: Date;
  readonly deactivatedAt?: Date;
  readonly archivedAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IdentityInvitationRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly userId: string;
  readonly loginIdentifier: string;
  readonly tokenHash: string;
  readonly status: IdentityInvitationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly sentAt: Date;
  readonly resendCount: number;
  readonly expiresAt: Date;
  readonly lastSentAt?: Date;
  readonly acceptedAt?: Date;
  readonly revokedAt?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IdentityAuditEvent {
  readonly eventName:
    | "user.created"
    | "user.invited"
    | "user.activated"
    | "user.suspended"
    | "user.deactivated"
    | "role.assigned"
    | "role.revoked";
  readonly actorId: string;
  readonly schoolId: string;
  readonly resourceType: "User" | "Invitation" | "RoleAssignment";
  readonly resourceId: string;
  readonly outcome: "success" | "failure";
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface IdentityAuditSink {
  record(event: IdentityAuditEvent): Promise<void> | void;
}

export interface IdentityActorContext extends SchoolActorContext {
  readonly roles: readonly CanonicalRole[];
}

export interface IdentityRoleAssignmentRecord extends RoleAssignmentRecord {
  readonly metadata?: Readonly<Record<string, unknown>>;
}
