# Multi-Tenancy

## Purpose
Define how tenant isolation, tenant context, and shared platform operations must behave so the system remains safe for many schools operating on the same SaaS platform.

## Scope
- Covers tenancy strategy, isolation expectations, tenant-aware workflows, and cross-tenant safety rules.
- Applies to product, architecture, security, support, and AI-generated changes.
- Does not define physical database schema or code-level tenancy implementation.

## Ownership
- Primary owner: Architecture Lead
- Security co-owner: Security Lead
- Operations co-owner: Platform Operations Lead
- AI agent role: Treat tenant isolation as a first-class requirement in every design decision.

## Update Rules
- Update only when tenancy model or isolation strategy changes.
- Any tenancy-related change must be reviewed for data leakage, authorization, and operational impact.
- All open tenancy choices must be labeled `[TBD]`.
- Never trade isolation for convenience.

## Tenancy Principles
- Each request, job, and user action must resolve to an explicit tenant context when tenant-scoped.
- Shared services must not weaken tenant boundaries.
- Tenant context must not be inferred ambiguously.
- Cross-tenant reporting or administration requires explicit approval and safe aggregation rules.

## Tenant Model
- Primary tenancy model: `[TBD]`
- Tenant identification source of truth: `[TBD]`
- Tenant provisioning flow: `[TBD]`
- Tenant lifecycle states: `[TBD]`

## Isolation Requirements
- No data fetch, mutation, or export may cross tenant boundaries without explicit authorization and review.
- Background jobs must carry tenant context where applicable.
- Caches, queues, search indexes, file storage, and observability tools must be tenant-safe.
- Shared operational tooling must not expose tenant data outside authorized support roles.

## Cross-Tenant Operations
- Aggregated metrics are allowed only if they are intentionally non-identifying and reviewed for leakage risk.
- Support actions affecting multiple tenants must have explicit operator authorization.
- Global administrative views must be tightly restricted and audited.

## Tenant Configuration
- Tenant-specific configuration must remain within approved boundaries.
- Configuration should not become a hidden code fork.
- Default behavior should be safe for a newly created tenant.

## Risk Areas
- Background processing without tenant context
- Shared caches or indexes
- Overly broad admin roles
- Export and reporting workflows
- External integrations that store tenant data in third-party systems

## Verification Expectations
- Tenant isolation must be included in design review, testing strategy, and release review.
- Security and QA must verify high-risk cross-tenant paths.
- Any suspected leak must be treated as a severity issue.

## Open Decisions
- Isolation pattern choice: `[TBD]`
- Whether any shared data domain is permitted: `[TBD]`
- Cross-tenant reporting policy: `[TBD]`
