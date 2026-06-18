# Bootstrap Generation Prompt

## Purpose
This prompt is the exact instruction set to use when generating the first version of the MySchoolOS repository.

It is designed to keep the generated repository aligned with the approved governance docs, schema rules, tenant isolation rules, and security requirements.

## Prompt
```text
You are generating the first version of the MySchoolOS repository.

Your job is to create only the approved bootstrap structure for a multi-tenant school SaaS platform.

Before you do anything else, read and follow all of the following documents:
- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PROJECT_BOOTSTRAP_SPEC.md`
- `docs/TECH_STACK_FINAL.md`
- `docs/FOUNDATION_IMPLEMENTATION_SPEC.md`
- `docs/FOUNDATION_DATABASE_SPEC.md`
- `docs/SCHEMA_GENERATION_SPEC.md`
- `docs/MULTI_TENANCY.md`
- `docs/SECURITY_REQUIREMENTS.md`
- `docs/ROLE_MATRIX.md`
- `docs/ADRS.md`
- `docs/MVP_BUILD_ORDER.md`

Treat these documents as governing constraints. If there is any conflict, the governance docs win.

## Objective
Create the first repository version with only the following approved areas:
- Frontend shell
- Backend shell
- Prisma setup
- Environment configuration
- Authentication foundation
- Tenant resolution foundation
- Authorization foundation
- Audit foundation

## Required Repository Shape
Create a clean monorepo structure that matches the bootstrap spec and stack decision.

The repository should include:
- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/shared`
- `packages/ui`
- `packages/config`
- `packages/db`
- `packages/observability`
- `prisma`
- `docs`
- `scripts`
- `test`
- root configuration files for TypeScript, linting, formatting, tests, and environment examples

## Allowed Scope
You may create only the shell, scaffolding, configuration, and foundation-level wiring needed for the approved bootstrap.

You may include:
- application shell folders
- placeholder modules
- placeholder routes
- placeholder services
- placeholder middleware structure
- Prisma schema scaffold
- shared package scaffolds
- environment examples
- test scaffolds
- documentation stubs that support the bootstrap

## Disallowed Scope
Do not add product features or domain modules beyond the foundation boundary.

Do not include:
- Students
- Teachers
- Parents
- Attendance
- Assessments
- Results
- Report Cards

Also do not add:
- LMS features
- messaging
- announcements
- finance features
- payments
- analytics features beyond bootstrap-level tooling
- mobile app code
- custom domain implementation beyond foundation wiring
- video class implementation

## Architecture Rules
Follow these rules exactly:
- Use a web-first monorepo.
- Keep the backend as a separate API surface from the frontend shell.
- Keep the worker separate from the API process.
- Keep shared contracts in shared packages instead of duplicating types.
- Keep tenant resolution, authentication, authorization, and audit concerns separate from business modules.
- Keep all tenant-scoped data paths explicitly school-aware.
- Never use UI filtering as a substitute for tenant isolation.
- Never create cross-tenant shortcuts.
- Never introduce free-form tenant roles.
- Never introduce public signup.
- Never introduce academic entities before the foundation is complete.

## Security Rules
Apply the following security requirements from the start:
- Enforce server-managed session auth with secure HttpOnly cookies.
- Treat tenant resolution as a server-side trust boundary.
- Treat authorization as server-side only.
- Treat audit logging as append-only and tamper-resistant.
- Ensure every tenant-owned record and tenant-scoped path is school-aware.
- Fail closed on tenant resolution or authorization ambiguity.
- Keep secrets out of source control.

## Schema Rules
When creating Prisma scaffolding:
- Use the approved foundation entity set only.
- Do not create student, teacher, parent, attendance, assessment, results, or report card models.
- Keep all tenant-owned entities explicitly scoped with `school_id`.
- Keep global entities clearly separated from school-owned records.
- Preserve the canonical naming and lifecycle rules from the schema governance docs.
- Do not invent schema shortcuts that weaken tenant isolation.

## What To Build
Create the minimal foundation scaffolding needed to support future implementation of:
- frontend shell
- backend shell
- Prisma foundation
- auth foundation
- tenant resolution foundation
- authorization foundation
- audit foundation

This means you should create:
- app and package folder structure
- root workspace and tooling configuration
- API module placeholders
- web app route and layout placeholders
- shared types and utilities placeholders
- Prisma schema and migration scaffolding
- environment variable example files
- test harness scaffolding
- observability scaffolding

## What Not To Build
Do not implement business workflows.
Do not seed product data.
Do not create user-facing academic screens.
Do not build tenant onboarding flows beyond the minimal foundation wiring.
Do not implement attendance, assessments, results, or report card logic.
Do not build any feature that depends on later MVP phases.

## Quality Bar
The generated repository should be:
- structurally clean
- easy for AI tools to extend
- maintainable by a solo founder
- consistent with the approved docs
- ready for foundation-phase development

Prefer explicit structure over cleverness.
Prefer clear boundaries over convenience.
Prefer conservative scaffolding over speculative implementation.

## Output Rules
- Output only the repository content and necessary file structure.
- Do not include explanatory prose.
- Do not include markdown outside the repository artifacts if the target interface expects files.
- Do not generate feature code beyond the bootstrap foundation.
- If a decision is ambiguous, stop and preserve the safest governance-aligned default.
```

## Notes
- This prompt should be used as the starting instruction for repository generation.
- If the governance docs change, update this prompt in the same change window.
