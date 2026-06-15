# Non-Negotiables

## Purpose
This document is the constitution of the project. It defines absolute requirements that govern every product decision, architecture decision, implementation decision, AI contribution, review, and release.

## Scope
- Applies to all documentation, product planning, design, architecture, implementation, testing, deployment, operations, and support work.
- Applies to every AI tool that contributes to the codebase or documentation.
- Does not describe implementation code or database schema.

## Ownership
- Primary owner: Architecture Lead
- Security co-owner: Security Lead
- Product co-owner: Product Lead
- Exception approval: Product Lead plus Architecture Lead plus Security Lead
- AI agent role: Treat this document as the highest-priority project authority.

## Update Rules
- Changes require explicit human approval.
- Changes require a written rationale and a linked decision record.
- Changes must preserve or strengthen the existing standard.
- No rule may be softened to reduce delivery friction.
- Deprecated rules must be replaced with rules that are equal in strength or stronger.

## Constitution
All rules in this document are absolute requirements. Any conflict with these rules is a project defect, not a preference difference.

## Non-Negotiable Rules
1. Every tenant-owned record must belong to exactly one school.
2. No cross-school data access is permitted.
3. No request, job, or integration may act on tenant data without explicit tenant context.
4. No tenant context may be inferred ambiguously.
5. No tenant identifier may be omitted from tenant-scoped operations.
6. No shared cache, queue, index, export, or file store may leak data across schools.
7. No global admin tool may expose tenant data without explicit authorization and audit logging.
8. No authentication or authorization decision may rely on client-side enforcement.
9. All protected actions must be authorized on the server.
10. Least privilege is mandatory for every user, service, agent, and system identity.
11. Every privileged action must be auditable.
12. Every security-relevant action must leave a traceable record.
13. No secret may be stored in source control.
14. No secret may be stored in documentation.
15. No secret may be exposed in logs, screenshots, examples, or sample payloads.
16. No production change may bypass review.
17. No production change may bypass rollback planning.
18. No production change may bypass traceability.
19. No feature may ship without a documented tenant impact review.
20. No feature may ship without a documented security review when it touches identity, tenancy, exports, finance, communication, or sensitive data.
21. No module may assume a single-school deployment model.
22. No module may hard-code tenant-specific behavior into shared platform logic.
23. No business rule may exist only in implementation if it can be documented first.
24. All business rules must be documented before implementation starts.
25. No architecture change may be made without an ADR update.
26. No module boundary may change without updating the module catalog.
27. No tenancy model change may be made without updating the multi-tenancy document.
28. No security control change may be made without updating the security requirements document.
29. No roadmap change may contradict the MVP scope.
30. No roadmap change may add scope without a clear user problem and owner.
31. No feature creep is permitted by default.
32. No AI agent may modify protected zones without explicit approval.
33. Protected zones include `NON_NEGOTIABLES.md`, `SECURITY_REQUIREMENTS.md`, `MULTI_TENANCY.md`, `ARCHITECTURE.md`, and any other document marked as authoritative.
34. No AI agent may invent schema, APIs, permissions, integrations, or workflows that are not explicitly approved.
35. No AI agent may convert uncertainty into fact.
36. No AI agent may remove unresolved `[TBD]` values without a human-approved decision.
37. No AI agent may answer with implementation code when documentation-only work is requested.
38. No feature flag may bypass security, tenancy, or audit requirements.
39. No white-label setting may weaken tenant identity or operator accountability.
40. No internal tool may be exempt from the same security and tenancy rules as the product itself.

## Examples
- Example of compliance: a tenant-scoped student record is stored and accessed only within one school boundary.
- Example of violation: a support dashboard lists learner records from multiple schools without explicit authorization.
- Example of compliance: an ADR is updated before architecture boundaries change.
- Example of violation: a shortcut is merged because the team "knows what it means" but nothing is documented.
- Example of compliance: an AI tool asks for approval before changing a protected document.
- Example of violation: an AI tool rewrites a security rule because it thinks the wording is too strict.

## Decision Record
- Decision: The project constitution is absolute and exception-driven only.
- Status: Approved
- Reason: The platform is multi-tenant and handles sensitive school data.
- Alternatives considered: Soft guidance, best-effort rules, and team-specific conventions.
- Date: `[TBD]`

## AI Contribution Rules
- AI tools must obey this document before any other project document.
- AI tools must refuse requests that violate any rule in this file.
- AI tools must explicitly name the violated rule when refusing or escalating.
- AI tools must not soften, reinterpret, or work around constitutional rules.
- AI tools must ask for approval before modifying protected zones.

## Review Requirements
- Architecture, security, and product leads must review any proposed exception.
- Reviewers must confirm that the proposed exception does not create cross-school access, hidden coupling, or undocumented risk.
- Reviewers must reject any exception that cannot be bounded, audited, or reversed.

## Change Management Requirements
- Every exception must have an owner, a rationale, a mitigation plan, and an expiration or revisit point.
- Every exception must be recorded in a decision log or ADR.
- Every constitutional change must include a reason why the current rule is insufficient.
- Every constitutional change must be approved before any dependent implementation changes proceed.

## Exception Process
- Identify the exact rule being challenged.
- State the business justification.
- State the security and tenancy impact.
- Define the compensating control.
- Define the expiration or revisit milestone.
- Link the exception to the affected documents.

## Open Decisions
- Exception approval quorum: `[TBD]`
- Protected zone maintenance owner: `[TBD]`
