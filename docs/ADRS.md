# Architecture Decision Records

## Purpose
Record major architecture and platform decisions in a durable, reviewable format so future contributors can understand why the system is shaped the way it is.

## Scope
- Covers architectural direction, tenancy strategy, modularity, white-label strategy, and documentation governance decisions.
- Serves as the canonical record for decisions that influence system boundaries and long-term design.
- Does not contain implementation code or database schema.

## Ownership
- Primary owner: Architecture Lead
- Review owners: Security Lead, Product Lead, Platform Lead
- AI agent role: Use this document as a decision source, not a place to invent new architecture.

## Update Rules
- Create a new ADR when a durable decision changes the architecture, tenancy model, modular structure, or documentation policy.
- Do not rewrite historical ADRs unless correcting an obvious factual error.
- Keep each ADR small, specific, and traceable.
- If a decision changes, add a new ADR instead of silently overwriting the old one.
- Every ADR must be linked from related docs when relevant.

## How to Use This File
- Use the ADR template for new decisions.
- Read the existing ADRs before proposing changes that affect architecture.
- Treat approved ADRs as binding unless a newer ADR supersedes them.

## ADR Template
### ADR-000: `[Title]`
- ADR Number: `[TBD]`
- Date: `[TBD]`
- Status: Proposed | Approved | Superseded | Rejected
- Decision: `[TBD]`
- Context: `[TBD]`
- Alternatives Considered: `[TBD]`
- Reasoning: `[TBD]`
- Consequences: `[TBD]`
- Related Docs: `[TBD]`
- Notes: `[TBD]`

## ADR Index
| ADR Number | Date | Title | Status |
| --- | --- | --- | --- |
| ADR-001 | 2026-06-15 | Multi-tenant Architecture | Approved |
| ADR-002 | 2026-06-15 | School-Based Tenancy | Approved |
| ADR-003 | 2026-06-15 | Modular Feature System | Approved |
| ADR-004 | 2026-06-15 | White-Label Strategy | Approved |
| ADR-005 | 2026-06-15 | Documentation-First Development | Approved |

## ADR-001: Multi-tenant Architecture
- ADR Number: ADR-001
- Date: 2026-06-15
- Status: Approved
- Decision: `School OS` is a multi-tenant SaaS platform.
- Context: The platform must serve multiple schools on a shared product while preserving strict data and operational isolation.
- Alternatives Considered:
  - Single-tenant deployments per school
  - Customer-specific forks
  - Shared platform without explicit tenancy boundaries
- Reasoning: A multi-tenant model supports SaaS efficiency, centralized operations, and consistent product evolution while requiring explicit isolation controls.
- Consequences:
  - Tenant boundaries must be enforced everywhere.
  - Shared services must remain tenant-safe.
  - Testing and review must include cross-tenant leakage checks.
  - Documentation must describe tenancy assumptions clearly.
- Related Docs:
  - `NON_NEGOTIABLES.md`
  - `MULTI_TENANCY.md`
  - `SECURITY_REQUIREMENTS.md`
  - `ARCHITECTURE.md`
- Notes: This decision is foundational and should be treated as permanent unless superseded by a newer ADR.

## ADR-002: School-Based Tenancy
- ADR Number: ADR-002
- Date: 2026-06-15
- Status: Approved
- Decision: The school is the primary tenancy boundary.
- Context: Product behavior, data ownership, and permissions must align to the school rather than to an individual user or informal group.
- Alternatives Considered:
  - User-based tenancy
  - Organization group tenancy
  - Mixed tenancy boundaries by module
- Reasoning: School-based tenancy matches the product model, simplifies reasoning about ownership, and supports tenant-specific administration and auditing.
- Consequences:
  - Every tenant-owned record must map to exactly one school.
  - Cross-school data access is prohibited.
  - Support and admin tools must respect school context.
  - Reporting and export flows require tenant-aware controls.
- Related Docs:
  - `NON_NEGOTIABLES.md`
  - `MULTI_TENANCY.md`
  - `PRODUCT_REQUIREMENTS.md`
- Notes: Any future exception must be approved through the ADR process.

## ADR-003: Modular Feature System
- ADR Number: ADR-003
- Date: 2026-06-15
- Status: Approved
- Decision: Product capabilities are organized as modular features with clear boundaries and ownership.
- Context: The platform must support multiple major school workflows without collapsing into a single monolith or a loose collection of unrelated helpers.
- Alternatives Considered:
  - Monolithic feature delivery
  - Purely service-based decomposition with no product module model
  - Ad hoc feature grouping by UI screen
- Reasoning: Modular architecture makes ownership clear, reduces accidental coupling, and helps AI contributors avoid inventing broad catch-all systems.
- Consequences:
  - The module catalog must be maintained alongside architecture changes.
  - Shared logic must be justified rather than assumed.
  - New modules require review for tenant impact and ownership.
  - Feature flags may control rollout, but they do not replace architectural boundaries.
- Related Docs:
  - `MODULE_CATALOG.md`
  - `ARCHITECTURE.md`
  - `AGENT_RULES.md`
- Notes: Modules should reflect stable product boundaries, not temporary implementation shortcuts.

## ADR-004: White-Label Strategy
- ADR Number: ADR-004
- Date: 2026-06-15
- Status: Approved
- Decision: White-label support is limited to approved presentation and branding controls and must not create tenant-specific code forks.
- Context: The product needs brand-aware presentation for schools, but not at the cost of isolated code paths or hidden operational complexity.
- Alternatives Considered:
  - Full custom white-label forks per school
  - No white-label support
  - Theme-only customization with no brand controls
- Reasoning: Controlled white-labeling provides product flexibility while protecting maintainability, security, and tenant identity.
- Consequences:
  - Branding changes must remain within approved boundaries.
  - White-label settings must not affect authorization or data access.
  - Shared code must remain the source of truth for behavior.
  - Unsupported customizations must be rejected rather than improvised.
- Related Docs:
  - `VISION.md`
  - `NON_NEGOTIABLES.md`
  - `MULTI_TENANCY.md`
  - `SECURITY_REQUIREMENTS.md`
- Notes: Presentation flexibility is allowed; tenant boundary flexibility is not.

## ADR-005: Documentation-First Development
- ADR Number: ADR-005
- Date: 2026-06-15
- Status: Approved
- Decision: Business rules, architecture decisions, and project constraints must be documented before implementation starts.
- Context: Multiple AI contributors and human contributors need a single shared source of truth to avoid drift, guesswork, and contradictory implementation.
- Alternatives Considered:
  - Implementation-first development
  - Conversation-only decision making
  - Code comments as the primary source of truth
- Reasoning: Documentation-first development reduces ambiguity, improves review quality, and helps preserve architecture and security intent over time.
- Consequences:
  - New decisions must be recorded before code is written.
  - AI contributors must consult the governing docs before proposing changes.
  - Unresolved decisions remain `[TBD]` until approved.
  - Documentation updates are part of the change, not a side effect.
- Related Docs:
  - `AGENT_RULES.md`
  - `NON_NEGOTIABLES.md`
  - `PROJECT_CONTEXT.md`
  - `ARCHITECTURE.md`
- Notes: If documentation and implementation diverge, the documentation must be updated or the implementation must be corrected.

## Review Requirements
- New ADRs require review from architecture and affected domain owners.
- High-risk decisions require security review.
- Superseding an ADR requires a newer ADR with explicit rationale.

## Change Management Requirements
- Add new ADRs for new durable decisions.
- Do not delete approved ADRs when they become historical.
- Preserve ADR numbering and chronology.
- Link ADRs from affected docs when a decision changes them.

## Open Decisions
- ADR numbering policy for future documents: `[TBD]`
- Whether rejected ADRs should be indexed permanently: `[TBD]`
