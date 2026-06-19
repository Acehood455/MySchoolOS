import {
  AppError,
  CANONICAL_ROLE_DEFINITIONS,
  isCanonicalRole,
  type CanonicalRole,
  type RoleAssignmentRecord
} from "@myschoolos/shared";
import type { AuthorizationRepository, ResolveAuthorizationInput } from "./authorization-context.js";

export interface RoleResolverResult {
  readonly roles: readonly CanonicalRole[];
  readonly roleAssignments: readonly RoleAssignmentRecord[];
  readonly invalidRoleAssignments: readonly RoleAssignmentRecord[];
}

export class RoleResolverService {
  public constructor(private readonly repository: AuthorizationRepository) {}

  public async resolve(input: ResolveAuthorizationInput): Promise<RoleResolverResult> {
    if (input.authContext.schoolId !== input.tenantContext.schoolId) {
      throw new AppError("Authorization failed", {
        status: 403,
        code: "permission_denied",
        details: {
          reason: "tenant_mismatch"
        }
      });
    }

    const assignments = await this.repository.findRoleAssignments(input.authContext.userId, input.tenantContext.schoolId);
    const roleAssignments = assignments.filter(
      (assignment) =>
        assignment.status === "active" &&
        assignment.schoolId === input.tenantContext.schoolId &&
        isCanonicalRole(assignment.canonicalRole)
    );
    const invalidRoleAssignments = assignments.filter(
      (assignment) =>
        assignment.schoolId !== input.tenantContext.schoolId ||
        !isCanonicalRole(assignment.canonicalRole)
    );

    const roles = CANONICAL_ROLE_DEFINITIONS.flatMap((definition) =>
      roleAssignments.some((assignment) => assignment.canonicalRole === definition.canonicalRole)
        ? [definition.canonicalRole]
        : []
    );

    return {
      roles,
      roleAssignments,
      invalidRoleAssignments
    };
  }
}
