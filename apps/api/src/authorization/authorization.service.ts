import { AppError, canRolePerform, type CanonicalRole, type FoundationPermission } from "@myschoolos/shared";
import type {
  AuthorizeInput,
  AuthorizeResult,
  AuthorizationAuditEvent,
  AuthorizationContext,
  AuthorizationServiceOptions,
  ResolveAuthorizationInput
} from "./authorization-context.js";
import { RoleResolverService } from "./role-resolver.service.js";

export class AuthorizationService {
  private readonly roleResolver: RoleResolverService;

  public constructor(private readonly options: AuthorizationServiceOptions) {
    this.roleResolver = new RoleResolverService(options.repository);
  }

  public async resolveAuthorizationContext(input: ResolveAuthorizationInput): Promise<AuthorizationContext> {
    const resolved = await this.roleResolver.resolve(input);

    return {
      userId: input.authContext.userId,
      schoolId: input.tenantContext.schoolId,
      roles: resolved.roles,
      roleAssignments: resolved.roleAssignments,
      invalidRoleAssignments: resolved.invalidRoleAssignments
    };
  }

  public async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
    let authorizationContext: AuthorizationContext;

    try {
      authorizationContext = await this.resolveAuthorizationContext(input);
    } catch (error) {
      if (error instanceof AppError && error.code === "permission_denied" && error.details?.reason === "tenant_mismatch") {
        await this.auditDenied({
          schoolId: input.tenantContext.schoolId,
          userId: input.authContext.userId,
          sessionId: input.authContext.sessionId,
          permission: input.permission,
          reason: "tenant_mismatch"
        });
      }

      throw error;
    }

    if (authorizationContext.invalidRoleAssignments.length > 0) {
      await this.auditDenied({
        schoolId: authorizationContext.schoolId,
        userId: authorizationContext.userId,
        sessionId: input.authContext.sessionId,
        permission: input.permission,
        reason: "invalid_role_assignment",
        roles: authorizationContext.roles,
        details: {
          invalidRoleAssignmentCount: authorizationContext.invalidRoleAssignments.length
        }
      });

      throw new AppError("Permission denied", {
        status: 403,
        code: "permission_denied"
      });
    }

    const allowed = this.isAllowed(authorizationContext.roles, input.permission);

    if (!allowed) {
      await this.auditDenied({
        schoolId: authorizationContext.schoolId,
        userId: authorizationContext.userId,
        sessionId: input.authContext.sessionId,
        permission: input.permission,
        reason: authorizationContext.roles.length === 0 ? "no_role_assignment" : "forbidden",
        roles: authorizationContext.roles
      });

      throw new AppError("Permission denied", {
        status: 403,
        code: "permission_denied"
      });
    }

    return {
      permitted: true,
      authorizationContext
    };
  }

  private isAllowed(roles: readonly CanonicalRole[], permission: FoundationPermission): boolean {
    return roles.some((role) => canRolePerform(role, permission));
  }

  private async auditDenied(event: Omit<AuthorizationAuditEvent, "eventName">): Promise<void> {
    await this.options.auditSink?.record({
      ...event,
      eventName: "permission.denied"
    });
  }
}
