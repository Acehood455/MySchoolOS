import type { RoleAssignmentRecord } from "@myschoolos/shared";
import type {
  IdentityInvitationRecord,
  IdentityRoleAssignmentRecord,
  IdentityUserRecord
} from "./identity-context.js";

function normalizeLoginIdentifier(loginIdentifier: string): string {
  return loginIdentifier.trim().toLowerCase();
}

export interface IdentityRepository {
  findUserById(userId: string, schoolId: string): Promise<IdentityUserRecord | null>;
  findUserByLogin(loginIdentifier: string, schoolId: string): Promise<IdentityUserRecord | null>;
  findUsersBySchoolId(schoolId: string): Promise<readonly IdentityUserRecord[]>;
  createUser(record: IdentityUserRecord): Promise<IdentityUserRecord>;
  updateUser(
    userId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        IdentityUserRecord,
        "loginIdentifier" | "displayName" | "status" | "invitedAt" | "activatedAt" | "suspendedAt" | "deactivatedAt" | "archivedAt" | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<IdentityUserRecord | null>;

  createInvitation(record: IdentityInvitationRecord): Promise<IdentityInvitationRecord>;
  findInvitationById(invitationId: string): Promise<IdentityInvitationRecord | null>;
  findInvitationByUserId(userId: string, schoolId: string): Promise<IdentityInvitationRecord | null>;
  updateInvitation(
    invitationId: string,
    patch: Partial<
      Pick<
        IdentityInvitationRecord,
        "tokenHash" | "status" | "sentAt" | "resendCount" | "lastSentAt" | "acceptedAt" | "revokedAt" | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<IdentityInvitationRecord | null>;

  createRoleAssignment(record: IdentityRoleAssignmentRecord): Promise<IdentityRoleAssignmentRecord>;
  findRoleAssignmentByUserAndRole(
    schoolId: string,
    userId: string,
    canonicalRole: RoleAssignmentRecord["canonicalRole"]
  ): Promise<IdentityRoleAssignmentRecord | null>;
  findRoleAssignments(userId: string, schoolId: string): Promise<readonly IdentityRoleAssignmentRecord[]>;
  findRoleAssignmentsBySchoolId(schoolId: string): Promise<readonly IdentityRoleAssignmentRecord[]>;
  updateRoleAssignment(
    roleAssignmentId: string,
    patch: Partial<Pick<IdentityRoleAssignmentRecord, "status" | "revokedAt" | "revokedReason" | "metadata">>
  ): Promise<IdentityRoleAssignmentRecord | null>;
}

function cloneUser(record: IdentityUserRecord): IdentityUserRecord {
  return {
    ...record,
    metadata: record.metadata ? { ...record.metadata } : undefined
  };
}

function cloneInvitation(record: IdentityInvitationRecord): IdentityInvitationRecord {
  return {
    ...record,
    metadata: record.metadata ? { ...record.metadata } : undefined
  };
}

function cloneRoleAssignment(record: IdentityRoleAssignmentRecord): IdentityRoleAssignmentRecord {
  return {
    ...record,
    metadata: record.metadata ? { ...record.metadata } : undefined
  };
}

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly users = new Map<string, IdentityUserRecord>();
  private readonly usersByLogin = new Map<string, string>();
  private readonly invitations = new Map<string, IdentityInvitationRecord>();
  private readonly roleAssignments = new Map<string, IdentityRoleAssignmentRecord>();

  public async findUserById(userId: string, schoolId: string): Promise<IdentityUserRecord | null> {
    const user = this.users.get(userId);

    if (!user || user.schoolId !== schoolId) {
      return null;
    }

    return cloneUser(user);
  }

  public async findUserByLogin(loginIdentifier: string, schoolId: string): Promise<IdentityUserRecord | null> {
    const key = this.loginKey(schoolId, loginIdentifier);
    const userId = this.usersByLogin.get(key);

    if (!userId) {
      return null;
    }

    return this.findUserById(userId, schoolId);
  }

  public async findUsersBySchoolId(schoolId: string): Promise<readonly IdentityUserRecord[]> {
    return [...this.users.values()].filter((user) => user.schoolId === schoolId).map((user) => cloneUser(user));
  }

  public async createUser(record: IdentityUserRecord): Promise<IdentityUserRecord> {
    this.users.set(record.id, cloneUser(record));
    this.usersByLogin.set(this.loginKey(record.schoolId, record.loginIdentifier), record.id);
    return cloneUser(record);
  }

  public async updateUser(
    userId: string,
    schoolId: string,
    patch: Partial<
      Pick<
        IdentityUserRecord,
        "loginIdentifier" | "displayName" | "status" | "invitedAt" | "activatedAt" | "suspendedAt" | "deactivatedAt" | "archivedAt" | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<IdentityUserRecord | null> {
    const current = this.users.get(userId);

    if (!current || current.schoolId !== schoolId) {
      return null;
    }

    if (patch.loginIdentifier && patch.loginIdentifier !== current.loginIdentifier) {
      this.usersByLogin.delete(this.loginKey(current.schoolId, current.loginIdentifier));
      this.usersByLogin.set(this.loginKey(current.schoolId, patch.loginIdentifier), current.id);
    }

    const next: IdentityUserRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.users.set(userId, cloneUser(next));
    return cloneUser(next);
  }

  public async createInvitation(record: IdentityInvitationRecord): Promise<IdentityInvitationRecord> {
    this.invitations.set(record.id, cloneInvitation(record));
    return cloneInvitation(record);
  }

  public async findInvitationById(invitationId: string): Promise<IdentityInvitationRecord | null> {
    const invitation = this.invitations.get(invitationId);
    return invitation ? cloneInvitation(invitation) : null;
  }

  public async findInvitationByUserId(userId: string, schoolId: string): Promise<IdentityInvitationRecord | null> {
    for (const invitation of this.invitations.values()) {
      if (invitation.userId === userId && invitation.schoolId === schoolId) {
        return cloneInvitation(invitation);
      }
    }

    return null;
  }

  public async updateInvitation(
    invitationId: string,
    patch: Partial<
      Pick<
        IdentityInvitationRecord,
        "tokenHash" | "status" | "sentAt" | "resendCount" | "lastSentAt" | "acceptedAt" | "revokedAt" | "metadata"
      >
    > & { readonly updatedAt: Date }
  ): Promise<IdentityInvitationRecord | null> {
    const current = this.invitations.get(invitationId);

    if (!current) {
      return null;
    }

    const next: IdentityInvitationRecord = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt
    };

    this.invitations.set(invitationId, cloneInvitation(next));
    return cloneInvitation(next);
  }

  public async createRoleAssignment(record: IdentityRoleAssignmentRecord): Promise<IdentityRoleAssignmentRecord> {
    this.roleAssignments.set(record.id, cloneRoleAssignment(record));
    return cloneRoleAssignment(record);
  }

  public async findRoleAssignmentByUserAndRole(
    schoolId: string,
    userId: string,
    canonicalRole: RoleAssignmentRecord["canonicalRole"]
  ): Promise<IdentityRoleAssignmentRecord | null> {
    for (const assignment of this.roleAssignments.values()) {
      if (assignment.schoolId === schoolId && assignment.userId === userId && assignment.canonicalRole === canonicalRole) {
        return cloneRoleAssignment(assignment);
      }
    }

    return null;
  }

  public async findRoleAssignments(userId: string, schoolId: string): Promise<readonly IdentityRoleAssignmentRecord[]> {
    return [...this.roleAssignments.values()]
      .filter((assignment) => assignment.schoolId === schoolId && assignment.userId === userId)
      .map((assignment) => cloneRoleAssignment(assignment));
  }

  public async findRoleAssignmentsBySchoolId(schoolId: string): Promise<readonly IdentityRoleAssignmentRecord[]> {
    return [...this.roleAssignments.values()]
      .filter((assignment) => assignment.schoolId === schoolId)
      .map((assignment) => cloneRoleAssignment(assignment));
  }

  public async updateRoleAssignment(
    roleAssignmentId: string,
    patch: Partial<Pick<IdentityRoleAssignmentRecord, "status" | "revokedAt" | "revokedReason" | "metadata">>
  ): Promise<IdentityRoleAssignmentRecord | null> {
    const current = this.roleAssignments.get(roleAssignmentId);

    if (!current) {
      return null;
    }

    const next: IdentityRoleAssignmentRecord = {
      ...current,
      ...patch
    };

    this.roleAssignments.set(roleAssignmentId, cloneRoleAssignment(next));
    return cloneRoleAssignment(next);
  }

  private loginKey(schoolId: string, loginIdentifier: string): string {
    return `${schoolId}:${normalizeLoginIdentifier(loginIdentifier)}`;
  }
}
