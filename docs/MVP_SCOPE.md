# MVP Scope

## Purpose
Define the minimum product boundary for the first shippable release so the team can deliver a coherent, secure, and supportable platform.

## Scope
- Covers what is included in MVP, what is excluded, and what must be true before launch.
- Protects the team from feature creep and premature expansion.
- Does not specify technical implementation details.

## Ownership
- Primary owner: Product Manager
- Delivery owner: Engineering Lead
- Quality gates: Architecture Lead and Security Lead
- AI agent role: Use this document as the default answer to "should we add this now?"

## Update Rules
- Only expand MVP scope through explicit approval.
- Every addition must remove an equal or larger amount of uncertainty, risk, or manual work.
- If a feature does not help a pilot tenant succeed, it is likely not MVP.
- Mark deferred items clearly and keep them out of implementation plans.

## MVP Definition
The MVP is the smallest end-to-end product that allows a real school tenant to operate a core academic workflow safely, with tenant isolation, auditability, and basic administration in place.

## In Scope
- Tenant onboarding and tenant-aware access control
- Role-based access for core user types
- Core school administration workflows: `[TBD]`
- Core learning workflows: `[TBD]`
- Basic communication workflows: `[TBD]`
- Operational dashboards or summaries: `[TBD]`
- Security and audit foundations
- Support tooling required to operate pilot tenants

## Explicitly Out of Scope
- Deep customization engines
- Advanced analytics and AI automation
- Extensive third-party marketplace features
- Multi-brand white-label complexity beyond approved needs
- Non-essential integrations
- Nice-to-have workflows that do not unblock pilot usage

## MVP Exit Criteria
- A pilot school can complete the target core workflow end to end.
- Tenant boundaries are verified in real usage.
- Security review is complete.
- Support team can operate the platform without engineering intervention for standard cases.
- Product and architecture owners agree the MVP is shippable.

## MVP Guardrails
- No roadmap expansion during MVP without explicit triage.
- No bespoke tenant feature requests unless they unblock the pilot and are approved.
- No polished advanced workflows ahead of core reliability.

## Open Decisions
- Exact core workflow list: `[TBD]`
- Pilot success threshold: `[TBD]`
- MVP launch tenant count: `[TBD]`
