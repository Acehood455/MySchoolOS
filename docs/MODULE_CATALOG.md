# Module Catalog

## Purpose
Maintain a shared inventory of platform modules so contributors can understand ownership boundaries, dependencies, and tenant sensitivity without inventing new subsystems ad hoc.

## Scope
- Covers the logical modules in the product, their purpose, and their status.
- Supports architecture planning, roadmap sequencing, and AI agent coordination.
- Does not include code, schemas, or implementation-specific interfaces.

## Ownership
- Primary owner: Architecture Lead
- Contributing owners: Domain leads for each module area
- AI agent role: Propose module changes only through documented review and approved naming.

## Update Rules
- Add modules only when there is a clear product capability and ownership model.
- Keep module names stable once adopted.
- Mark modules as planned, active, deprecated, or removed.
- If a module is tenant-sensitive, explicitly label it.

## Catalog Format
- Module name
- Purpose
- Owner
- Status
- Tenant sensitivity
- Dependencies
- Notes

## Modules
### Identity and Access
- Purpose: Authentication, session handling, roles, permissions, and administrative access.
- Owner: Security / Platform
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Tenant resolution, audit logging
- Notes: Core guardrail module.

### Tenant Management
- Purpose: Tenant lifecycle, configuration, provisioning, and tenant-level administration.
- Owner: Platform
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access
- Notes: Must preserve isolation boundaries.

### Academic Operations
- Purpose: School operational workflows such as classes, terms, attendance, and related academic administration.
- Owner: Product domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Tenant Management
- Notes: Exact subdomains `[TBD]`.

### LMS
- Purpose: Learning content delivery, assignments, learner progress, and instructional workflows.
- Owner: Learning domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Tenant Management
- Notes: Keep learner-facing flows simple.

### Communication
- Purpose: Notices, messaging, and school community communication.
- Owner: Product domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access
- Notes: Privacy and moderation rules required.

### Reporting and Analytics
- Purpose: Operational reporting, summaries, and dashboards.
- Owner: Platform analytics lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Core domain modules
- Notes: Avoid data leakage through cross-tenant aggregation.

### Notifications
- Purpose: Event-driven notifications across supported channels.
- Owner: Platform
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Communication
- Notes: Channel policy `[TBD]`.

### Administration
- Purpose: Platform administration, support tools, and operational controls.
- Owner: Platform operations
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Audit
- Notes: Must be tightly controlled.

### Audit and Compliance
- Purpose: Immutable or tamper-evident records of important actions.
- Owner: Security / Compliance
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, all actioning modules
- Notes: Mandatory for sensitive workflows.

## Open Decisions
- Final module boundaries: `[TBD]`
- Shared services vs domain-specific services: `[TBD]`
- Deprecation policy for overlapping capabilities: `[TBD]`
