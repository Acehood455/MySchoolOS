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

    return this.authorizeResolved({
      authContext: input.authContext,
      tenantContext: input.tenantContext,
      authorizationContext,
      permission: input.permission
    });
  }

  public async authorizeResolved(input: {
    readonly authContext: ResolveAuthorizationInput["authContext"];
    readonly tenantContext: ResolveAuthorizationInput["tenantContext"];
    readonly authorizationContext: AuthorizationContext;
    readonly permission: FoundationPermission;
  }): Promise<AuthorizeResult> {
    if (input.authorizationContext.invalidRoleAssignments.length > 0) {
      await this.auditDenied({
        schoolId: input.authorizationContext.schoolId,
        userId: input.authorizationContext.userId,
        sessionId: input.authContext.sessionId,
        permission: input.permission,
        reason: "invalid_role_assignment",
        roles: input.authorizationContext.roles,
        details: {
          invalidRoleAssignmentCount: input.authorizationContext.invalidRoleAssignments.length
        }
      });

      throw new AppError("Permission denied", {
        status: 403,
        code: "permission_denied"
      });
    }

    const allowed = this.isAllowed(input.authorizationContext.roles, input.permission);

    if (!allowed) {
      await this.auditDenied({
        schoolId: input.authorizationContext.schoolId,
        userId: input.authorizationContext.userId,
        sessionId: input.authContext.sessionId,
        permission: input.permission,
        reason: input.authorizationContext.roles.length === 0 ? "no_role_assignment" : "forbidden",
        roles: input.authorizationContext.roles
      });

      throw new AppError("Permission denied", {
        status: 403,
        code: "permission_denied"
      });
    }

    return {
      permitted: true,
      authorizationContext: input.authorizationContext
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
