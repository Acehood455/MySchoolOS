# Foundation Database Spec

## Purpose
Define the conceptual database model for the Foundation Phase so future schema generation has one authoritative source of truth.

This document describes the canonical data boundaries for the first phase of MySchoolOS. It is intentionally conceptual. It does not define Prisma models, SQL, migrations, or code. It defines the database meaning of the Foundation entities so later schema generation stays aligned with the architecture, security, tenancy, and lifecycle rules already approved.

## Scope
- Covers only Foundation entities.
- Describes fields, relationships, constraints, indexing intent, tenant ownership, lifecycle, security, and audit expectations.
- Applies to shared-table, single-database multi-tenant design.
- Uses the canonical role model and tenancy rules from the governing docs.

## Foundation Entity Set
The Foundation database model includes only the following entities:
- School
- SchoolDomain
- SchoolTheme
- SchoolSettings
- User
- Session
- Role
- RoleAssignment
- AuditLog

## Core Modeling Rules
- Every tenant-owned entity must contain `school_id`.
- No cross-tenant foreign keys are allowed.
- Global or platform-owned entities must be clearly labeled and never treated as school-owned records.
- Security-sensitive tables must be auditable.
- Soft delete is preferred over hard delete for business records.
- Archived or deactivated records should remain identifiable for history and compliance.

## Index Guidance
The following composite indexes are conceptual expectations for future schema generation:
- `SchoolDomain(host, verification_status)` to support canonical host resolution and verification filtering.
- `RoleAssignment(school_id, user_id, status)` to support tenant-scoped authorization checks.
- `Session(school_id, user_id, expires_at)` to support active-session lookup and expiry enforcement.
- `AuditLog(school_id, created_at)` to support tenant audit review and retention workflows.
- `AuditLog(event_name, created_at)` to support incident triage and security reporting.

## Relationship Matrix

| Relationship | Cardinality | Notes |
| --- | --- | --- |
| School -> SchoolDomain | 1 -> Many | A school may have multiple domains over time, but only verified active hosts participate in resolution. |
| School -> SchoolTheme | 1 -> Many | Theme history may be retained; only one theme state should be active at a time if versioning is used. |
| School -> SchoolSettings | 1 -> Many | Settings may be versioned over time. |
| School -> User | 1 -> Many | School-owned users belong to exactly one school. |
| School -> RoleAssignment | 1 -> Many | Role assignments are tenant-scoped. |
| School -> AuditLog | 1 -> Many | Tenant-scoped audit records carry `school_id`. |
| User -> Session | 1 -> Many | One user may have multiple sessions over time, and possibly concurrent sessions depending on policy. |
| User -> RoleAssignment | 1 -> Many | A user may hold one or more assignments only if governance allows it. |
| Role -> RoleAssignment | 1 -> Many | One role can be assigned to many users. |
| User -> AuditLog | 1 -> Many | A user may generate many audit events as the actor. |

## Entity Specifications

### School

#### Purpose
Root tenant record and top-level business boundary for one school.

#### Required Fields
- `id`
- `school_id` boundary semantics
- `name`
- `status`
- `created_at`
- `updated_at`
- `created_by`

#### Optional Fields
- `legal_name`
- `code`
- `description`
- `closed_at`
- `archived_at`
- `reactivated_at`
- `metadata`

#### Unique Constraints
- School identifier must be unique within the platform.
- School code or slug, if used, must be unique within the platform or within a governed namespace.

#### Indexing Requirements
- Index by `school_id` for tenant scoping.
- Index by `status` for operational filters.
- Index by creation and archival timestamps for support and compliance queries.

#### Relationships
- One school to many domains.
- One school to many themes.
- One school to many settings records.
- One school to many users.
- One school to many role assignments.
- One school to many audit records.

#### Tenant Ownership
- Tenant-owned root entity.
- This entity is the source of tenant context for all school-scoped records.

#### Lifecycle
- `Pending`
- `Active`
- `Suspended`
- `Archived`

#### Security Considerations
- School records define the tenant boundary.
- Suspension and archival are privileged actions.
- A school must never be resolved through another school's data.

#### Audit Requirements
- `school.created`
- `school.activated`
- `school.suspended`
- `school.reactivated`
- `school.archived`
- Any deletion request or administrative override

### SchoolDomain

#### Purpose
Stores verified hostnames used to resolve a school.

#### Required Fields
- `id`
- `school_id`
- `host`
- `host_type`
- `verification_status`
- `status`
- `created_at`
- `updated_at`
- `created_by`

#### Optional Fields
- `verified_at`
- `verified_by`
- `remapped_from`
- `remapped_to`
- `archived_at`
- `metadata`

#### Unique Constraints
- `host` must be unique across active mappings.
- A host cannot point to more than one active school.
- Canonical host plus status combination must not allow duplicate active resolution targets.

#### Indexing Requirements
- Index by `school_id`.
- Index by `host`.
- Index by `verification_status`.
- Index by `status`.
- Composite index on `host` and `verification_status` is expected for the active resolution path.

#### Relationships
- Many domains belong to one school.
- One domain may be associated with at most one active school at a time.

#### Tenant Ownership
- Tenant-owned.

#### Lifecycle
- `Pending`
- `Verified`
- `Remapped`
- `Revoked`
- `Archived`

#### Security Considerations
- Custom domains must be verified before use.
- Verified custom domains are resolved before subdomains.
- Duplicate or conflicting mappings must be rejected.
- Host resolution failures must fail closed.

#### Audit Requirements
- `school.domain.added`
- `school.domain.verified`
- `school.domain.verification_failed`
- `school.domain.conflict_rejected`
- `school.domain.remapped`
- `school.domain.removed`

### SchoolTheme

#### Purpose
Stores tenant-approved branding and presentation settings.

#### Required Fields
- `id`
- `school_id`
- `logo`
- `primary_color`
- `secondary_color`
- `status`
- `created_at`
- `updated_at`
- `created_by`

#### Optional Fields
- `favicon`
- `font_family`
- `brand_assets`
- `archived_at`
- `metadata`

#### Unique Constraints
- A school may have only one active theme configuration at a time.

#### Indexing Requirements
- Index by `school_id`.
- Index by `status`.

#### Relationships
- Many theme records may belong to one school over time if versioning is used.

#### Tenant Ownership
- Tenant-owned.

#### Lifecycle
- `Draft`
- `Active`
- `Archived`

#### Security Considerations
- Theme data must not influence identity, routing, or authorization.
- Theme changes are presentation-only.

#### Audit Requirements
- `school.theme.updated`
- Any theme reset or archival

### SchoolSettings

#### Purpose
Stores operational preferences and approved school policy settings.

#### Required Fields
- `id`
- `school_id`
- `status`
- `created_at`
- `updated_at`
- `created_by`

#### Optional Fields
- `academic_preferences`
- `notification_preferences`
- `operational_preferences`
- `metadata`
- `archived_at`

#### Unique Constraints
- One active settings record per school, if settings are modeled as versioned records.

#### Indexing Requirements
- Index by `school_id`.
- Index by `status`.

#### Relationships
- Many settings versions may belong to one school over time.

#### Tenant Ownership
- Tenant-owned.

#### Lifecycle
- `Draft`
- `Active`
- `Archived`

#### Security Considerations
- Settings must remain tenant-scoped.
- Settings must not hide global behavior or weaken isolation.

#### Audit Requirements
- `school.settings.updated`
- Any settings reset, publish, or archive action

### User

#### Purpose
Represents an authenticated identity for a school user or platform operator.

#### Required Fields
- `id`
- `school_id` for school users
- `email` or `username`
- `display_name`
- `status`
- `auth_subject`
- `created_at`
- `updated_at`
- `created_by`

#### Optional Fields
- `phone_number`
- `last_login_at`
- `invited_at`
- `activated_at`
- `suspended_at`
- `deactivated_at`
- `archived_at`
- `metadata`

#### Unique Constraints
- Email or username must be unique within the appropriate scope.
- For school users, identity uniqueness should be enforced within the school or controlled identity namespace.
- `auth_subject`, if used, must be globally unique.

#### Indexing Requirements
- Index by `school_id`.
- Index by login identifier.
- Index by `status`.
- Index by `auth_subject`.

#### Relationships
- One school to many users.
- One user to many sessions.
- One user to many role assignments.
- One user to many audit events as actor.

#### Tenant Ownership
- Tenant-owned for school users.
- Platform-owned for Super Admin users.

#### Lifecycle
- `Invited`
- `Active`
- `Suspended`
- `Deactivated`
- `Archived`

#### Security Considerations
- User creation is admin-controlled.
- Public signup is not allowed.
- Password reset and lockout must be auditable.
- Platform users and tenant users must never be confused.

#### Audit Requirements
- `user.invited`
- `user.created`
- `user.activated`
- `user.updated`
- `user.suspended`
- `user.deactivated`
- `user.password_reset_requested`
- `user.password_reset_completed`

### Session

#### Purpose
Tracks authenticated access state for a user.

#### Required Fields
- `id`
- `user_id`
- `school_id`
- `session_token` or equivalent server-side session handle
- `status`
- `created_at`
- `expires_at`
- `last_refreshed_at`

#### Optional Fields
- `revoked_at`
- `revoked_by`
- `ip_address`
- `user_agent`
- `auth_context`

#### Unique Constraints
- Session token or handle must be unique.
- A revoked token must not be reusable.

#### Indexing Requirements
- Index by `user_id`.
- Index by `school_id`.
- Index by `status`.
- Index by `expires_at`.
- Composite index on `school_id`, `user_id`, and `expires_at` is expected for session lookup and expiry enforcement.

#### Relationships
- One user to many sessions.
- One session belongs to one user.

#### Tenant Ownership
- Tenant-scoped by authenticated user context.

#### Lifecycle
- `Active`
- `Refreshed`
- `Revoked`
- `Expired`

#### Security Considerations
- Must support server-managed sessions.
- Must use secure HttpOnly cookies at the application layer.
- Must be revocable immediately.
- Must be bound to the resolved tenant context.

#### Audit Requirements
- `auth.session.created`
- `auth.session.refreshed`
- `auth.session.revoked`
- Session expiry when relevant to incident review

### Role

#### Purpose
Defines the canonical authorization category used in the MVP.

#### Required Fields
- `id`
- `name`
- `canonical_name`
- `status`
- `created_at`
- `updated_at`

#### Optional Fields
- `description`
- `alias`
- `scope`
- `metadata`

#### Unique Constraints
- Canonical role name must be unique.
- Alias mapping must not create ambiguous role identity.

#### Indexing Requirements
- Index by `canonical_name`.
- Index by `status`.

#### Relationships
- One role to many role assignments.

#### Tenant Ownership
- Global shared policy object.
- Not tenant-owned.

#### Lifecycle
- `Active`
- `Deprecated`
- `Retired`

#### Security Considerations
- Roles are governed centrally.
- The role set must remain aligned to the canonical role matrix.
- No free-form tenant roles are allowed in Foundation.

#### Audit Requirements
- Changes to role policy or governance
- Role assignment and revocation events through `RoleAssignment`

### RoleAssignment

#### Purpose
Links a user to a canonical role within a school.

#### Required Fields
- `id`
- `school_id`
- `user_id`
- `role_id`
- `status`
- `created_at`
- `updated_at`
- `created_by`

#### Optional Fields
- `assigned_at`
- `revoked_at`
- `revoked_by`
- `reason`
- `metadata`

#### Unique Constraints
- A user may not have duplicate assignments for the same role within the same school unless explicitly allowed by policy.
- A role assignment must be unique for the same user, role, and school combination.

#### Indexing Requirements
- Index by `school_id`.
- Index by `user_id`.
- Index by `role_id`.
- Index by `status`.
- Composite index on `school_id`, `user_id`, and `status` is expected for authorization checks.

#### Relationships
- Many role assignments belong to one user.
- Many role assignments belong to one role.
- Many role assignments belong to one school.

#### Tenant Ownership
- Tenant-owned.

#### Lifecycle
- `Active`
- `Revoked`
- `Archived`

#### Security Considerations
- Role assignment is the main authorization boundary for the foundation.
- Cross-school assignment is forbidden.
- Privilege changes must be auditable.

#### Audit Requirements
- `role.assigned`
- `role.revoked`
- `privilege.escalated`
- `privilege.attempted`

### AuditLog

#### Purpose
Immutable record of security-relevant, administrative, and tenant-sensitive events.

#### Required Fields
- `id`
- `event_name`
- `actor_type`
- `actor_id` when available
- `school_id` when tenant-scoped
- `resource_type`
- `resource_id`
- `severity`
- `outcome`
- `created_at`

#### Optional Fields
- `request_id`
- `session_id`
- `ip_address`
- `user_agent`
- `before_state`
- `after_state`
- `reason`
- `metadata`

#### Unique Constraints
- Audit events should not be deduplicated in a way that loses history.
- Each event record must remain append-only and individually addressable.

#### Indexing Requirements
- Index by `created_at`.
- Index by `school_id`.
- Index by `event_name`.
- Index by `actor_id`.
- Index by `resource_type` and `resource_id`.
- Composite index on `school_id` and `created_at` is expected for tenant audit review.
- Composite index on `event_name` and `created_at` is expected for event analysis.

#### Relationships
- Many audit events may belong to one user as actor.
- Many audit events may belong to one school.
- Many audit events may reference one resource.

#### Tenant Ownership
- Tenant-aware platform record.
- Tenant-scoped audit events must include `school_id`.

#### Lifecycle
- Append-only.

#### Security Considerations
- Must be immutable.
- Must be tamper-resistant.
- Must not be user-editable.
- Must preserve enough context for incident review and compliance.

#### Audit Requirements
- Audit logs are themselves the audit destination for all security-sensitive and operationally important events.

## Entity Ownership Summary

### Entities Requiring `school_id`
- School
- SchoolDomain
- SchoolTheme
- SchoolSettings
- User for school users
- Session
- RoleAssignment
- AuditLog for tenant-scoped events

### Global Entities
- Role
- Platform-owned User records for Super Admin accounts

### User Ownership Rule
- Platform User records do not have `school_id`.
- School User records must have `school_id`.
- The table may remain conceptually shared, but scope must be explicit in future schema generation.

### Immutable Entities
- AuditLog

### Soft-Delete Preferred Entities
- School
- SchoolDomain
- SchoolTheme
- SchoolSettings
- User
- Session
- RoleAssignment

### Archival Requirements
- School records should archive rather than hard delete.
- SchoolDomain records should archive or revoke before removal.
- SchoolTheme and SchoolSettings should archive or version rather than hard delete.
- User records should deactivate or archive rather than hard delete.
- Sessions should revoke or expire rather than delete manually.
- RoleAssignments should revoke or archive rather than delete.

### Session Invalidation Expectations
- Password reset should revoke active sessions.
- Password change should revoke active sessions.
- Suspension should revoke active sessions.
- Deactivation should revoke active sessions.
- School suspension should revoke or invalidate tenant-scoped sessions.

## Security Considerations by Boundary
- School boundary is the root isolation boundary.
- Host resolution must happen before tenant-scoped access.
- Authorization must be evaluated before data access.
- Audit logging must capture privileged and sensitive actions.
- Shared tables do not weaken ownership rules.

## Schema Generation Rules
These rules will later guide Prisma generation.

- Every tenant-owned entity must contain `school_id`.
- No cross-tenant foreign keys.
- Every audit event must reference an actor when available.
- Soft-delete is preferred over hard delete.
- Security-sensitive tables require audit coverage.
- Global policy entities must be explicitly identified as non-tenant-owned.
- Tenant resolution tables must support verified custom domain lookup first and subdomain fallback second.
- A single active host mapping must not point to multiple schools.
- Role assignments must always be tenant-scoped.
- Session records must bind authentication to tenant context.
- Immutable audit records must never be updated in place.
- Archived records must remain queryable for history and compliance.
- When a concept can change over time, prefer versioned records or archival over destructive replacement.

## Future Extensibility Notes
- The foundation model should allow later schema generation without renaming canonical entities.
- Versioned settings, themes, and policies should be represented in a way that preserves history.
- If a future platform-wide entity is added, it must be documented as global before schema generation starts.
- Later academic entities must reuse the same `school_id` discipline established here.
