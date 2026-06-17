# Schema Generation Spec

## Purpose
Define the rules AI agents must follow when generating Prisma schemas for MySchoolOS.

This document is a schema governance specification, not a schema definition. It exists to ensure that any future Prisma output remains aligned with the canonical architecture, tenant model, security baseline, role model, ownership rules, and lifecycle rules already approved in the repository.

## Schema Principles

### Tenant-First Design
- The school is the primary tenant boundary.
- Every tenant-owned entity must be explicitly scoped to one school.
- Shared-table designs are allowed only when tenant scoping is preserved on every access path.
- No schema may rely on UI filtering as a substitute for tenant isolation.

### Security-First Design
- Security requirements override convenience and implementation speed.
- Authentication, authorization, and auditability must be designed into the schema from the start.
- Sensitive data must never be stored in a way that weakens tenant isolation or audit review.
- Platform-wide data must be clearly distinguished from tenant-owned data.

### Auditability
- Security-relevant actions must be representable in the schema through immutable audit records.
- Ownership, role changes, session changes, domain changes, and sensitive administrative actions must be traceable.
- Audit data must support actor, resource, tenant, timestamp, and outcome tracking.

### Future Extensibility
- Schema design should preserve room for versioning, archival, and controlled policy change.
- When a concept may change over time, prefer versioned records or archival patterns over destructive replacement.
- Future modules must reuse the same tenant and ownership discipline established by the Foundation entities.

## Naming Standards

### Model Naming
- Use singular, PascalCase model names.
- Model names must reflect business entities, not screens, views, or implementation shortcuts.
- Relationship helper entities must still be named as first-class business records.

### Enum Naming
- Use clear, stable, PascalCase enum names.
- Enum values should be short, business-readable, and consistent across related entities.
- Avoid ambiguous or overloaded enum labels.

### Relation Naming
- Relation names must be descriptive enough to show business intent.
- Relation names must not hide tenant ownership or cross-entity meaning.
- Many-to-many relationships should be named as explicit relationship concepts when the relationship itself is meaningful.

### Index Naming
- Index names should be predictable, descriptive, and aligned to the access path they support.
- Composite index intent must be readable from the name.
- Avoid generic index names that obscure the tenant, status, or ownership boundary being optimized.

## Tenant Rules

### Entities Requiring `school_id`
The following entities must contain `school_id` in any generated schema because they are tenant-owned or tenant-scoped:
- School
- SchoolDomain
- SchoolTheme
- SchoolSettings
- User for school users
- Session
- RoleAssignment
- AuditLog for tenant-scoped events

### Global Entities
The following entities are global and must not be treated as tenant-owned:
- Role
- Platform-owned User records for Super Admin accounts

### Cross-Tenant Restrictions
- No cross-tenant foreign keys.
- No cross-tenant reads, writes, exports, or background operations without explicit platform authorization.
- No tenant-owned record may reference a record from another school.
- No schema pattern may make one school’s data implicitly visible to another school.

## Relationship Rules

### One-to-Many Rules
- One school may own many related tenant records.
- One user may own many sessions over time.
- One role may be assigned to many users through role assignments.
- One audit actor may generate many audit events.

### Many-to-Many Rules
- Many-to-many business relationships should be modeled explicitly when the relationship itself matters to ownership, audit, or tenant isolation.
- If a relationship represents access, assignment, or membership, it should usually become a first-class tenant-owned entity rather than being hidden in schema shorthand.

### Ownership Requirements
- Ownership must follow the business boundary, not the UI.
- Relationship records that define tenant membership, authorization, or instructional access must be treated as first-class tenant data.
- Ownership should always be clear from the schema and from the surrounding documentation.

## Soft Delete Rules

### Entities That May Be Deleted
- Pre-publication records may be deleted only when the governing docs allow it.
- Non-critical draft records may support deletion if no audit, compliance, or historical requirement applies.

### Entities That Must Be Archived
The following should generally be archived, deactivated, revoked, or closed rather than hard deleted:
- School
- SchoolDomain
- SchoolTheme
- SchoolSettings
- User
- Session
- RoleAssignment
- AuditLog

### Deletion Discipline
- Published or historically significant records must not be hard deleted casually.
- If a record affects tenant history, security, or compliance, prefer archive or revoke.
- Hard delete should be reserved for rare, explicitly approved cases.

## Audit Rules

### Audit Coverage Expectations
- Audit coverage is required for all sensitive tenant, identity, authorization, and support actions.
- Audit logs must capture creation, update, revocation, suspension, activation, and archival events where applicable.
- Tenant-scoped audit events must include `school_id`.

### Actor Requirements
- Audit records must include an actor when one exists.
- System-generated events must still identify the system or service actor type.
- Anonymous or unknown actors should be preserved as such when that is the only truthful representation.

## Security Rules

### Password Handling Expectations
- Passwords must never be stored in plain text.
- Schema design must support secure password storage, reset, and revocation workflows.
- Password-related events must be auditable.

### Session Storage Expectations
- Sessions must support server-managed authentication.
- Session records must be revocable and expirably bound to user and tenant context.
- Session storage must support secure HttpOnly cookie-based application behavior.

### Sensitive Data Handling
- Sensitive security fields must not be modeled in a way that invites logging or exposure by default.
- Schema design should support least-privilege access and secure recovery workflows.

## Indexing Rules

### Required Index Patterns
- Index by `school_id` on every tenant-owned entity.
- Index by active lookup fields such as host, status, or actor where operationally required.
- Index by created or updated timestamps where audit, support, or retention workflows depend on recency.

### Composite Index Expectations
The following composite index patterns are expected for the Foundation and future schema generation:
- `SchoolDomain(host, verification_status)`
- `RoleAssignment(school_id, user_id, status)`
- `Session(school_id, user_id, expires_at)`
- `AuditLog(school_id, created_at)`
- `AuditLog(event_name, created_at)`

### Index Discipline
- Indexing should support the dominant tenant access paths, not speculative over-indexing.
- Avoid indexes that blur tenant scope or imply global access by default.

## Migration Rules

### Schema Changes Requiring ADR Updates
The following kinds of schema changes require an ADR update before generation:
- Tenant boundary changes
- Role model changes
- Authentication model changes
- Domain resolution model changes
- Audit model changes
- Lifecycle model changes
- Any change that adds or removes a global entity

### Schema Changes Requiring Review
The following changes require architecture and security review:
- Any new tenant-owned entity
- Any new relationship crossing ownership boundaries
- Any change to session, role, or audit behavior
- Any change to soft-delete, archival, or retention behavior
- Any change affecting cross-tenant access controls

### Migration Discipline
- Schema generation must follow the approved documentation, not invent new business rules.
- Backward-compatible evolution is preferred where it does not weaken security or isolation.
- Destructive migrations affecting protected data require explicit review.

## Prohibited Patterns

The following patterns are prohibited in generated schemas:
- Tenant-less tenant entities
- Cross-tenant foreign keys
- Hard deletes on protected entities
- Security-sensitive fields stored in plain text
- UI-only tenant filtering
- Ambiguous global-vs-tenant ownership
- Role definitions that imply access without explicit assignment
- Session records that are not tied to a user and tenant context
- Audit records that cannot identify the actor when one exists
- Schema shortcuts that collapse school ownership into a generic organization model

## Governance Notes
- This document governs Prisma generation, but it does not replace the architecture, security, or lifecycle docs.
- If a schema choice conflicts with the governing docs, the governing docs win.
- If a future decision changes any rule here, update this document together with the supporting ADRs and architecture docs.
