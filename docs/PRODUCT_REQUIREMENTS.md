# Product Requirements

## Purpose
Define the product-level requirements for `School OS` so that all contributors build toward the same user outcomes.

## Scope
- Covers business objectives, user needs, functional expectations, and non-functional expectations.
- Serves as the canonical source for product intent.
- Does not include implementation code, database schema, or deployment scripts.

## Ownership
- Primary owner: Product Manager
- Input owners: School SME, Operations Lead, Architecture Lead, Security Lead
- AI agent role: Maintain this document as a requirements reference, not a solution design.

## Update Rules
- Update only after requirement review and approval.
- Every requirement must be traceable to a user need, compliance need, or business goal.
- Unapproved ideas must remain in an explicitly labeled future section or `[TBD]`.
- Requirements that conflict with non-negotiables must be rejected, not weakened.
- Requirements should be testable and reviewable by both humans and AI tools.

## Product Goals
- Provide a unified cloud operating system for primary and secondary schools.
- Reduce manual work for school administrators and teachers.
- Improve learner and parent engagement.
- Give the SaaS operator confidence in tenant isolation, security, and operational control.
- Keep the product understandable enough that a new AI contributor can infer the intended behavior from the docs alone.

## Personas
- School Administrator
- Teacher
- Learner
- Parent or Guardian
- Finance Officer
- Platform Operator

## Use Cases
- An administrator configures a new tenant and assigns staff roles safely.
- A teacher records attendance and communicates with learners or parents within role boundaries.
- A learner accesses assigned learning activities without seeing other tenants.
- A platform operator reviews operational health without exposing tenant-sensitive data.

## Core Requirement Areas
### Identity and Access
- Users must have role-appropriate access.
- Authentication and session handling must be secure by default and session-based.
- Administrative actions must be traceable.
- Users are created by tenant administrators or platform operators only; self-service account creation is not part of MVP.
- The role matrix is fixed for MVP and includes School Administrator, Teacher, Learner, Parent or Guardian, Finance Officer, and Platform Operator.

#### Role Matrix
- School Administrator: configures the school, invites staff, and manages tenant-level operational settings.
- Teacher: records attendance, manages class-level learning activity, and prepares results within assigned scope.
- Learner: accesses assigned learning activities and views permitted personal information.
- Parent or Guardian: views approved child-related information and school communication.
- Finance Officer: manages tenant finance workflows and reports within approved scope.
- Platform Operator: manages tenant lifecycle and support operations without unrestricted cross-tenant data exposure.

### Academic Operations
- Schools must be able to manage academic workflows relevant to their grade structure, timetable, and calendar.
- Staff must be able to monitor learner progress and instructional activity.

### Attendance
- Staff must be able to record, review, and report attendance with tenant-safe controls.
- Attendance workflows must support operational follow-up and parent visibility where approved.
- Attendance status values are fixed for MVP: present, absent, late, and excused.
- Attendance follow-up is limited to approved parent or guardian visibility and school-defined escalation.

### Results
- Schools must be able to capture, manage, and publish learner results according to approved academic policy.
- Result access must respect role boundaries and publication rules.
- Results are term-based in MVP.
- Teachers prepare draft results, and an authorized school-level role publishes them after review.
- Published results are visible only according to role and learner relationship rules.

### Communication
- The platform must support clear communication between staff, learners, and parents.
- Communication features must respect privacy, role boundaries, and tenant isolation.

### Operations
- The platform must support operational visibility for attendance, schedules, records, and school administration tasks.

### Learning Experience
- Learners must have a simple, accessible experience for discovering and completing learning activities.

### Administration
- Tenant admins must be able to configure their school within approved platform boundaries.
- The platform operator must be able to manage tenants centrally without custom code per tenant.
- Tenant users are provisioned through admin-created invitations, not self-registration.

### Parent Portal
- Parents and guardians must be able to view approved school information relevant to their child or linked learners.
- Parent-facing access must be limited to explicit permissions and tenant context.

### Finance
- Schools must be able to manage approved finance workflows relevant to operations and reporting.
- Financial data must be protected with stronger access controls and auditability.

### Analytics
- The platform must provide analytics that help school leaders make operational decisions.
- Analytics must avoid cross-tenant leakage and must distinguish aggregate reporting from tenant-specific data.

## Examples
- Good requirement: "Admins can invite staff and assign roles within their tenant."
- Bad requirement: "Admins can do anything if they are trusted."
- Good requirement: "Tenant administrators can view only their tenant's operational dashboard."
- Bad requirement: "Operators can export all school records into one shared spreadsheet."

## Non-Functional Requirements
- Security: strong tenant isolation, auditable actions, protected data handling.
- Reliability: predictable behavior under normal and peak use.
- Performance: acceptable response times for core user journeys.
- Accessibility: usable by diverse school communities.
- Maintainability: modular design and clear ownership.
- Observability: logs, metrics, and traces sufficient for support and incident response.
- Flexibility: feature flags and white-label support must not compromise the core control model.

## Acceptance Criteria Pattern
- Each user-facing requirement should have a clear success condition.
- Each security-related requirement should have a verification method.
- Each tenant-sensitive requirement should state how isolation is preserved.

## Decision Record
- Decision: Requirements are organized around personas, core domains, and non-functional expectations.
- Status: Approved
- Reason: The platform needs a stable product language that downstream design and implementation can reference.
- Alternatives considered: Feature-list-only requirements and purely technical requirements.
- Date: `[TBD]`

## AI Contribution Rules
- AI tools may draft requirement wording, but they may not invent requirements without an approved source.
- AI tools must preserve traceability from requirement to user need or business goal.
- AI tools must flag ambiguous language that could cause implementation drift.
- AI tools must not downgrade security or tenant requirements to improve readability.

## Review Requirements
- Product, architecture, and security reviewers must validate all new or changed requirements.
- Reviewers should confirm that each requirement is testable and non-contradictory.
- High-risk requirements need explicit tenant isolation and security review.

## Change Management Requirements
- Add or modify requirements through a controlled review process.
- Keep a change note when a requirement is clarified, split, or retired.
- Preserve historical intent when changing a requirement that downstream teams may already be using.

## Success Metrics
- Adoption rate: `[TBD]`
- Weekly active users: `[TBD]`
- Task completion rate for core workflows: `[TBD]`
- Support ticket volume per tenant: `[TBD]`
- Security incidents: `0 tolerance for confirmed tenant leakage`

## Out of Scope
- Custom tenant forks.
- Unapproved third-party integrations.
- Features that cannot be audited or isolated properly.
- Unlimited white-label customization outside approved brand controls.

## Open Decisions
- Initial user journey priorities: `[TBD]`
- Compliance targets: `[TBD]`
- Supported school types: `[TBD]`
