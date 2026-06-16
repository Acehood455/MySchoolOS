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
- AI tools must treat MVP scope as a hard boundary, not an optimization target.

## MVP Definition
The MVP is the smallest end-to-end product that allows a real school tenant to operate core school workflows safely, with tenant isolation, auditability, and basic administration in place.

## Scope Philosophy
- Ship the minimum safe path to real use.
- Prefer depth in a small number of workflows over breadth across many half-finished features.
- Defer advanced customization until the core operating loop is stable.

## In Scope
- Tenant onboarding and tenant-aware access control
- Role-based access for Super Admin, School Admin, Teacher, Parent, and Student
- Core school administration workflows: tenant setup, school profile, staff invitation, and role assignment
- Core learning workflows: assigned learning activity access and completion
- Core attendance workflows: record, review, and report attendance
- Core results workflows: enter, review, and publish results
- Basic communication workflows: school notices and approved parent follow-up
- Operational dashboards or summaries: tenant operational dashboard and school administration summary
- Security and audit foundations
- Support tooling required to operate pilot tenants
- Minimal white-label branding controls: school name, logo, and primary color

## Examples
- In scope example: role-based onboarding for a pilot school.
- Out of scope example: multi-brand theme customization for every tenant.
- In scope example: a simple teacher workflow that is reliable and auditable.
- Out of scope example: a highly flexible workflow designer for every edge case.

## Explicitly Out of Scope
- Deep customization engines
- Advanced analytics and AI automation
- Extensive third-party marketplace features
- Multi-brand white-label complexity beyond approved needs
- Non-essential integrations
- Nice-to-have workflows that do not unblock pilot usage
- Gamification
- Educational games
- Live classes
- Mobile applications

## Decision Record
- Decision: The MVP is intentionally narrow and pilot-driven.
- Status: Approved
- Reason: Early releases must prove safety, usability, and operational viability before expanding.
- Alternatives considered: Broad alpha release and "build everything core-related" scope.
- Date: 2026-06-16

## AI Contribution Rules
- AI tools may suggest scope reductions to improve clarity, but they may not add unapproved items.
- AI tools must surface scope creep risks immediately.
- AI tools must preserve the distinction between MVP and later-phase capabilities.
- If a prompt asks for "just one more feature," AI tools should check this document first.

## Review Requirements
- Product, engineering, architecture, and security must agree before expanding MVP.
- Every included item should have a clear pilot value statement.
- Every excluded item should remain listed until explicitly re-evaluated.

## Change Management Requirements
- Maintain a history of what moved into MVP and why.
- Document every removed or deferred item if it was previously under consideration.
- Revalidate MVP scope after each major product review.

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
- MVP launch tenant count: One to three pilot tenants.
- White-label minimum set: School name, logo, and primary color.
