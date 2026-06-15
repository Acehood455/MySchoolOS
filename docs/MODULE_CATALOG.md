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
- AI tools must not create new module names just because they sound cleaner.

## Catalog Format
- Module name
- Purpose
- Owner
- Status
- Tenant sensitivity
- Dependencies
- Notes

## Module Design Rules
- Each module must have a clear purpose and owner.
- Modules should map to real product capabilities, not implementation shortcuts.
- Overlapping responsibilities must be justified and minimized.
- Tenant-sensitive modules must be reviewed with security and tenancy in mind.

## Modules
### Identity and Access
- Purpose: Authentication, session handling, roles, permissions, and administrative access.
- Owner: Security / Platform
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Tenant resolution, audit logging
- Notes: Core guardrail module.
- Decision record: Must remain centralized unless a future architecture decision explicitly changes the model.

### Tenant Management
- Purpose: Tenant lifecycle, configuration, provisioning, and tenant-level administration.
- Owner: Platform
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access
- Notes: Must preserve isolation boundaries.
- Decision record: Tenant lifecycle ownership stays explicit and documented.

### Academic Operations
- Purpose: School operational workflows such as classes, terms, attendance, timetable, and related academic administration.
- Owner: Product domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Tenant Management
- Notes: Exact subdomains `[TBD]`.
- Decision record: Subdomain boundaries are deferred until product requirements settle.

### LMS
- Purpose: Learning content delivery, assignments, learner progress, and instructional workflows.
- Owner: Learning domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Tenant Management
- Notes: Keep learner-facing flows simple.
- Decision record: LMS capabilities should remain tightly coupled to learner usefulness, not feature breadth.

### Communication
- Purpose: Notices, messaging, and school community communication.
- Owner: Product domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access
- Notes: Privacy and moderation rules required.
- Decision record: Communication remains tenant-scoped unless a documented exception exists.

### Reporting and Analytics
- Purpose: Operational reporting, summaries, dashboards, and decision support analytics.
- Owner: Platform analytics lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Core domain modules
- Notes: Avoid data leakage through cross-tenant aggregation.
- Decision record: Cross-tenant aggregation requires explicit policy and review.

### Notifications
- Purpose: Event-driven notifications across supported channels.
- Owner: Platform
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Communication
- Notes: Channel policy `[TBD]`.
- Decision record: Notification channels must be approved before use.

### Administration
- Purpose: Platform administration, support tools, feature flag controls, and operational controls.
- Owner: Platform operations
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Audit
- Notes: Must be tightly controlled.
- Decision record: Support tooling must not expand into unrestricted data access.

### Audit and Compliance
- Purpose: Immutable or tamper-evident records of important actions.
- Owner: Security / Compliance
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, all actioning modules
- Notes: Mandatory for sensitive workflows.
- Decision record: Audit coverage is a baseline requirement for sensitive operations.

### Finance
- Purpose: Billing-related school finance workflows, receivables, and financial reporting within tenant boundaries.
- Owner: Finance domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Tenant Management, Audit and Compliance
- Notes: Requires stronger controls than general admin data.

### Results
- Purpose: Learner results capture, grading, publishing, and report visibility controls.
- Owner: Academic domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Academic Operations, Audit and Compliance
- Notes: Publication rules must be explicit.

### Parent Portal
- Purpose: Parent and guardian access to approved school information and learner-related views.
- Owner: Product domain lead
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Academic Operations, Communication
- Notes: Parent access must be narrowly scoped.

### Feature Flags
- Purpose: Controlled rollout, experimentation, and tenant-safe release management.
- Owner: Platform
- Status: `[TBD]`
- Tenant sensitivity: High
- Dependencies: Identity and Access, Administration
- Notes: Feature flags must not override security or tenancy rules.

### White-Label Presentation
- Purpose: Approved branding, theme, and tenant presentation controls.
- Owner: Platform / Product
- Status: `[TBD]`
- Tenant sensitivity: Medium
- Dependencies: Tenant Management, Administration
- Notes: Must not become a custom code path per tenant.

## Examples
- Good module: "Tenant Management" because it has a clearly bounded responsibility.
- Risky module: "Utility Services" because it can become a catch-all with hidden coupling.
- Good module change: splitting reporting from operational administration when ownership is distinct.
- Risky module change: merging communication and notifications into an ambiguous shared bucket.

## Decision Record
- Decision: The catalog tracks logical platform modules with ownership and sensitivity.
- Status: Approved
- Reason: The team needs a stable shared vocabulary for planning and architecture.
- Alternatives considered: No module catalog and implementation-only organization.
- Date: `[TBD]`

## AI Contribution Rules
- AI tools may suggest module refinements, but they must preserve ownership and boundary clarity.
- AI tools must not introduce "miscellaneous" or "shared" modules that hide accountability.
- AI tools must update dependencies when a module boundary changes.
- AI tools should flag module overlap as a design risk.

## Review Requirements
- Architecture must approve module additions, removals, and boundary shifts.
- Security must review any module handling identity, tenancy, audit, exports, or sensitive data.
- Product must confirm module value before new domain modules are introduced.

## Change Management Requirements
- Record why a module exists and what problem it solves.
- Mark deprecated modules clearly and document replacement intent.
- Revisit the catalog whenever roadmap or architecture decisions change ownership boundaries.

## Open Decisions
- Final module boundaries: `[TBD]`
- Shared services vs domain-specific services: `[TBD]`
- Deprecation policy for overlapping capabilities: `[TBD]`
- Whether feature flags are a dedicated module or platform service: `[TBD]`
- White-label ownership split: `[TBD]`
