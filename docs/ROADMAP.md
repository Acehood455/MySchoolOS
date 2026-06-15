# Roadmap

## Purpose
Provide the product and delivery sequence for the platform while preventing feature creep and preserving architectural discipline.

## Scope
- Covers phased delivery, dependency ordering, and release criteria.
- Describes what should happen first, what must wait, and why.
- Does not define detailed task plans or code implementation.

## Ownership
- Primary owner: Product Manager
- Delivery owners: Engineering Lead, Architecture Lead, Security Lead
- AI agent role: Keep roadmap language aligned to approved priorities and update only when the plan is formally changed.

## Update Rules
- Update only after roadmap review or scope approval.
- Every new item must map to a stated user problem and a release objective.
- Remove or defer items that do not support the current phase.
- When priorities change, preserve a clear record of what moved and why.

## Planning Horizons
### Now
- Focus: `[TBD]`
- Goal: Deliver the minimum safe product foundation.

### Next
- Focus: `[TBD]`
- Goal: Expand core operational workflows after MVP stability is proven.

### Later
- Focus: `[TBD]`
- Goal: Add advanced platform capabilities only after core adoption and reliability targets are met.

## Phase Structure
### Phase 0: Foundation
- Establish product governance documents.
- Confirm tenancy, security, and architecture decisions.
- Define MVP boundaries and release criteria.

### Phase 1: MVP
- Deliver the smallest coherent school operating experience.
- Validate core workflows with real pilot tenants.
- Prove tenant isolation, authentication, and auditability.

### Phase 2: Expansion
- Add high-value workflows adjacent to the MVP.
- Improve reporting, automation, and operational controls.
- Extend integrations only after stability is proven.

### Phase 3: Scale
- Optimize for multi-tenant administration at larger scale.
- Improve resilience, observability, and self-service.
- Add advanced configuration only when it does not erode maintainability.

## Roadmap Rules
- Do not promote a feature into an earlier phase unless it is required to make the current phase safe or usable.
- Do not add a feature because it is popular if it does not support the platform thesis.
- Do not use roadmap space for speculative ideas without a defined problem and owning team.

## Release Gates
- Tenant isolation review complete.
- Security review complete.
- Performance and reliability targets defined.
- Rollback and support readiness documented.
- Product acceptance criteria signed off.

## Open Decisions
- MVP release target date: `[TBD]`
- Pilot tenant count: `[TBD]`
- Expansion themes: `[TBD]`
