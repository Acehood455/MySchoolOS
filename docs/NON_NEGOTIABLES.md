# Non-Negotiables

## Purpose
Record the hard constraints that must never be violated. This document exists to prevent architecture drift, tenant isolation bugs, and security regressions.

## Scope
- Applies to all product decisions, architecture changes, agent-generated edits, and future module designs.
- Defines absolute guardrails, not preferences.
- Does not describe implementation code or database schema.

## Ownership
- Primary owner: Architecture Lead
- Security co-owner: Security Lead
- Change approval: Product Owner plus Architecture Lead for any exception request
- AI agent role: Treat this document as higher priority than roadmap convenience or feature requests.

## Update Rules
- Changes require explicit human approval and a written rationale.
- Exceptions must be time-bound, documented, and associated with a mitigation plan.
- If a rule becomes obsolete, it must be replaced with a stronger or equally strong safeguard.
- Never silently weaken a non-negotiable to unblock delivery.
- This document outranks convenience, speed, roadmap pressure, and implementation preference.
- Every AI tool must treat this as the primary guardrail document.

## Hard Constraints
1. Tenant data must never be accessible across tenant boundaries.
2. Authentication and authorization must be enforced server-side for every protected action.
3. Least privilege is mandatory for users, services, agents, and infrastructure access.
4. Sensitive data must be protected at rest, in transit, and in logs.
5. No feature may be shipped without a documented tenant impact review.
6. No module may assume a single-school deployment model.
7. No agent may invent schema, APIs, permissions, or workflows that are not explicitly approved.
8. No direct production changes may bypass review, traceability, and rollback planning.
9. No feature should create hidden coupling between tenants.
10. No shortcut may compromise auditability of user, administrative, or system actions.

## Examples
- Allowed: a role may access only the tenant data explicitly associated with the active request context.
- Not allowed: a shared admin view that reveals school records from another tenant for convenience.
- Allowed: a security fix that delays a release until tenant leakage risk is resolved.
- Not allowed: a temporary bypass of authorization checks in order to demo a feature.

## Decision Record
- Decision: Hard constraints are mandatory and exception-driven only.
- Status: Approved
- Reason: The platform handles sensitive school data across many tenants.
- Alternatives considered: Soft guidelines and phase-specific constraints.
- Date: `[TBD]`

## Product Guardrails
- Prefer simple, composable workflows over broad, monolithic screens.
- Prefer shared platform capabilities over tenant-specific special cases.
- Avoid feature creep by requiring a clear user problem, target persona, and success metric for every new request.
- Reject duplicated workflows unless there is a proven user or compliance requirement.

## Security Guardrails
- Never store secrets in source control or documentation.
- Never expose identifiers, tokens, or credentials in logs, screenshots, examples, or sample payloads.
- Never rely on client-side checks alone for security decisions.
- Never introduce unmanaged public endpoints for internal operations.
- Never permit tenant data exports without a defined authorization and audit trail.
- Never use sample data that resembles real tenant data.
- Never assume internal tools are exempt from security controls.

## Architecture Guardrails
- Keep tenant identity explicit in every request path, job, and integration boundary where it matters.
- Prefer clear service ownership and bounded contexts over shared mutable logic.
- Avoid cross-module assumptions that make future isolation or scaling harder.
- Keep external integrations behind stable interfaces and documented policies.
- Avoid shared helper layers that hide tenant-sensitive behavior.

## AI Contribution Rules
- AI tools must not soften, reinterpret, or “optimize away” any non-negotiable.
- AI tools must flag any request that would violate this file, even if the request seems small.
- AI tools should quote the relevant guardrail when refusing or modifying a risky request.
- AI tools must not introduce undocumented exception patterns.

## Review Requirements
- Architecture and security leads must review any requested exception.
- Reviewers must confirm the exception is time-bound and has a mitigation plan.
- All production-impacting changes must be checked against these constraints before merge.

## Change Management Requirements
- Any exception must have an owner, expiration, and compensating control.
- Update the exception record when the underlying issue is resolved.
- If a guardrail is revised, document why the old rule was insufficient.

## Exception Process
- Identify the rule being challenged.
- Document the business justification.
- Document the security and tenancy impact.
- Define a mitigation or compensating control.
- Record an expiry date or revisit milestone.
- Include links or references to the affected documents in the exception note.

## Open Decisions
- Exception owner role: `[TBD]`
- Required approval quorum for exceptions: `[TBD]`
