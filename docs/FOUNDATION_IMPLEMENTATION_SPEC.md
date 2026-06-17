# Foundation Implementation Spec

## Purpose
The Foundation Phase exists to establish the system properties that every later feature depends on: tenant isolation, authentication, authorization, audit logging, and school provisioning.

This phase is intentionally narrow. It creates the secure operating base for the platform before any academic workflows are introduced. If the foundation is weak, every later module inherits that weakness, so this phase must be complete and correct before the team moves on to people, academics, attendance, or reporting features.

## Goals
- Establish one verified tenant boundary per school.
- Ensure every tenant-scoped request resolves to an explicit `school_id`.
- Provide secure session-based authentication with admin-created users only.
- Establish the canonical role model and role assignment flow.
- Ensure every security-relevant action is auditable.
- Provide the school provisioning path required to bring a new tenant online.
- Create the minimum platform controls needed to support later academic modules safely.
- Prevent any academic feature from being built before the foundation is complete.

## Deliverables
The Foundation Phase must produce working, reviewable support for the following entities and platform capabilities:

- `School`
- `SchoolDomain`
- `SchoolTheme`
- `SchoolSettings`
- `User`
- `Session`
- `Role`
- `RoleAssignment`
- `AuditLog`
- Tenant Resolution Middleware
- Authentication Middleware
- Authorization Middleware
- Audit Middleware

These deliverables are the minimum foundation required for the next phase of implementation.

## Non-Goals
The Foundation Phase must not introduce or partially implement any of the following:

- Students
- Teachers
- Parents
- Attendance
- Assessments
- Assessment Results
- Report Cards
- Announcements
- Messaging
- Learning Content
- Timetable
- Fees
- Payments
- Analytics

The Foundation Phase must also avoid partial academic workflows, improvised reporting flows, or any feature that depends on academic record movement outside the foundation entities listed above.

## Functional Requirements

### School
- Purpose: Root tenant record and business boundary for one school.
- Responsibilities:
  - Represent the tenant itself.
  - Anchor all school-scoped data.
  - Support provisioning, activation, suspension, and archival of the tenant.
- Dependencies:
  - Tenant resolution and host verification.
  - Admin-controlled provisioning flow.
  - Audit logging for lifecycle changes.
- Security Requirements:
  - Must be tenant-owned and carry `school_id` semantics as the root boundary.
  - Must never be accessible across tenants without explicit platform authorization.
  - Must log creation, activation, suspension, reactivation, and archival events.

### SchoolDomain
- Purpose: Stores the verified custom domain or subdomain used to resolve the school.
- Responsibilities:
  - Bind one host to one school.
  - Support verification, remapping, removal, and conflict rejection.
  - Provide the host-resolution input used before tenant access.
- Dependencies:
  - School record.
  - Verification flow.
  - Audit logging.
- Security Requirements:
  - Custom domains require verification before use.
  - Duplicate host mappings are prohibited.
  - Conflicting mappings must be rejected and audited.
  - Domain resolution must never grant access before verification succeeds.

### SchoolTheme
- Purpose: Stores approved presentation settings such as branding assets and colors.
- Responsibilities:
  - Hold tenant-approved visual identity settings.
  - Support controlled updates and resets.
- Dependencies:
  - School record.
  - School admin authorization.
- Security Requirements:
  - Must not influence tenant identity, routing, or authorization.
  - Must remain tenant-scoped.
  - Theme updates must be auditable.

### SchoolSettings
- Purpose: Stores tenant-level operational preferences for the school.
- Responsibilities:
  - Hold approved operational configuration.
  - Support policy-aligned updates and resets.
- Dependencies:
  - School record.
  - School admin authorization.
- Security Requirements:
  - Must not become hidden global configuration.
  - Must not weaken isolation or security rules.
  - Settings changes must be auditable.

### User
- Purpose: Represents an authenticated human identity or platform operator.
- Responsibilities:
  - Hold login identity.
  - Support invitation-based provisioning.
  - Support profile updates and lifecycle control.
- Dependencies:
  - School record for tenant users.
  - Session authentication.
  - Role assignment.
- Security Requirements:
  - Admin-created users only.
  - No public signup.
  - Password reset must be controlled and auditable.
  - User lifecycle changes must be logged.

### User Ownership Scope
- Platform User:
  - Belongs to the platform.
  - Does not carry `school_id`.
  - Is used only for Super Admin and approved platform operations.
- School User:
  - Belongs to exactly one school.
  - Must carry `school_id`.
  - Is used for School Admin, Teacher, Parent, and Student accounts.
- Role definitions are global.
- Role assignments are tenant-scoped.
- Roles do not grant access by themselves.
- `RoleAssignment` grants access within a school context.

### Session
- Purpose: Represents an authenticated access session.
- Responsibilities:
  - Maintain server-managed sign-in state.
  - Support refresh, expiry, logout, and revocation.
- Dependencies:
  - User identity.
  - Authentication middleware.
  - Tenant resolution context.
- Security Requirements:
  - Must use server-managed session authentication.
  - Must use secure HttpOnly cookies.
  - Must support explicit revocation.
  - Must be bound to the resolved tenant context for tenant-scoped work.
  - Must be revoked when a password is reset, a password is changed, an account is suspended, an account is deactivated, or a school is suspended.
  - May be revoked by user logout, admin action, or security response action.

### Role
- Purpose: Canonical authorization category.
- Responsibilities:
  - Provide stable access vocabulary for the MVP.
  - Serve as the source of authorization intent.
- Dependencies:
  - Canonical role matrix.
  - Governance-approved documentation.
- Security Requirements:
  - Role set must remain aligned to `ROLE_MATRIX.md`.
  - No free-form or tenant-invented roles in the foundation.
  - Role vocabulary must be used consistently across docs and future implementation.

### RoleAssignment
- Purpose: Links a user to a canonical role within a specific school.
- Responsibilities:
  - Grant and revoke role membership within a tenant.
  - Support least-privilege access controls.
- Dependencies:
  - User.
  - Role.
  - School.
  - Authorization middleware.
- Security Requirements:
  - Must be tenant-scoped.
  - Must be auditable on assignment, revocation, and privilege change.
  - Must not permit cross-school role inheritance.

### AuditLog
- Purpose: Immutable record of security-relevant and operationally sensitive actions.
- Responsibilities:
  - Capture required events.
  - Support incident review and support traceability.
  - Preserve tenant context where applicable.
- Dependencies:
  - Audit middleware.
  - Event catalog.
  - Tenant context.
- Security Requirements:
  - Must be append-only.
  - Must be tamper-resistant.
  - Must be retained according to policy.
  - Must include actor, resource, action, outcome, timestamp, and tenant context for tenant-scoped events.

### Tenant Resolution Middleware
- Purpose: Resolve the tenant before any tenant-scoped access is allowed.
- Responsibilities:
  - Inspect the incoming host.
  - Resolve the school from verified host mapping.
  - Bind the resolved tenant into request context.
  - Reject ambiguous or invalid mappings.
- Dependencies:
  - SchoolDomain.
  - DomainVerification.
  - Session context for authenticated tenant work.
- Security Requirements:
  - Must enforce canonical host resolution order.
  - Must reject duplicate or conflicting mappings.
  - Must fail closed with Tenant Not Found when no verified host match exists.
  - Must be auditable when resolution fails or conflicts are rejected.

### Authentication Middleware
- Purpose: Enforce secure session-based login behavior.
- Responsibilities:
  - Validate session cookies.
  - Resolve the authenticated user.
  - Establish authenticated request state.
  - Support logout and session expiry behaviors.
- Dependencies:
  - User.
  - Session.
  - Tenant resolution context.
- Security Requirements:
  - Must use server-managed authentication.
  - Must not rely on UI-only identity checks.
  - Must support password reset and session revocation controls.

### Authorization Middleware
- Purpose: Enforce role-based and tenant-scoped access control.
- Responsibilities:
  - Check whether the authenticated user can perform the requested action.
  - Apply least-privilege rules.
  - Prevent cross-tenant access.
- Dependencies:
  - Session.
  - RoleAssignment.
  - Canonical role matrix.
- Security Requirements:
  - Must evaluate access server-side.
  - Must reject unauthorized actions before data access.
  - Must respect tenant scope and role scope together.

### Super Admin Boundary Rules
- Platform actions:
  - Create school.
  - Suspend school.
  - Activate school.
  - Manage platform settings.
- Tenant actions:
  - Occur inside a tenant context.
  - Must record `school_id` in audit logs.
- Cross-tenant actions:
  - Are Super Admin only.
  - Must be explicitly authorized.
  - Must generate audit events.

### Audit Middleware
- Purpose: Record security-relevant and operationally important actions.
- Responsibilities:
  - Capture audit events for required actions.
  - Attach actor, resource, outcome, and tenant context.
  - Preserve immutable audit history.
- Dependencies:
  - Event catalog.
  - Tenant context.
  - Session or system actor context.
- Security Requirements:
  - Must log sensitive and high-risk actions.
  - Must not be bypassed for privileged operations.
  - Must preserve audit integrity even when operations fail.

## Tenant Requirements

### `school_id` Strategy
- Every tenant-owned record must carry `school_id`.
- `school_id` is the core isolation boundary for shared tables.
- Tenant-scoped reads, writes, exports, and background actions must filter or bind by `school_id`.
- Platform-wide entities are allowed only when they are clearly documented as non-tenant-owned.

### Tenant Resolution Flow
1. Read the incoming request host.
2. Resolve the host using verified custom domain lookup first.
3. Fall back to subdomain resolution if no custom domain match exists.
4. If no verified host match exists, return Tenant Not Found before tenant data access.
5. For authenticated actions, confirm the resolved tenant context aligns with the session context.
6. If a conflict or mismatch is found, reject the request and audit the failure.

### Host Lookup Order
- Verified custom domain lookup first.
- Subdomain fallback second.
- Tenant Not Found otherwise.

### Custom Domain Rules
- Custom domains require verification before they can be used for tenant resolution.
- A host may map to only one active school at a time.
- Duplicate host mappings are prohibited.
- Conflict mappings must be rejected and audited.
- Domain verification, remapping, and deactivation are security-sensitive actions.

### Tenant Access Validation
- Tenant access must never depend on UI selection alone.
- Requests must fail closed if host or session context cannot be trusted.
- Any mismatch between host-derived school and session-derived school must be rejected.
- Background jobs and support workflows must carry tenant context when they touch tenant data.

## Authentication Requirements

### Session Login Flow
- Login is performed with username/email and password.
- Successful authentication creates a server-managed session.
- The session is stored in a secure HttpOnly cookie.
- The authenticated user must be bound to the resolved school context before tenant work begins.

### Logout Flow
- Logout must revoke the active session.
- Logout must clear the browser session cookie.
- Logout must be auditable.

### Session Expiration
- Sessions must expire automatically after the approved session lifetime.
- Expired sessions must not remain usable for tenant access.
- Expiry behavior must be consistent across all authenticated entry points.

### Session Revocation
- Sessions may be revoked by the user, School Admin, or Super Admin where policy allows.
- Revocation must take effect immediately or as close to immediately as the platform allows.
- Revocation must be logged.

### Password Reset Process
- Password resets must be controlled and auditable.
- Reset requests and completions must be logged.
- Password reset must not create a new user or a public signup path.
- Reset completion must not bypass tenant or authorization checks.

## Authorization Requirements

### Role Assignment Model
- Authorization is based on the canonical role matrix.
- Roles are assigned through explicit `RoleAssignment` records.
- Role assignment is tenant-scoped and auditable.
- No free-form tenant roles are permitted in the foundation.

### Route Protection
- Protected routes must require both authentication and authorization.
- Route checks must happen before tenant data access.
- Unauthorized access must fail closed.

### API Protection
- APIs must enforce tenant context on the server.
- APIs must not trust the client for role, school, or permission claims.
- Any sensitive endpoint must require explicit authorization checks.

### Least Privilege Principle
- Only the minimal role and scope needed for the action should be granted.
- Support and platform privileges must be narrower than tenant administration wherever possible.
- Temporary elevation should be auditable and revocable.

## Audit Requirements

### Required Events
At minimum, the foundation must generate audit events for:
- User invitation, creation, activation, suspension, deactivation, password reset, and session revocation
- Role assignment and revocation
- School creation, activation, suspension, reactivation, and archival
- School domain addition, verification, conflict rejection, remapping, and removal
- School theme and settings updates
- Tenant resolution failures and mapping conflicts
- Any denied authorization attempt

### Retention
- Audit records must be retained according to security and compliance policy.
- Audit retention must be at least as strict as the retention required for the associated business record.
- Security-critical audit records should be retained longer than routine operational logs when policy allows.

### Sensitive Actions
The following are always sensitive in the foundation phase:
- Privilege changes
- Session revocation
- Password reset
- Domain verification or remapping
- Host conflict rejection
- School suspension or archival
- Any cross-tenant attempt

### Immutable Audit Rules
- Audit logs must be append-only.
- Audit logs must not be editable by application users.
- Audit logs must preserve actor, action, resource, outcome, timestamp, and tenant context.
- Audit logging must not be bypassed for privileged flows.

## Acceptance Criteria
Foundation Phase is complete only when all of the following are true:
- A school can be provisioned as a tenant root record.
- A verified school host can resolve to exactly one school.
- Duplicate and conflicting host mappings are rejected and audited.
- Session-based authentication works with secure HttpOnly cookies.
- Admin-created users can log in, log out, reset passwords, and have sessions revoked.
- The canonical role matrix is operationally enforced.
- Role assignments are tenant-scoped and auditable.
- Authorization prevents cross-tenant access and unauthorized route/API use.
- Audit logging captures required events and is append-only.
- School theme and settings can be managed within the tenant boundary.
- Every tenant-scoped path depends on resolved `school_id`.
- The implementation does not include students, teachers, parents, attendance, assessments, results, report cards, announcements, messaging, learning content, timetable, fees, payments, or analytics.
- The foundation is reviewed and approved as ready for the next phase before any academic feature work begins.

## Out Of Scope
The following must not be built during Foundation:
- Academic entities and workflows beyond tenant provisioning
- Student, teacher, parent, and class management
- Attendance capture or correction
- Assessment creation, grading, or publication
- Result calculation or report card generation
- Announcements or messaging workflows
- Learning content delivery
- Timetable management
- Fees and payment handling
- Analytics or cross-tenant reporting features
- Any feature that relies on a partially implemented tenant boundary

## Notes
- This specification is architecture-level and intentionally does not define schema or code.
- This document is the authoritative source for what the Foundation Phase must accomplish before later phases begin.
- If any future decision changes the scope of the Foundation Phase, this document must be updated alongside the governing ADRs and phase plan.
