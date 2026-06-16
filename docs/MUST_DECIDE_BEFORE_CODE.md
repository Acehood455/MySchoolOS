# Must Decide Before Code

## Purpose
This document groups unresolved decisions in the governance docs into practical timing buckets for implementation planning.

## How To Read This
- `Tier 0` means the team should decide before implementation starts.
- `Tier 1` means the team should decide before database design is finalized.
- `Tier 2` means the team should decide before UI design is finalized.
- `Tier 3` means the team can defer the decision until later, but it should still be tracked.
- The recommendations below are defaults, not approvals. They are tuned for a multi-tenant SaaS school platform using React, TypeScript, and Neon PostgreSQL.

## Resolved Decisions
- Single Neon PostgreSQL database with shared tables and `school_id` tenant isolation.
- Server-managed session authentication.
- Admin-created users only for MVP.
- Fixed MVP role matrix.
- Final attendance rules.
- Final results rules.
- Finalized implementation plan.

## Product

### Tier 0
- `Initial user journey priorities`: This matters because it tells the team what to build first and what to ignore; if postponed, implementation will drift into inconsistent assumptions; default choice: ship tenant onboarding, role-based access, staff invite/assignment, attendance, basic results, parent communication, and school admin basics first.
- `Pilot success threshold`: This matters because it defines what "working" means for the first school; if postponed, the MVP will be hard to judge; default choice: define success as a pilot school completing the core workflow end to end with verified tenant isolation and no manual engineering intervention for standard cases.

### Tier 1
- `Final target market`, `primary geographic market`, `initial school segment`, and `supported school types`: This matters because market choice affects compliance, workflow complexity, and onboarding language; if postponed, the product may be built for everyone and fit no one well; default choice: start with one country and one clearly bounded school segment, preferably the simplest pilot-friendly segment rather than multiple segments at once.
- `Monetization model`: This matters because pricing shape affects tenant packaging, onboarding, and support commitments; if postponed, sales assumptions will leak into product decisions; default choice: per-school subscription first, with add-ons only after core usage is stable.
- `Primary integrations` and `compliance requirements`: This matters because integrations and compliance shape scope, risk, and launch sequencing; if postponed, the team may build flows that later fail legal or operational review; default choice: keep MVP integrations to the minimum required for onboarding and communication, and defer jurisdiction-specific compliance until the launch market is chosen.

### Tier 2
- `White-label strategy`, `white-label minimum set`, and `white-label rollout timing`: This matters because branding touches tenant identity and UI scope; if postponed, the team may overbuild theme support or expose brand options too early; default choice: support school name, logo, and color tokens first, and defer deeper branding and rollout complexity until the core app is stable.
- `Custom domain behavior`: This matters because domains affect onboarding, branding, and support; if postponed, every school may end up with a different URL assumption; default choice: use tenant subdomains first and add custom apex domains only after auth, provisioning, and TLS automation are proven.

### Tier 3
- `Success metrics` such as adoption rate, weekly active users, task completion rate, and support ticket volume per tenant: This matters because metrics guide product direction; if postponed, the launch may lack objective feedback; default choice: start with a small metric set focused on pilot completion, support load, and tenant retention.
- `MVP launch tenant count`, `pilot tenant count`, and `expansion themes`: This matters because rollout volume determines how much operational hardening is needed; if postponed, capacity planning will be vague; default choice: pilot with one to three tenants, then expand only after the first workflow is stable.

## Architecture

### Tier 0
- `Primary architecture style`: This matters because it determines how modules, teams, and boundaries are organized; if postponed, the codebase may become inconsistent from day one; default choice: a modular monolith with explicit domain boundaries is the safest fit for a React plus TypeScript SaaS MVP.
- `Deployment topology`: This matters because deployment shape affects reliability, cost, and release speed; if postponed, environment assumptions will diverge; default choice: one web app plus one API surface and a separate worker only if background jobs truly require it.
- `Service decomposition strategy`: This matters because it defines whether the system is a single deployable, multiple services, or a hybrid; if postponed, module boundaries will be harder to preserve; default choice: keep one deployable product core and avoid microservices until scale proves they are needed.
- `Client surfaces`: This matters because it determines which apps and channels need to be built and secured; if postponed, UI and auth decisions will fragment; default choice: web-first, with no additional client surface until the web experience is stable.
- `Service ownership model`: This matters because ownership drives accountability for boundaries and maintenance; if postponed, shared code will become a catch-all; default choice: one owner per module or platform service, with shared infrastructure only for cross-cutting concerns.
- `Shared services vs domain-specific services`: This matters because it decides how much logic is reusable versus bounded; if postponed, business rules may leak across modules; default choice: keep shared services limited to auth, tenant resolution, audit, notifications, and observability.
- `Final module boundaries`: This matters because modules define what can evolve independently; if postponed, teams may create accidental coupling; default choice: keep modules aligned to the existing catalog and split only when a real product boundary is proven.
- `Framework conventions`, `primary language(s)`, `shared repository layout`, `formatting tools`, `linting rules`, and `testing stack`: This matters because the stack determines how fast and safely the team can ship; if postponed, code style and test expectations will diverge; default choice: standardize on React and TypeScript, one shared repository, and a single formatting/linting/testing toolchain from the start.
- `Feature flags as a dedicated module or platform service`: This matters because release control needs a clear home; if postponed, rollout logic may scatter across the codebase; default choice: treat feature flags as a platform service with a clear API and audit trail, not as a product feature module.

### Tier 1
- `Eventing approach`: This matters because it affects async processing, integration, and workflow reliability; if postponed, background behavior will be ad hoc; default choice: stay simple at first and use direct application events plus a worker queue only where needed.
- `Caching strategy`: This matters because tenant-safe caching is a common source of leakage; if postponed, accidental cross-tenant reuse becomes likely; default choice: avoid distributed caching until a concrete performance problem exists, then scope every cache key by tenant.
- `Search strategy`: This matters because search indexes can leak data across schools; if postponed, the team may build a non-tenant-safe search layer; default choice: use a tenant-scoped search model only when search is needed, and keep the first version simple.
- `File storage strategy`: This matters because uploads and exports can leak data across tenants; if postponed, file paths and permissions will be inconsistent; default choice: isolate every object path or bucket by tenant and keep file access server-controlled.
- `Feature-flag platform choice`: This matters because controlled rollout is a documented principle; if postponed, release management will be manual and risky; default choice: choose a lightweight feature-flag system that supports per-tenant targeting and auditability.
- `White-label presentation strategy`: This matters because branding needs to remain inside safe boundaries; if postponed, theme logic can become a hidden fork; default choice: implement branding as theme tokens and configuration, not tenant-specific code.
- `Whether AI insights are a first-party service or an integrated capability`: This matters because it changes architecture, cost, and scope; if postponed, the roadmap may overcommit to AI features; default choice: defer AI insights until the core operating system is stable.

### Tier 2
- `Cross-cutting platform stack`: This matters because shared tooling choices affect the whole codebase; if postponed, the team may mix patterns and libraries; default choice: standardize early on one observability and one background-processing approach that fits the chosen React plus TypeScript stack.

### Tier 3
- `Deprecation policy for overlapping capabilities`: This matters because module overlap can create long-term maintenance debt; if postponed, old paths may live forever; default choice: require explicit deprecation notes, owners, and removal criteria when a capability is replaced.
- `White-label ownership split`: This matters because branding work crosses product and platform boundaries; if postponed, nobody will know who approves changes; default choice: make platform own implementation and product own allowed brand policy.

## Security

### Tier 0
- `Service-to-service authentication policy`: This matters because internal calls still need trust boundaries; if postponed, internal APIs may become implicitly trusted; default choice: use short-lived signed service credentials or equivalent controlled machine identity, never shared secrets in source control.
- `Authorization detail beyond the current principles`: This matters because "server-side auth" is not enough to build safely; if postponed, roles and permission checks will be guessed in code; default choice: centralize authorization rules and keep privileged actions explicit and auditable.

### Tier 1
- `Audit event taxonomy`: This matters because the platform must know which actions are security-relevant; if postponed, audit logs will be incomplete or noisy; default choice: log identity changes, tenant changes, exports, grading publication, admin actions, and all support actions that touch tenant data.
- `High-risk approval chain` for security-sensitive changes: This matters because identity, tenancy, exports, finance, and admin flows need controlled review; if postponed, risky changes may move too fast; default choice: require product, architecture, and security sign-off for anything in those areas.

### Tier 3
- `Required compliance frameworks`: This matters because compliance choices determine policy, documentation, and launch market; if postponed, the team may overbuild for the wrong regime; default choice: defer formal compliance commitments until the geographic market is chosen, then adopt the smallest applicable baseline first.
- `Encryption and key-management standard`: This matters because data protection and rotation policy depend on it; if postponed, infrastructure may be built without a stable security baseline; default choice: use the managed encryption and key rotation capabilities of the chosen hosting stack and document them clearly.
- `Incident severity policy`: This matters because support and engineering need a shared response language; if postponed, every incident will be handled ad hoc; default choice: classify tenant leakage and auth bypass as highest severity, then map outages and degraded service beneath that.

## Multi-Tenancy

### Tier 1
- `Cross-tenant reporting policy`: This matters because analytics and support often want aggregate views; if postponed, reporting may leak tenant data; default choice: no cross-tenant reporting in MVP except intentionally non-identifying aggregates.

### Tier 2
- `White-label policy linkage`: This matters because branding must never weaken tenancy; if postponed, presentation settings may begin to affect access rules; default choice: keep branding strictly separate from authorization and data boundaries.

## Database

### Tier 1
- `Schema organization`: This matters because modular code needs a corresponding data model; if postponed, tables will not map cleanly to modules; default choice: organize tables by domain/module and keep shared lookup tables tightly limited.
- `Database enforcement mechanism`: This matters because tenant isolation should not depend only on application discipline; if postponed, the database becomes a passive bucket; default choice: combine application checks with database constraints and row-level protections where available.
- `Audit storage model`: This matters because security actions must be traceable; if postponed, audit data may be inconsistent or mutable; default choice: append-only audit tables with tenant context and actor identity on every row.
- `Backup, restore, and purge strategy`: This matters because schools will expect operational recovery and tenant deletion handling; if postponed, support and compliance will be blocked; default choice: keep backups and restore procedures tenant-aware, with documented purge behavior for closed tenants.
- `Search index tenancy model`: This matters because search can leak data across schools; if postponed, a shared search index may expose the wrong tenant; default choice: scope every search document and query by tenant.
- `File storage tenancy model`: This matters because uploads, exports, and attachments are common leakage points; if postponed, file paths and permissions will be inconsistent; default choice: keep every object path tenant-scoped and access it only through server-side checks.
- `Migration strategy`: This matters because schema changes will be frequent once the MVP begins; if postponed, release safety will suffer; default choice: keep migrations small, reversible where possible, and aligned to module ownership.

## Business Rules

### Tier 0
- `Initial user journey priorities`: This matters because it tells the team what to build first and what to ignore; if postponed, implementation will drift into inconsistent assumptions; default choice: ship tenant onboarding, role-based access, staff invite/assignment, attendance, basic results, parent communication, and school admin basics first.
- `Communication rules`: This matters because school communication affects privacy and moderation; if postponed, messaging can become a compliance risk; default choice: separate notices from private messaging and keep all communication tenant-scoped.
- `Parent portal access rules`: This matters because parent views must be narrow and explicit; if postponed, parents may see too much or too little; default choice: show only approved information for linked learners and require explicit permission boundaries.
- `Finance workflows for MVP`: This matters because finance is high-risk and easily over-scoped; if postponed, the team may accidentally build a half-finished finance module; default choice: only include the minimum finance workflow that is truly required for the pilot.

### Tier 1
- `Academic calendar and term structure`: This matters because attendance, grading, and publishing all depend on it; if postponed, the data model will not align; default choice: use school terms and sections with a simple calendar model first.
- `Class and timetable subdomain boundaries`: This matters because academic operations can become a catch-all; if postponed, module ownership will blur; default choice: keep classes, terms, attendance, and timetable as clearly separated subdomains inside academic operations.
- `Analytics aggregation rules`: This matters because analytics can leak across tenants; if postponed, dashboards may expose too much data; default choice: tenant-only operational summaries in MVP, with only intentionally non-identifying aggregates outside a school tenant.
- `Approved integrations for MVP`: This matters because external systems expand risk and support scope; if postponed, integration work will sprawl; default choice: no non-essential integrations in the first release.

### Tier 3
- `Supported school types` beyond the first launch segment: This matters because different school types need different workflows; if postponed, the product can stay simpler; default choice: defer broad support until the first segment is stable.

## UI

### Tier 2
- `Client surface details` such as web-only versus additional surfaces: This matters because UI scope changes design, auth, and release work; if postponed, the team may build for the wrong channel; default choice: React web app first, with other client surfaces deferred.
- `Login, signup, and tenant-selection flow`: This matters because onboarding and auth are the first user touchpoints; if postponed, the first screens will be inconsistent; default choice: invite-based sign-in with explicit tenant context and a simple role-aware landing flow.
- `Tenant admin UI structure`: This matters because administrators need a predictable place to manage the school; if postponed, configuration will be scattered; default choice: one admin area with clear sections for users, school setup, and operational settings.
- `Role-based dashboard layouts`: This matters because different users need different starting points; if postponed, the UI will become generic and inefficient; default choice: separate dashboards or landing pages for admins, teachers, learners, parents, finance staff, and operators.
- `White-label visual rules`: This matters because branding must stay within approved boundaries; if postponed, theming may leak into behavior; default choice: brand tokens for logo, color, and limited theme styling only.
- `Custom domain behavior`: This matters because domains affect branding and support; if postponed, URLs will not be predictable; default choice: defer custom domains until the tenant model and auth are stable, then support verified subdomain and optional custom domain mapping.
- `Accessibility baseline`: This matters because schools serve diverse users; if postponed, UI quality will vary unpredictably; default choice: define an accessible baseline up front and test against it consistently.
- `Mobile responsiveness baseline`: This matters because many school users will access the product on phones or tablets even without native apps; if postponed, the UI may be desktop-only by accident; default choice: make the web app responsive by default and keep native mobile apps out of MVP.

### Tier 3
- `Mobile application strategy`: This matters because native apps are explicitly out of MVP but remain a future product question; if postponed, the core web app can ship without it; default choice: keep the first release web-only and revisit native apps only after adoption proves the need.

## Operations

### Tier 0
- `Release gates`: This matters because the docs treat security, tenant isolation, rollback, and support readiness as launch criteria; if postponed, the team can ship without guardrails; default choice: require tenant-isolation review, security review, rollback readiness, and product sign-off before release.
- `Rollback strategy`: This matters because production changes must be reversible; if postponed, operational risk rises; default choice: keep releases small and make rollbacks part of every deployment plan.
- `Support readiness definition`: This matters because the MVP must be operable without constant engineering intervention; if postponed, the support model will be vague; default choice: define standard support procedures, escalation paths, and tenant-safe admin tooling before pilot launch.
- `Observability standard`: This matters because support and incident response depend on logs, metrics, and traces; if postponed, production diagnosis will be slow; default choice: structured logs, tenant-aware metrics, and traces on critical paths.
- `Feature-flag operational policy`: This matters because feature flags are required for controlled rollout; if postponed, flags may become a release shortcut; default choice: flags must be auditable, tenant-safe, and incapable of bypassing security or tenancy rules.

### Tier 3
- `Source of truth for roadmap updates` and `source of truth for module ownership`: This matters because planning needs one authoritative owner; if postponed, roadmap and module decisions may diverge; default choice: make product own roadmap updates and architecture own module ownership, with explicit cross-review.
- `ADR numbering policy` and `whether rejected ADRs stay indexed permanently`: This matters because durable decisions need traceable history; if postponed, decision records can become inconsistent; default choice: keep ADRs immutable, number them sequentially, and retain rejected ADRs in the index for traceability.
- `Exception approval quorum`: This matters because constitutional exceptions need a clear sign-off rule; if postponed, exceptions will be handled inconsistently; default choice: require product, architecture, and security approval for any exception to the constitution.
- `Protected zone maintenance owner`: This matters because the highest-priority docs need a named caretaker; if postponed, nobody owns consistency; default choice: assign a repository maintainer or architecture lead as the maintenance owner.
- `Agent review workflow` and `required approval chain for high-risk edits`: This matters because AI contributors need explicit guardrails; if postponed, high-risk doc or code changes may skip the right reviewers; default choice: require a human review chain for anything touching tenancy, security, finance, exports, or protected files.

## Notes
- The biggest blocking decisions are the ones that define the tenant model, auth/session policy, MVP workflow list, architecture style, and database shape.
- The safest default overall is a web-first, modular monolith, TypeScript-heavy, tenant-scoped platform on shared Neon PostgreSQL with strict tenant isolation and narrow MVP scope.
