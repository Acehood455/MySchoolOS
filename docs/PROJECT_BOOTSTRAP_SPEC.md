# Project Bootstrap Spec

## Purpose
Define the initial repository structure for MySchoolOS so implementation starts with clear boundaries, consistent naming, and tenant-safe architecture.

This document is intentionally specific. It defines the expected top-level layout, the first application boundaries, the shared libraries, the middleware layers, and the conventions that should be used from day one.

## Bootstrap Goals
- Support the approved multi-tenant, school-based architecture.
- Keep the web app, API, worker, and database concerns separated but coordinated.
- Make tenant resolution, authentication, authorization, and audit logging explicit.
- Create a structure that can grow into LMS, mobile, and media-heavy features without reorganizing the whole repo.
- Keep the codebase understandable for both humans and AI contributors.

## Core Repository Shape
The initial repository should follow a single monorepo structure with explicit application and shared package boundaries.

### Root-Level Structure
```text
/
├─ apps/
├─ packages/
├─ prisma/
├─ docs/
├─ scripts/
├─ test/
├─ .env.example
├─ .gitignore
├─ package.json
├─ tsconfig.base.json
├─ eslint.config.*
├─ prettier.config.*
├─ vitest.workspace.*
└─ README.md
```

### Expected Top-Level Responsibilities
- `apps/` contains deployable application surfaces.
- `packages/` contains shared libraries and domain-agnostic infrastructure.
- `prisma/` contains schema, migrations, seed data, and database utilities.
- `docs/` contains architecture, governance, and implementation specifications.
- `scripts/` contains one-off operational or maintenance scripts.
- `test/` contains cross-app test fixtures, helpers, and shared test utilities.

## Folder Structure

### `apps/web`
Web frontend for school staff, admins, parents, and future learners.

```text
apps/web/
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ routes/
│  ├─ components/
│  ├─ features/
│  ├─ lib/
│  ├─ styles/
│  └─ tests/
├─ public/
└─ package.json
```

#### Web App Responsibilities
- Render tenant-aware UI.
- Resolve the active tenant from host and session context.
- Enforce route-level access boundaries only as a first layer, never as the sole security layer.
- Consume API contracts from shared packages.
- Keep presentation and workflow logic separate.

### `apps/api`
Backend API for all trusted business logic.

```text
apps/api/
├─ src/
│  ├─ main.ts
│  ├─ app.ts
│  ├─ config/
│  ├─ common/
│  ├─ auth/
│  ├─ tenant/
│  ├─ audit/
│  ├─ users/
│  ├─ schools/
│  ├─ roles/
│  ├─ sessions/
│  ├─ health/
│  └─ infrastructure/
├─ tests/
└─ package.json
```

#### API Responsibilities
- Enforce tenant isolation, authentication, authorization, and audit logging.
- Provide REST/OpenAPI endpoints for the web app and future mobile clients.
- Own all privileged mutations and tenant-sensitive reads.
- Mediate access to background jobs, file storage, email, and external integrations.

### `apps/worker`
Background processing runtime for asynchronous platform work.

```text
apps/worker/
├─ src/
│  ├─ main.ts
│  ├─ worker.ts
│  ├─ queues/
│  ├─ jobs/
│  ├─ processors/
│  ├─ schedulers/
│  └─ infrastructure/
├─ tests/
└─ package.json
```

#### Worker Responsibilities
- Process invitations, notifications, report generation, and scheduled tasks.
- Preserve tenant context in every job.
- Avoid direct domain mutation without API-aligned service boundaries.

### `packages/shared`
Shared contracts and cross-app utilities.

```text
packages/shared/
├─ src/
│  ├─ types/
│  ├─ schemas/
│  ├─ constants/
│  ├─ errors/
│  ├─ auth/
│  ├─ tenant/
│  └─ index.ts
└─ package.json
```

#### Shared Package Responsibilities
- Define reusable request/response types.
- Hold validation schemas and error shapes.
- Export canonical enums, constants, and utility functions.
- Keep cross-app contracts stable and versionable.

### `packages/ui`
Shared UI primitives and design-system components.

```text
packages/ui/
├─ src/
│  ├─ components/
│  ├─ tokens/
│  ├─ icons/
│  ├─ layouts/
│  └─ index.ts
└─ package.json
```

#### UI Package Responsibilities
- Provide shared visual building blocks.
- Centralize theme tokens for white-label support.
- Prevent duplicate component logic across apps.

### `packages/config`
Shared lint, format, type, and runtime configuration.

```text
packages/config/
├─ eslint/
├─ tsconfig/
├─ vitest/
├─ prettier/
└─ package.json
```

#### Config Package Responsibilities
- Keep tooling consistent across apps.
- Reduce duplicated configuration drift.

### `packages/db`
Database client, query helpers, and tenant-safe data access utilities.

```text
packages/db/
├─ src/
│  ├─ client.ts
│  ├─ tenant.ts
│  ├─ transactions.ts
│  ├─ repositories/
│  └─ index.ts
└─ package.json
```

#### DB Package Responsibilities
- Provide a single entry point for database access.
- Make tenant-bound query helpers easy to use and hard to bypass.
- Centralize transaction helpers and connection configuration.

### `packages/observability`
Logging, tracing, metrics, and telemetry helpers.

```text
packages/observability/
├─ src/
│  ├─ logger.ts
│  ├─ metrics.ts
│  └─ index.ts
└─ package.json
```

#### Observability Package Responsibilities
- Standardize structured logging.
- Provide tenant-safe telemetry helpers.
- Keep monitoring integration consistent.

## App Architecture

### Web App Architecture
- Use Vite with React Router and a route-based app structure.
- Treat page and route files as orchestration layers, not business logic containers.
- Keep UI state local unless it belongs to a reusable domain workflow.
- Read tenant context early and pass it through to API calls and route guards.

### Web App Internal Layout
Recommended internal grouping inside `apps/web/src/routes`:

```text
routes/
├─ public/
├─ auth/
├─ tenant/
├─ admin/
└─ root.tsx
```

- `public` is for marketing and unauthenticated surfaces.
- `auth` is for login, password reset, and session bootstrap.
- `tenant` is for school-scoped application screens.
- `admin` is for platform administration and guarded support flows.

### API Architecture
- Use a modular Fastify application with one backend process.
- Each domain area owns its routes, services, schemas, and internal policies.
- Shared platform concerns live in dedicated cross-cutting modules, not in feature modules.
- Expose REST endpoints with OpenAPI so future mobile apps can share the same contract.

### API Module Boundaries
The initial API should at minimum include:
- `auth`
- `tenant`
- `audit`
- `users`
- `schools`
- `roles`
- `sessions`
- `health`
- `infrastructure`

### Worker Architecture
- Keep the worker separate from the API process.
- Use a queue consumer model, not in-request background execution.
- Load tenant context from the job payload or a trusted lookup before touching tenant data.

## Database Architecture

### Canonical Model
- Use one shared Neon PostgreSQL database.
- Keep tenant-owned tables in shared schemas with explicit `school_id`.
- Never depend on UI filtering for tenant safety.
- Treat the database as a guarded boundary, not a passive bucket.

### Initial Database Layout
The initial database folder should be organized for schema governance and future migration discipline.

```text
prisma/
├─ schema.prisma
├─ migrations/
├─ seed/
├─ views/
└─ sql/
```

### Database Responsibilities
- `schema.prisma` defines the canonical ORM model.
- `migrations/` stores reversible schema change history.
- `seed/` contains initial development and test data.
- `views/` contains approved database view definitions if any are needed.
- `sql/` contains raw SQL only when Prisma is not sufficient or a review explicitly approves it.

### Data Access Rules
- Every tenant-owned query must include tenant scoping.
- Any repository method that reads or writes tenant-owned data must accept tenant context explicitly.
- Cross-tenant operations require explicit platform authorization.

## Shared Libraries

### Shared Contract Package
Use one shared package for:
- API request and response schemas
- Validation rules
- Common enums
- Cross-app error types
- Auth and tenant context types

### Shared UI Package
Use one shared package for:
- Buttons, fields, layout primitives, tokens, icons, and common presentation patterns
- White-label-safe theme support

### Shared Database Package
Use one shared package for:
- Database client setup
- Transaction helpers
- Tenant-aware repository helpers
- Common query utilities

### Shared Observability Package
Use one shared package for:
- Structured logger creation
- Correlation IDs
- Safe event enrichment

## Middleware

### Middleware Placement
Middleware should be split by concern and placed where it is most effective:
- Web route guards and loaders handle redirects and host-based context bootstrapping.
- API middleware handles trust boundaries, auth, authz, audit, and tenant validation.
- Worker middleware handles job context restoration and safe tenant binding.

### Required Middleware Layers
- Tenant resolution middleware
- Authentication middleware
- Authorization middleware
- Audit middleware
- Request correlation middleware
- Error normalization middleware

### Middleware Responsibilities
- Tenant resolution must resolve the school from host information before tenant access.
- Authentication must validate the session and attach the actor context.
- Authorization must reject unauthorized access before business logic runs.
- Audit middleware must capture security-relevant outcomes even when operations fail.
- Correlation middleware must attach a request or job ID to logs and traces.
- Error normalization middleware must convert internal failures into predictable API responses.

## Auth Structure

### Auth Folder Shape
Auth should live in clearly separated layers:

```text
apps/api/src/auth/
├─ auth.routes.ts
├─ auth.service.ts
├─ auth.schemas.ts
├─ session.service.ts
├─ password.service.ts
├─ dto/
└─ policies/
```

### Auth Responsibilities
- Login, logout, password reset, and session revocation.
- Secure cookie creation and validation.
- Binding the user session to tenant context.
- Exposing actor context to audit and authorization layers.

### Auth Rules
- No public signup in the MVP.
- No role should be assumed from the client.
- Sessions must be server-managed and revocable.
- Password and session events must be auditable.

## Tenant Resolution Structure

### Tenant Folder Shape
Tenant resolution should be isolated from business modules:

```text
apps/api/src/tenant/
├─ tenant.routes.ts
├─ tenant-resolution.service.ts
├─ tenant-context.service.ts
├─ host-resolution.service.ts
├─ dto/
└─ policies/
```

### Tenant Resolution Responsibilities
- Resolve host to verified school domain.
- Fall back to approved subdomain mapping when appropriate.
- Bind the resolved tenant into request context.
- Reject ambiguous, missing, or conflicting mappings.

### Tenant Resolution Rules
- Custom domain lookup happens before subdomain fallback.
- Resolution must fail closed.
- Tenant context must be explicit in every tenant-scoped request.
- A session must never silently override the resolved host context.

## Audit Structure

### Audit Folder Shape
Audit functionality should live in a dedicated module:

```text
apps/api/src/audit/
├─ audit.routes.ts
├─ audit.service.ts
├─ audit.middleware.ts
├─ event-catalog.ts
├─ dto/
└─ policies/
```

### Audit Responsibilities
- Record security-sensitive and operationally important actions.
- Enforce append-only audit behavior.
- Include actor, tenant, resource, event, outcome, and timestamp.
- Support incident review and support workflows.

### Audit Rules
- Audit events should be emitted from the server, not the client.
- Failed privileged attempts must still be auditable.
- Audit payloads must avoid accidental leakage of sensitive business content.

## Environment Variables

### Root Environment Files
- `.env.example` documents all required variables.
- `.env.local` is for local development only.
- Production secrets must not be committed.

### Environment Variable Groups

#### Application
- `NODE_ENV`
- `APP_URL`
- `APP_NAME`
- `DEFAULT_TIMEZONE`

#### Database
- `DATABASE_URL`
- `DIRECT_URL`
- `SHADOW_DATABASE_URL` if required for migrations

#### Auth
- `SESSION_SECRET`
- `COOKIE_NAME`
- `COOKIE_DOMAIN`
- `COOKIE_SECURE`
- `PASSWORD_PEPPER` if used

#### Tenant Resolution
- `PRIMARY_DOMAIN`
- `TENANT_SUBDOMAIN_SUFFIX`
- `CUSTOM_DOMAIN_VERIFICATION_MODE`

#### Email
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_REPLY_TO`

#### File Storage
- `STORAGE_PROVIDER`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

#### Jobs
- `QUEUE_PROVIDER`
- `WORKER_CONCURRENCY`
- `JOB_RETRY_LIMIT`

#### Observability
- `SENTRY_DSN`

#### Feature Flags
- `FEATURE_FLAG_PROVIDER`
- `FEATURE_FLAG_ENVIRONMENT`

### Environment Rules
- Every required variable must appear in `.env.example`.
- Tenant-sensitive defaults must be explicit rather than inferred.
- Secrets must be loaded from the environment, never hard-coded.
- Variables that affect cookie security, host resolution, or tenant scope must be reviewed like code.

## Naming Conventions

### General Naming
- Use lowercase kebab-case for folders.
- Use PascalCase for classes, DTOs, modules, services, and database models.
- Use camelCase for variables, functions, and object properties.
- Use UPPER_SNAKE_CASE for environment variables and constants where appropriate.

### File Naming
- Use descriptive filenames that match the exported primary symbol when practical.
- Prefer `*.routes.ts`, `*.service.ts`, `*.middleware.ts`, and `*.schemas.ts` in the API.
- Prefer `main.tsx`, `App.tsx`, and route files in the web app where the framework expects them.

### Domain Naming
- Name folders by business capability, not technical mechanism.
- Use singular names for domain modules and entities.
- Keep platform concerns separate from tenant concerns.

### Database Naming
- Use singular PascalCase for Prisma models.
- Use descriptive enum names.
- Use index names that reveal the tenant, status, or access path they support.

## Import Conventions

### Import Order
- External libraries first.
- Monorepo packages second.
- Absolute project aliases third.
- Relative imports last.

### Import Rules
- Prefer absolute aliases for cross-package imports.
- Keep relative imports local to the current feature folder.
- Do not import from another feature’s internals unless that boundary is explicitly shared.
- Import shared validation and type contracts from `packages/shared`, not from application internals.

### Boundary Rules
- Web code should not import API-only services.
- API code should not import web route components.
- Worker code should not depend on web presentation code.
- Shared packages must not import from apps.

## Testing Conventions

### Test Layers
- Unit tests for pure logic and isolated services.
- Integration tests for repositories, tenant-scoped access, and middleware behavior.
- End-to-end tests for auth, tenant resolution, role access, and critical workflows.

### Test Folder Shape
```text
tests/
├─ unit/
├─ integration/
├─ e2e/
├─ fixtures/
└─ helpers/
```

### Testing Rules
- Test tenant isolation explicitly.
- Test both success and failure paths for auth and authorization.
- Test domain resolution, role assignment, audit emission, and session revocation.
- Use fixtures that make tenant boundaries obvious.
- Keep time-sensitive tests deterministic.

### Testing Conventions
- Unit tests should stay close to the code they cover.
- Integration tests should verify real database behavior.
- E2E tests should focus on high-risk user journeys, not every small UI detail.
- Tenant leakage checks should be part of the permanent test suite.

## Error Handling Conventions

### Error Principles
- Fail closed.
- Preserve enough detail for debugging without exposing sensitive internals.
- Use a consistent error shape across the API.
- Treat tenant, auth, and audit failures as first-class outcomes, not generic exceptions.

### Error Categories
- Validation errors
- Authentication errors
- Authorization errors
- Tenant resolution errors
- Conflict errors
- Not found errors
- Rate limit or abuse protection errors
- Internal server errors

### Error Shape Expectations
- Every API error should include a stable code.
- Human-readable messages should be safe for end users.
- Internal details should be logged, not returned.
- Correlation IDs should be included where possible.

### Error Handling Rules
- Do not leak stack traces in production responses.
- Translate infrastructure errors into domain-appropriate errors at the boundary.
- Log failures with tenant and request context when available.
- Make audit and error handling compatible so denied or failed security actions can still be traced.

## Initial Bootstrap Priorities
The first implementation pass should establish the following, in order:
1. Monorepo root tooling and shared configuration.
2. Database schema and Prisma governance files.
3. Shared contract and utility packages.
4. API shell with auth, tenant, audit, and health surfaces.
5. Web shell with routing, layout, and tenant-aware session bootstrap.
6. Worker shell with queue and processor placeholders.
7. Environment examples, test harnesses, and observability plumbing.

## Non-Goals
This bootstrap spec does not define:
- Concrete business features beyond the foundation boundary
- UI design details
- Final Prisma model definitions
- Production infrastructure code
- Mobile app repository structure

## Governance Notes
- This structure is the recommended starting point, not a substitute for architecture review.
- Any future deviation that changes tenant boundaries, auth model, or deployment shape should be recorded in the ADR process.
- If implementation begins before these folders exist, the repository will drift into inconsistent ownership and duplicated logic.
