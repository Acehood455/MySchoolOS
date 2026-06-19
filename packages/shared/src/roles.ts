export type CanonicalRole = "super_admin" | "school_admin" | "teacher" | "parent" | "student";

export type RoleAssignmentStatus = "active" | "revoked" | "archived";

export type FoundationPermission =
  | "tenant.read"
  | "school.manage"
  | "role.assign"
  | "role.revoke"
  | "session.revoke"
  | "password.reset";

export interface CanonicalRoleDefinition {
  readonly canonicalRole: CanonicalRole;
  readonly label: string;
  readonly permissions: readonly FoundationPermission[];
}

export interface RoleAssignmentRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly userId: string;
  readonly canonicalRole: CanonicalRole;
  readonly status: RoleAssignmentStatus;
  readonly assignedAt: Date;
  readonly revokedAt?: Date;
  readonly revokedReason?: string;
}

export const CANONICAL_ROLE_DEFINITIONS: readonly CanonicalRoleDefinition[] = [
  {
    canonicalRole: "super_admin",
    label: "Super Admin",
    permissions: ["tenant.read", "school.manage", "role.assign", "role.revoke", "session.revoke", "password.reset"]
  },
  {
    canonicalRole: "school_admin",
    label: "School Admin",
    permissions: ["tenant.read", "school.manage", "role.assign", "role.revoke", "session.revoke", "password.reset"]
  },
  {
    canonicalRole: "teacher",
    label: "Teacher",
    permissions: ["tenant.read"]
  },
  {
    canonicalRole: "parent",
    label: "Parent",
    permissions: ["tenant.read"]
  },
  {
    canonicalRole: "student",
    label: "Student",
    permissions: ["tenant.read"]
  }
] as const;

export const CANONICAL_ROLE_LOOKUP: Record<CanonicalRole, CanonicalRoleDefinition> = {
  super_admin: CANONICAL_ROLE_DEFINITIONS[0]!,
  school_admin: CANONICAL_ROLE_DEFINITIONS[1]!,
  teacher: CANONICAL_ROLE_DEFINITIONS[2]!,
  parent: CANONICAL_ROLE_DEFINITIONS[3]!,
  student: CANONICAL_ROLE_DEFINITIONS[4]!
};

export function isCanonicalRole(value: string): value is CanonicalRole {
  return value in CANONICAL_ROLE_LOOKUP;
}

export function getPermissionsForRole(canonicalRole: CanonicalRole): readonly FoundationPermission[] {
  return CANONICAL_ROLE_LOOKUP[canonicalRole].permissions;
}

export function canRolePerform(canonicalRole: CanonicalRole, permission: FoundationPermission): boolean {
  return getPermissionsForRole(canonicalRole).includes(permission);
}
