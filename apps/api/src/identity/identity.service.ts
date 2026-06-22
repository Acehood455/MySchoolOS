import { AppError, type CanonicalRole } from "@myschoolos/shared";
import { createOpaqueToken, hashToken } from "../auth/password.service.js";
import type { SchoolActorContext } from "../school/school-context.js";
import type {
  IdentityAuditSink,
  IdentityInvitationRecord,
  IdentityRoleAssignmentRecord,
  IdentityUserRecord
} from "./identity-context.js";
import type { IdentityRepository } from "./identity.repository.js";

export interface IdentityServiceOptions {
  readonly repository: IdentityRepository;
  readonly auditSink?: IdentityAuditSink;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
  readonly invitationTokenFactory?: () => string;
  readonly invitationTtlMs?: number;
  readonly sessionRevoker?: (userId: string, schoolId: string, reason: string) => Promise<void> | void;
}

export interface CreateUserInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly loginIdentifier: string;
  readonly displayName: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface InviteUserInput extends CreateUserInput {}

export interface ResendInvitationInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly invitationId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UserLifecycleInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly userId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AssignRoleInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly userId: string;
  readonly canonicalRole: CanonicalRole;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RemoveRoleInput {
  readonly actor: SchoolActorContext;
  readonly schoolId: string;
  readonly userId: string;
  readonly canonicalRole: CanonicalRole;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface InviteUserResult {
  readonly user: IdentityUserRecord;
  readonly invitation: IdentityInvitationRecord;
  readonly invitationToken: string;
}

export interface ResendInvitationResult {
  readonly invitation: IdentityInvitationRecord;
  readonly invitationToken: string;
}

function defaultClock(): Date {
  return new Date();
}

function defaultIdFactory(): string {
  return `identity_${createOpaqueToken(10)}`;
}

function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

function normalizeLoginIdentifier(loginIdentifier: string): string {
  return loginIdentifier.trim().toLowerCase();
}

function hasRole(actor: SchoolActorContext, role: CanonicalRole): boolean {
  return actor.roles.includes(role);
}

function canManageSchool(actor: SchoolActorContext, schoolId: string): boolean {
  return hasRole(actor, "super_admin") || (hasRole(actor, "school_admin") && actor.schoolId === schoolId);
}

function requirePermission(
  actor: SchoolActorContext,
  allowed: boolean,
  eventName: string,
  resourceType: "User" | "Invitation" | "RoleAssignment",
  resourceId: string
): void {
  if (allowed) {
    return;
  }

  throw new AppError("Permission denied", {
    status: 403,
    code: "permission_denied",
    details: {
      eventName,
      resourceType,
      resourceId,
      actorId: actor.actorId
    }
  });
}

function assertSchoolAccessible(actor: SchoolActorContext, schoolId: string): void {
  requirePermission(actor, canManageSchool(actor, schoolId), "school.access", "User", schoolId);
}

function assertRoleAssignable(canonicalRole: CanonicalRole): void {
  if (canonicalRole === "super_admin") {
    throw new AppError("Super admin role is not tenant assignable", {
      status: 400,
      code: "identity_role_invalid"
    });
  }
}

function sortRoleAssignments(assignments: readonly IdentityRoleAssignmentRecord[]): IdentityRoleAssignmentRecord[] {
  return [...assignments].sort((left, right) => {
    if (left.userId !== right.userId) {
      return left.userId.localeCompare(right.userId);
    }

    if (left.canonicalRole !== right.canonicalRole) {
      return left.canonicalRole.localeCompare(right.canonicalRole);
    }

    return left.id.localeCompare(right.id);
  });
}

export class IdentityService {
  public constructor(private readonly options: IdentityServiceOptions) {}

  public async createUser(input: CreateUserInput): Promise<IdentityUserRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);

    const loginIdentifier = normalizeLoginIdentifier(input.loginIdentifier);
    const existing = await this.options.repository.findUserByLogin(loginIdentifier, input.schoolId);

    if (existing) {
      throw new AppError("User already exists", {
        status: 409,
        code: "identity_user_conflict"
      });
    }

    const now = this.clock();
    const user: IdentityUserRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      loginIdentifier,
      displayName: input.displayName.trim(),
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      activatedAt: now,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createUser(user);

    await this.audit({
      eventName: "user.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "User",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        loginIdentifier: created.loginIdentifier,
        status: created.status
      }
    });

    return created;
  }

  public async inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
    assertSchoolAccessible(input.actor, input.schoolId);

    const loginIdentifier = normalizeLoginIdentifier(input.loginIdentifier);
    const existing = await this.options.repository.findUserByLogin(loginIdentifier, input.schoolId);

    if (existing) {
      throw new AppError("User already exists", {
        status: 409,
        code: "identity_user_conflict"
      });
    }

    const now = this.clock();
    const user: IdentityUserRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      loginIdentifier,
      displayName: input.displayName.trim(),
      status: "invited",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      invitedAt: now,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createUser(user);
    const invitationToken = this.options.invitationTokenFactory?.() ?? createOpaqueToken();
    const invitation: IdentityInvitationRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      userId: created.id,
      loginIdentifier: created.loginIdentifier,
      tokenHash: hashToken(invitationToken),
      status: "sent",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.actorId,
      sentAt: now,
      resendCount: 0,
      expiresAt: new Date(now.getTime() + (this.options.invitationTtlMs ?? 7 * 24 * 60 * 60_000)),
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const storedInvitation = await this.options.repository.createInvitation(invitation);

    await this.audit({
      eventName: "user.created",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "User",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        loginIdentifier: created.loginIdentifier,
        status: created.status
      }
    });

    await this.audit({
      eventName: "user.invited",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Invitation",
      resourceId: storedInvitation.id,
      outcome: "success",
      metadata: {
        userId: created.id,
        loginIdentifier: created.loginIdentifier
      }
    });

    return {
      user: created,
      invitation: storedInvitation,
      invitationToken
    };
  }

  public async resendInvitation(input: ResendInvitationInput): Promise<ResendInvitationResult> {
    assertSchoolAccessible(input.actor, input.schoolId);

    const current = await this.mustFindInvitation(input.schoolId, input.invitationId);

    if (current.status === "accepted") {
      throw new AppError("Invitation has already been accepted", {
        status: 409,
        code: "identity_invitation_invalid"
      });
    }

    const now = this.clock();
    const invitationToken = this.options.invitationTokenFactory?.() ?? createOpaqueToken();
    const updated = await this.options.repository.updateInvitation(current.id, {
      tokenHash: hashToken(invitationToken),
      status: "sent",
      sentAt: now,
      lastSentAt: now,
      resendCount: current.resendCount + 1,
      updatedAt: now,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata
    });

    if (!updated) {
      throw new AppError("Invitation not found", {
        status: 404,
        code: "identity_invitation_not_found"
      });
    }

    await this.audit({
      eventName: "user.invited",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "Invitation",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        userId: updated.userId,
        loginIdentifier: updated.loginIdentifier,
        resent: true,
        resendCount: updated.resendCount
      }
    });

    return {
      invitation: updated,
      invitationToken
    };
  }

  public async deactivateUser(input: UserLifecycleInput): Promise<IdentityUserRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    const current = await this.mustFindUser(input.schoolId, input.userId);

    if (current.status !== "active" && current.status !== "suspended") {
      throw new AppError("User cannot be deactivated from the current state", {
        status: 409,
        code: "identity_user_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "deactivated"
        }
      });
    }

    const now = this.clock();
    await this.options.sessionRevoker?.(current.id, current.schoolId, "user_deactivated");

    const updated = await this.options.repository.updateUser(current.id, current.schoolId, {
      status: "deactivated",
      deactivatedAt: now,
      updatedAt: now,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata
    });

    if (!updated) {
      throw new AppError("User not found", {
        status: 404,
        code: "identity_user_not_found"
      });
    }

    await this.audit({
      eventName: "user.deactivated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "User",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async suspendUser(input: UserLifecycleInput): Promise<IdentityUserRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    const current = await this.mustFindUser(input.schoolId, input.userId);

    if (current.status !== "active") {
      throw new AppError("User cannot be suspended from the current state", {
        status: 409,
        code: "identity_user_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "suspended"
        }
      });
    }

    const now = this.clock();
    await this.options.sessionRevoker?.(current.id, current.schoolId, "user_suspended");

    const updated = await this.options.repository.updateUser(current.id, current.schoolId, {
      status: "suspended",
      suspendedAt: now,
      updatedAt: now,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata
    });

    if (!updated) {
      throw new AppError("User not found", {
        status: 404,
        code: "identity_user_not_found"
      });
    }

    await this.audit({
      eventName: "user.suspended",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "User",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async reactivateUser(input: UserLifecycleInput): Promise<IdentityUserRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    const current = await this.mustFindUser(input.schoolId, input.userId);

    if (current.status !== "suspended") {
      throw new AppError("User cannot be reactivated from the current state", {
        status: 409,
        code: "identity_user_lifecycle_invalid_transition",
        details: {
          currentStatus: current.status,
          requestedStatus: "active"
        }
      });
    }

    const now = this.clock();
    const updated = await this.options.repository.updateUser(current.id, current.schoolId, {
      status: "active",
      activatedAt: now,
      updatedAt: now,
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata
    });

    if (!updated) {
      throw new AppError("User not found", {
        status: 404,
        code: "identity_user_not_found"
      });
    }

    await this.audit({
      eventName: "user.activated",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "User",
      resourceId: updated.id,
      outcome: "success"
    });

    return updated;
  }

  public async assignRole(input: AssignRoleInput): Promise<IdentityRoleAssignmentRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    assertRoleAssignable(input.canonicalRole);
    const user = await this.mustFindUser(input.schoolId, input.userId);
    const existing = await this.options.repository.findRoleAssignmentByUserAndRole(input.schoolId, input.userId, input.canonicalRole);

    if (existing && existing.status === "active") {
      throw new AppError("Role assignment already exists", {
        status: 409,
        code: "identity_role_assignment_conflict"
      });
    }

    const now = this.clock();
    const assignment: IdentityRoleAssignmentRecord = {
      id: this.idFactory(),
      schoolId: input.schoolId,
      userId: user.id,
      canonicalRole: input.canonicalRole,
      status: "active",
      assignedAt: now,
      metadata: input.metadata ? cloneRecord(input.metadata) : undefined
    };

    const created = await this.options.repository.createRoleAssignment(assignment);

    await this.audit({
      eventName: "role.assigned",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "RoleAssignment",
      resourceId: created.id,
      outcome: "success",
      metadata: {
        userId: created.userId,
        canonicalRole: created.canonicalRole
      }
    });

    return created;
  }

  public async removeRole(input: RemoveRoleInput): Promise<IdentityRoleAssignmentRecord> {
    assertSchoolAccessible(input.actor, input.schoolId);
    assertRoleAssignable(input.canonicalRole);
    const current = await this.mustFindRoleAssignment(input.schoolId, input.userId, input.canonicalRole);

    if (current.status !== "active") {
      return current;
    }

    const now = this.clock();
    const updated = await this.options.repository.updateRoleAssignment(current.id, {
      status: "revoked",
      revokedAt: now,
      revokedReason: "manual_removal",
      metadata: input.metadata ? cloneRecord(input.metadata) : current.metadata
    });

    if (!updated) {
      throw new AppError("Role assignment not found", {
        status: 404,
        code: "identity_role_assignment_not_found"
      });
    }

    await this.audit({
      eventName: "role.revoked",
      actorId: input.actor.actorId,
      schoolId: input.schoolId,
      resourceType: "RoleAssignment",
      resourceId: updated.id,
      outcome: "success",
      metadata: {
        userId: updated.userId,
        canonicalRole: updated.canonicalRole
      }
    });

    return updated;
  }

  public async listRoleAssignments(actor: SchoolActorContext, schoolId: string): Promise<readonly IdentityRoleAssignmentRecord[]> {
    assertSchoolAccessible(actor, schoolId);
    const assignments = await this.options.repository.findRoleAssignmentsBySchoolId(schoolId);
    return sortRoleAssignments(assignments);
  }

  private async mustFindUser(schoolId: string, userId: string): Promise<IdentityUserRecord> {
    const user = await this.options.repository.findUserById(userId, schoolId);

    if (!user) {
      throw new AppError("User not found", {
        status: 404,
        code: "identity_user_not_found"
      });
    }

    return user;
  }

  private async mustFindInvitation(schoolId: string, invitationId: string): Promise<IdentityInvitationRecord> {
    const invitation = await this.options.repository.findInvitationById(invitationId);

    if (!invitation || invitation.schoolId !== schoolId) {
      throw new AppError("Invitation not found", {
        status: 404,
        code: "identity_invitation_not_found"
      });
    }

    return invitation;
  }

  private async mustFindRoleAssignment(
    schoolId: string,
    userId: string,
    canonicalRole: CanonicalRole
  ): Promise<IdentityRoleAssignmentRecord> {
    const assignment = await this.options.repository.findRoleAssignmentByUserAndRole(schoolId, userId, canonicalRole);

    if (!assignment) {
      throw new AppError("Role assignment not found", {
        status: 404,
        code: "identity_role_assignment_not_found"
      });
    }

    return assignment;
  }

  private clock(): Date {
    return this.options.clock?.() ?? defaultClock();
  }

  private idFactory(): string {
    return this.options.idFactory?.() ?? defaultIdFactory();
  }

  private async audit(event: Parameters<NonNullable<IdentityAuditSink["record"]>>[0]): Promise<void> {
    await this.options.auditSink?.record(event);
  }
}
