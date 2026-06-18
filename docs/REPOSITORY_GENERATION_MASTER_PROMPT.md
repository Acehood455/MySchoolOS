# Repository Generation Master Prompt

## Purpose
This is the master prompt for generating the first version of the MySchoolOS repository.

It must be used as the highest-level instruction for repository creation, and it must be followed together with the governing documentation.

## Prompt
```text
You are generating the first version of the MySchoolOS repository.

Before writing any code or creating any files, read and follow these documents in full:
- `AI_START_HERE.md`
- `docs/TECH_STACK_FINAL.md`
- `docs/PROJECT_BOOTSTRAP_SPEC.md`
- `docs/FOUNDATION_IMPLEMENTATION_SPEC.md`
- `docs/FOUNDATION_DATABASE_SPEC.md`
- `docs/SCHEMA_GENERATION_SPEC.md`
- `docs/FOUNDATION_SCHEMA_REVIEW.md`
- `docs/SECURITY_REQUIREMENTS.md`
- `docs/MULTI_TENANCY.md`
- `docs/ROLE_MATRIX.md`

If any instruction in this prompt conflicts with the governing docs, the governing docs win.

## Objective
Create only the foundation-ready repository shell for MySchoolOS.

The generated repository must include only:
- Frontend foundation
- Backend foundation
- Prisma foundation
- Neon PostgreSQL foundation
- Authentication foundation
- Session management foundation
- Tenant resolution foundation
- Role-based authorization foundation
- Audit foundation
- Environment configuration
- Error handling foundation
- Logging foundation

## Required Technology Stack
Use only the approved final stack:

### Frontend
- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind
- shadcn/ui

### Backend
- Fastify
- TypeScript

### Database
- Prisma
- Neon PostgreSQL

## Required Repository Shape
Create a clean monorepo structure consistent with the bootstrap spec.

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
- root configuration files for workspace, TypeScript, linting, formatting, testing, and environment examples

## Foundation Modules Only
Create only the foundation modules and scaffolding required for the approved phase:
- Authentication foundation
- Session management
- Tenant resolution
- Role-based authorization
- Audit foundation
- Environment configuration
- Error handling
- Logging foundation

## Disallowed Scope
Do not add any product features or domain modules beyond the foundation boundary.

Do not include:
- Students
- Teachers
- Parents
- Attendance
- Assessments
- Results
- Report Cards
- LMS functionality

Also do not add:
- announcements
- messaging
- finance
- payments
- analytics beyond foundation-level tooling
- mobile app code
- custom domain implementation beyond foundation wiring
- video class implementation
- any academic workflow beyond the approved foundation

## Required Process
You must follow this sequence:
1. Explain the intended design before generating code.
2. Explain the file-by-file plan before making changes.
3. Perform and explain a security review before implementing anything.
4. Perform and explain a tenant-isolation review before implementing anything.
5. Perform and explain a schema review before implementing anything that touches Prisma or database structure.
6. Describe the build verification steps you will use after implementation.
7. Only then generate the repository content.

## Design Rules
Follow these design rules exactly:
- Use an API-first architecture.
- Keep the frontend, backend, and worker clearly separated.
- Keep all tenant-scoped paths explicitly school-aware.
- Keep shared contracts in shared packages instead of duplicating types.
- Keep tenant resolution, authentication, authorization, and audit concerns separate from business modules.
- Never use UI filtering as a substitute for tenant isolation.
- Never create cross-tenant shortcuts.
- Never introduce free-form tenant roles.
- Never introduce public signup.
- Never introduce academic entities before the foundation is complete.
- Never assume SSR or framework-specific server features that are not part of the approved stack.

## Security Rules
Apply the following security baseline from the start:
- Enforce server-managed session auth with secure HttpOnly cookies.
- Treat tenant resolution as a server-side trust boundary.
- Treat authorization as server-side only.
- Treat audit logging as append-only and tamper-resistant.
- Ensure every tenant-owned record and tenant-scoped path is school-aware.
- Fail closed on tenant resolution or authorization ambiguity.
- Keep secrets out of source control.
- Make privilege changes, session changes, and tenant-mapping changes auditable.

## Schema Rules
When creating Prisma scaffolding:
- Use the approved foundation entity set only.
- Do not create student, teacher, parent, attendance, assessment, results, or report card models.
- Keep all tenant-owned entities explicitly scoped with `school_id`.
- Keep global entities clearly separated from school-owned records.
- Preserve the canonical naming, lifecycle, and ownership rules from the schema governance docs.
- Do not invent schema shortcuts that weaken tenant isolation.
- If schema design is unclear, stop and explain the ambiguity rather than guessing.

## File-by-File Requirements
For every file you create or modify, explain:
- Why the file exists
- What role it plays in the foundation
- How it supports tenant safety or maintainability
- Whether it is temporary scaffold or canonical structure

## Output Requirements
When generating the repository:
- Provide the design explanation first.
- Provide the file-by-file change explanation next.
- Provide the security review next.
- Provide the tenant-isolation review next.
- Provide the schema review next.
- Provide the build verification steps next.
- Then generate the repository content.

Do not hide risks.
Do not skip a review step.
Do not generate foundation code before the explanation and reviews are complete.
Do not generate any code beyond the approved foundation scope.

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

## Final Guardrail
If any requested change would introduce students, teachers, parents, attendance, assessments, results, report cards, or LMS functionality, stop and do not generate it.
```

## Notes
- This prompt is the master repository-generation instruction for MySchoolOS.
- If the stack or foundation governance changes, update this prompt in the same change window.
