# Architecture

## Purpose
Define the architectural direction, system boundaries, and decision principles so all contributors avoid drift and keep the platform secure, scalable, modular, and maintainable.

## Scope
- Covers the high-level system design and architectural decision rules.
- Identifies major components and their responsibilities.
- Does not define implementation code or database schema.

## Ownership
- Primary owner: Architecture Lead
- Reviewers: Security Lead, Platform Lead, Product Lead
- AI agent role: Use this document as the source of truth for design consistency and avoid inventing new patterns.

## Update Rules
- Update only when architecture decisions are formally reviewed.
- Preserve backward compatibility unless a breaking change is explicitly approved.
- Record unresolved areas as `[TBD]` with decision owners.
- Any exception to the documented direction must be logged in `ADRS.md`.
- AI tools must treat this document as the architecture authority, not a suggestion.

## Architecture Principles
- Strong tenant isolation first.
- Security first.
- Documentation first.
- Clear module boundaries over shared accidental coupling.
- Modular architecture over monolithic convenience.
- Security by default and least privilege everywhere.
- Operational simplicity over premature optimization.
- Observability built in, not added later.
- Keep the platform extensible without allowing arbitrary tenant-specific forks.
- Feature flags are mandatory for controlled rollout of eligible capabilities.
- White-label support is allowed only within documented branding boundaries.

## Architecture Objectives
- Make tenant isolation obvious and enforceable.
- Keep the system understandable for both humans and AI contributors.
- Minimize incidental complexity in shared platform layers.
- Keep operational support practical for a small team.

## System View
### Client Layer
- Web app first for MVP; other approved client surfaces remain deferred until explicitly reviewed.
- Must honor role-based access and tenant context.

### Application Layer
- Domain-aligned services or modules handle business logic.
- Administrative and user workflows must share the same security model.

### Integration Layer
- External systems must connect through controlled interfaces.
- Each integration requires a documented owner and security review.

### Data Layer
- Data storage strategy: single Neon PostgreSQL database with shared tables and `school_id` tenant isolation
- Data access must enforce tenant boundaries and auditing requirements.

### Platform Services
- Authentication and authorization
- Tenant resolution
- Audit logging
- Notifications
- Observability
- Background processing

### Foundation Request Pipeline
- Protected API requests must resolve tenant context once, then authenticate the session, then resolve authorization, then execute the route, then emit audit events.
- Route handlers must consume the resolved request context instead of repeating tenant, session, or authorization checks.
- The request context is the server-side source of truth for `requestId`, `correlationId`, `tenantId`, `actorId`, authenticated session state, and role assignments.
- Authentication and authorization must reuse the resolved tenant context so tenant-scoped access stays bound to the same request boundary.
- The API foundation layer owns the request hooks and plugin registration for tenant resolution, session authentication, authorization, and audit emission.
- Failed tenant resolution, failed authentication, and denied authorization must all be auditable through the foundation pipeline.
- Route handlers should read the resolved context only; they should not perform tenant resolution, session validation, or authorization checks themselves.

## Examples
- Good architectural choice: a dedicated tenant context rule that applies to every tenant-scoped request.
- Bad architectural choice: global data access helpers that quietly skip tenant checks.
- Good integration choice: a documented boundary with explicit owner and review.
- Bad integration choice: direct ad hoc integration from arbitrary code paths.

## Boundary Rules
- Do not let one module read or mutate another module's data directly unless the boundary is explicitly approved.
- Do not duplicate business rules across modules without a documented reason.
- Do not hard-code tenant-specific behavior in shared platform code.
- Do not create "temporary" shortcuts that bypass architectural boundaries.
- Shared tables are allowed only when every tenant-owned row is scoped by `school_id` and every tenant-scoped query resolves tenant context before access.

## Decision Areas
- Deployment topology: One shared web app and one API surface, with a separate worker only if background jobs require it.
- Service decomposition strategy: Keep one deployable product core and avoid microservices until scale proves they are needed.
- Eventing approach: Use direct application events plus a worker queue only where needed.
- Caching strategy: Avoid distributed caching until a concrete performance problem exists, then scope every cache key by tenant.
- Search strategy: Use a tenant-scoped search model only when search is needed, and keep the first version simple.
- File storage strategy: Isolate every object path or bucket by tenant and keep file access server-controlled.
- Feature flag platform choice: Use a lightweight feature-flag system that supports per-tenant targeting and auditability.
- White-label presentation strategy: Implement branding as theme tokens and configuration, not tenant-specific code.

## Decision Record
- Decision: The architecture is boundary-driven and tenant-first.
- Status: Approved
- Reason: The platform's core risk is not just scale, but safe multi-tenant operation.
- Alternatives considered: Monolithic convenience-first design and ad hoc feature-by-feature architecture.
- Date: 2026-06-16

## AI Contribution Rules
- AI tools may propose design alternatives, but they must preserve the documented principles.
- AI tools must explain when a suggestion trades simplicity for risk.
- AI tools must cite impacted documents when recommending architecture changes.
- AI tools must not invent service boundaries or infrastructure assumptions.

## Review Requirements
- Major changes require architecture review and security review.
- Tenant-sensitive changes require a documented isolation impact assessment.
- Changes affecting module boundaries must update the module catalog.

## Change Management Requirements
- Capture decisions with rationale, alternatives, and follow-up actions.
- Update related docs together when an architectural shift affects them.
- If a decision is deferred, assign an owner and revisit date.

## Operational Expectations
- Health, logs, metrics, and traces must support supportability.
- Rollbacks must be possible for production releases.
- Failure modes must be understood and documented for critical paths.

## Architecture Drift Prevention
- New modules require a boundary review.
- Major changes require update of `MODULE_CATALOG.md`, `MULTI_TENANCY.md`, and `SECURITY_REQUIREMENTS.md`.
- Architecture decisions should be captured in `ADRS.md` with rationale and alternatives considered.

## Open Decisions
- Primary architecture style: Modular monolith with explicit domain boundaries.
- Service ownership model: One owner per module or platform service, with shared infrastructure only for cross-cutting concerns.
- Cross-cutting platform stack: Standardize on one observability and one background-processing approach that fits the approved web stack.
- Whether AI insights are a first-party service or integrated capability: Defer AI insights until the core operating system is stable.
