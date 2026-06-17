# Foundation Schema Review

## Purpose
Define the review checklist that every generated Prisma schema must pass before approval.

This checklist is the approval gate for Foundation schema generation. It is designed to verify tenant isolation, authentication support, authorization structure, audit coverage, security controls, indexing discipline, relationship integrity, lifecycle alignment, soft-delete behavior, and migration safety before any generated schema is accepted.

## Tenant Isolation Checks

### Pass Criteria
- Every tenant-owned entity includes `school_id`.
- No schema element permits cross-tenant foreign keys.
- Tenant-scoped entities are filtered by school boundary in the modeled access path.
- Global entities are clearly identified and not mixed with tenant-owned records.
- Host resolution-related records support verified custom domains and subdomain fallback without ambiguous school resolution.

### Fail Criteria
- Any tenant-owned entity is missing `school_id`.
- Any foreign key links records across schools.
- Any schema pattern allows tenant data to be shared by default across schools.
- Any school-owned record can be resolved without explicit tenant scope.
- Any global-vs-tenant ownership boundary is unclear.

## Authentication Checks

### Pass Criteria
- User session support is modeled as a server-managed authentication concept.
- Session records are tied to a user and a resolved tenant context.
- The schema supports session revocation and expiry.
- Password-related workflows can be supported without storing plaintext credentials.
- Admin-created user provisioning is structurally supported.

### Fail Criteria
- Sessions are not tied to a user.
- Sessions cannot be revoked or expired.
- The schema implies public signup or self-service account creation.
- Password data is modeled in plain text.
- Authentication records are not tenant-aware where tenant work is required.

## Authorization Checks

### Pass Criteria
- Canonical roles are represented as global policy objects.
- Role assignments are tenant-scoped and linked to a user and a role.
- The schema does not imply access through role definitions alone.
- Authorization checks can be modeled without cross-tenant scope leakage.

### Fail Criteria
- Role definitions are tenant-owned when they should be global.
- Role assignments are not tenant-scoped.
- A role definition alone grants access without assignment.
- The schema allows cross-school role inheritance or ambiguous authorization scope.

## Audit Coverage Checks

### Pass Criteria
- AuditLog is present as an immutable append-only concept.
- Tenant-scoped audit events include `school_id`.
- Audit records support actor, action, resource, outcome, and timestamp tracking.
- Sensitive actions such as role changes, session changes, and domain changes can be represented.

### Fail Criteria
- Audit logs can be edited by application users.
- Audit records cannot identify the actor when one exists.
- Tenant-scoped audit events do not carry `school_id`.
- Sensitive security or admin actions cannot be represented in the schema.

## Security Checks

### Pass Criteria
- Passwords are not stored in plain text.
- Session handling is compatible with secure HttpOnly cookie-based authentication.
- Sensitive fields are not modeled in a way that encourages unsafe exposure.
- The schema supports least-privilege access and secure recovery workflows.

### Fail Criteria
- Plaintext password storage is possible.
- Session storage cannot support secure server-managed authentication.
- Sensitive fields are exposed in a way that weakens security by default.
- The schema conflicts with the security baseline or implies unsafe defaults.

## Indexing Checks

### Pass Criteria
- Every tenant-owned entity has an index strategy that includes `school_id`.
- Composite indexes exist for dominant access paths where required.
- Active lookup patterns such as host, status, and expiry are indexed where operationally necessary.
- Audit review paths are supported by timestamp and tenant-aware indexes.

### Fail Criteria
- Tenant-owned entities lack `school_id` indexes.
- Required composite indexes are missing for tenant lookup, session expiry, role assignment, host resolution, or audit review.
- Indexing strategy encourages global access by default.
- Index naming or intent is too ambiguous to support review.

## Relationship Checks

### Pass Criteria
- One-to-many relationships reflect approved ownership boundaries.
- Many-to-many relationships are modeled explicitly when the relationship matters to ownership or security.
- Relationship helper entities are treated as first-class records when they define access, membership, or assignment.
- No relationship crosses school boundaries.

### Fail Criteria
- Any relationship crosses tenant boundaries.
- Relationship helper records are hidden inside ambiguous schema shortcuts.
- Ownership is unclear from the relationship model.
- Relationship design conflicts with the canonical role, tenant, or lifecycle rules.

## Soft Delete Checks

### Pass Criteria
- Protected business records prefer archive, revoke, deactivate, or close over hard delete.
- Published or historically significant records are not casually deleted.
- The schema supports archival or soft-delete behavior for protected entities.

### Fail Criteria
- Protected entities are hard deleted by default.
- Published records can be destroyed without a tracked archive or correction path.
- The schema offers no practical way to retain history while disabling active use.

## Lifecycle Checks

### Pass Criteria
- Entity lifecycles match the approved lifecycle docs.
- The schema supports the correct state progression for School, Session, RoleAssignment, User, SchoolDomain, SchoolTheme, SchoolSettings, and other Foundation entities.
- Invalid transitions can be prevented by the modeled state structure.

### Fail Criteria
- Lifecycle states conflict with the approved entity lifecycle definitions.
- The schema omits important lifecycle states such as active, suspended, archived, revoked, or expired where required.
- The schema permits invalid transitions that contradict the documentation.

## Migration Safety Checks

### Pass Criteria
- Schema changes that affect tenant boundaries, roles, authentication, audit, or lifecycle rules are flagged for ADR review.
- Review is required for any new tenant-owned entity or cross-boundary relationship.
- Destructive migrations on protected data require explicit approval.
- The schema aligns with the governing docs and does not invent new business rules.

### Fail Criteria
- A schema change modifies tenant boundaries without ADR review.
- A schema change changes the role model, authentication model, audit model, or lifecycle model without governance review.
- Destructive migration behavior is implied for protected records without explicit approval.
- The schema conflicts with the approved documentation hierarchy.

## Review Outcome Rules
- A schema passes only if every section above passes.
- Any single fail criterion is a blocking issue.
- If the schema is incomplete, ambiguous, or inconsistent with governing docs, it fails review.
- Reviewers must record the exact failing rule and the affected entity or relationship before approval is granted.
