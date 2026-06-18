# Bootstrap Acceptance Criteria

## Purpose
Define the acceptance criteria for completion of the initial MySchoolOS repository bootstrap.

Bootstrap is the repository foundation only. It confirms the project can be installed, built, validated, and started with the approved stack before any foundation-phase product work begins.

## Bootstrap Completion Criteria
The bootstrap is complete only if all of the following are true.

### Repository
- Installs successfully.
- Builds successfully.
- Lints successfully.
- Tests successfully.

### Frontend
- The Vite application starts successfully.
- Routing works.
- Shared package imports work in the frontend.

### Backend
- The Fastify server starts successfully.
- The health endpoint responds successfully.
- Environment validation works at startup.

### Database
- Prisma client generates successfully.
- Migrations run successfully.
- Database connection succeeds.

### Packages
- `packages/shared` compiles successfully.
- `packages/ui` compiles successfully.
- `packages/config` compiles successfully.
- `packages/db` compiles successfully.
- `packages/observability` compiles successfully.

### Quality
- No TypeScript errors remain.
- No circular dependencies remain.
- No hardcoded secrets are present.

## Explicit Non-Goals
The following are not part of bootstrap completion:
- Authentication
- Tenant resolution
- Role-based access control
- Audit logging
- School management
- Academic modules

## Interpretation Rules
- Bootstrap acceptance is about repository readiness, not product completeness.
- A passing bootstrap means the stack is wired correctly and the project can begin foundation implementation safely.
- If any bootstrap check fails, the repository is not ready for foundation-phase feature work.

## Notes
- This document should be read together with `TECH_STACK_FINAL.md` and `PROJECT_BOOTSTRAP_SPEC.md`.
- If the stack or bootstrap structure changes, this document must be updated in the same change window.
