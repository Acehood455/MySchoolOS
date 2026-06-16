# Implementation Plan

## Purpose
Record the finalized implementation sequence so product, engineering, architecture, and security stay aligned on what gets built first.

## Plan
### Phase 1: Foundation
- Establish the single Neon PostgreSQL database.
- Implement session authentication and admin-created user provisioning.
- Enforce `school_id` isolation on all tenant-scoped paths.
- Stand up the role matrix and authorization baseline.

### Phase 2: Core School Workflows
- Build tenant onboarding and school setup.
- Implement attendance workflows with the finalized attendance states.
- Implement results workflows with the finalized publication rules.
- Add the MVP communication and parent visibility flows.

### Phase 3: Operational Readiness
- Add tenant-safe operational dashboards and support tooling.
- Add audit coverage, observability, and rollback readiness.
- Add minimal white-label branding controls.

## Notes
- This plan is intentionally narrow and pilot-driven.
- This plan is approved and recorded in ADR-010.
- Any future scope expansion must be reviewed against the governing docs.
