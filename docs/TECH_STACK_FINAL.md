# Tech Stack Final

## Purpose
Define the final approved implementation stack for MySchoolOS.

This stack is selected to prioritize:
- AI-assisted development
- Lovable compatibility
- Solo-founder maintainability
- Multi-tenant SaaS requirements
- Long-term scalability

The stack below is intentionally conservative. It favors the smallest set of mainstream tools that can support the approved architecture without creating hidden coupling or operational overhead.

## Decision Summary
- Frontend: React, TypeScript, Vite, React Router, TanStack Query, Tailwind, shadcn/ui, React Hook Form, Zod
- Backend: Node.js, TypeScript, Fastify
- Database: Neon PostgreSQL
- ORM: Prisma
- Authentication: Custom session auth with secure HttpOnly cookies
- Storage: Cloudflare R2
- Email: Resend
- PDF Generation: HTML to PDF with Playwright
- Background Jobs: Postgres-backed queue with a dedicated worker
- Hosting: Vercel for frontend, Railway/Fly.io/Coolify for backend and worker
- Monitoring: Sentry
- Testing: Vitest, Testing Library, Playwright, and database integration tests

## Frontend

### Selected Choice
React with TypeScript, Vite, React Router, TanStack Query, Tailwind, shadcn/ui, React Hook Form, and Zod.

### Why It Was Selected
- It is the strongest fit for Lovable compatibility because it maps directly to common AI-generated frontend patterns.
- It is faster to bootstrap than a heavier SSR-first framework and easier for a solo founder to maintain.
- It keeps UI concerns clear and portable while still supporting tenant-aware, white-label SaaS behavior.
- It pairs well with an API-first backend, which is important for future mobile apps and multi-agent development.
- It is simple enough to keep the frontend from becoming a second backend.

### Why Alternatives Were Rejected
- Next.js: too much framework surface area for this project’s Lovable-first requirement.
- Remix: capable, but less aligned with the chosen component, router, and generation workflow.
- Plain React without the selected support stack: too much manual assembly for forms, validation, data fetching, and styling.

### Expected Scaling Limits
- A pure SPA can become awkward if the product later needs heavy server-side rendering or host-aware pre-rendering.
- Very large frontend codebases still require strong module boundaries and consistent query and form patterns.
- Custom-domain-specific rendering is less native than in SSR-first frameworks, so some tenant-aware bootstrapping must stay in the app shell.

### Upgrade Path
- Keep business logic in shared packages and backend services.
- If the UI grows more complex, introduce stricter feature boundaries and shared design-system primitives.
- If SSR becomes necessary later, revisit the frontend architecture through a controlled ADR rather than starting there now.

## Backend

### Selected Choice
Node.js, TypeScript, Fastify with REST/OpenAPI.

### Why It Was Selected
- Fastify is lightweight, fast, and easier to bootstrap than a heavier backend framework.
- Node.js and TypeScript keep the full stack in one language and simplify AI-assisted development.
- REST/OpenAPI is the most future-proof choice for mobile apps, integrations, and generated clients.
- The API boundary stays clean and explicit, which is important for tenant isolation, auth, and audit logging.

### Why Alternatives Were Rejected
- Next.js route handlers only: too easy to collapse the UI and backend into one blurred boundary.
- Express: flexible, but less structured and less helpful for AI-assisted consistency.
- NestJS: strong, but heavier than the chosen Fastify route for a solo-founder bootstrap.
- tRPC: productive, but less ideal for long-term mobile and third-party client support because the API contract is not as universally portable.

### Expected Scaling Limits
- A modular monolith will carry the MVP and likely early growth comfortably.
- If the backend grows too broad, module boundaries can become strained without disciplined ownership.
- A single API process may eventually need separate scaling from the web app and worker.

### Upgrade Path
- Keep the backend modular and contract-driven from the beginning.
- If traffic or complexity rises, scale the API and worker independently.
- If external integrations become heavy, the REST/OpenAPI contract can be exposed without major architectural changes.

## Database

### Selected Choice
Neon PostgreSQL.

### Why It Was Selected
- It matches the approved single-database, shared-table, `school_id`-scoped architecture.
- PostgreSQL is the safest choice for a relational school platform with users, sessions, roles, and audit records.
- Neon is operationally lightweight and suits a small team that needs managed infrastructure.
- The database model supports future LMS, reporting, and analytics needs without changing the core tenant boundary.

### Why Alternatives Were Rejected
- Separate database per tenant: too much operational overhead for the MVP and unnecessary given the approved tenancy model.
- Schema-per-tenant: adds complexity without enough benefit for this project.
- Non-relational databases: poor fit for the strong relational and audit requirements of school operations.

### Expected Scaling Limits
- Shared-table tenancy requires strict discipline in every query path.
- Very large tenants or heavy reporting workloads may eventually pressure a single shared database design.
- Cross-tenant analytics must remain intentionally controlled.

### Upgrade Path
- Add indexing, partitioning, and query optimization as tenant volume grows.
- Use read replicas or dedicated reporting paths if operational summaries become heavy.
- If a future product line requires fundamentally different isolation, revisit tenancy topology through the ADR process rather than patching around the current model.

## ORM

### Selected Choice
Prisma.

### Why It Was Selected
- It is a strong fit for AI-assisted development because schema intent is explicit and generated client usage is predictable.
- It aligns with the repository’s schema governance and database specification docs.
- It keeps the TypeScript codebase consistent and makes relation handling more maintainable for a small team.
- It works well with the approved PostgreSQL foundation and shared-table schema discipline.

### Why Alternatives Were Rejected
- TypeORM: more legacy and less aligned with the current repository direction.
- Drizzle: lightweight and attractive, but less aligned with the current schema governance flow already documented.
- Raw SQL only: too hard to maintain safely and consistently for a solo founder.

### Expected Scaling Limits
- Prisma can become cumbersome for highly specialized query patterns or extremely advanced database features.
- Very large schemas and complex migrations require careful governance.
- Some performance-sensitive queries may eventually need targeted SQL outside the ORM.

### Upgrade Path
- Keep Prisma as the primary ORM and introduce raw SQL only for reviewed edge cases.
- If the query layer becomes a bottleneck, isolate advanced queries behind repository helpers rather than abandoning the ORM.
- Maintain schema review discipline so generated models stay aligned with the approved docs.

## Authentication

### Selected Choice
Custom server-managed sessions with secure HttpOnly cookies.

### Why It Was Selected
- It matches the approved security model for admin-created users and tenant-safe access.
- It is easier to understand and support than token-heavy approaches for a school SaaS.
- It reduces accidental exposure in the browser and works well for an API-first web app.
- It is maintainable for a solo founder and straightforward for AI-assisted implementation.

### Why Alternatives Were Rejected
- JWT-only auth: better for stateless APIs in some cases, but harder to revoke and easier to misuse in a tenant-sensitive system.
- External identity providers first: can speed setup, but add vendor coupling and complexity before the core product is stable.
- Passwordless or public signup flows: conflict with the approved admin-created user model.

### Expected Scaling Limits
- Native mobile clients will eventually need a token strategy that complements the session model.
- Session storage and revocation need to remain reliable as the user base grows.
- Authentication support workflows can become operationally expensive if password and session lifecycle events are not well instrumented.

### Upgrade Path
- Keep the browser session model as the primary web auth flow.
- Add a mobile-friendly token exchange later if and when native apps are approved.
- Preserve session revocation, audit, and tenant binding as non-negotiable security primitives.

## Storage

### Selected Choice
Cloudflare R2.

### Why It Was Selected
- It is a strong fit for documents, logos, exports, attachments, and generated PDFs.
- It supports server-controlled access patterns and tenant-scoped object organization.
- It keeps storage costs low and is operationally simple for a solo founder.
- It aligns with the architecture requirement that file access stay server-controlled.

### Why Alternatives Were Rejected
- Local disk storage: not suitable for scalable SaaS or multi-instance hosting.
- Vendor-specific document services: too much coupling too early.
- S3-only thinking: workable, but Cloudflare R2 is the better cost and simplicity fit for this stack.

### Expected Scaling Limits
- Basic object storage is not enough for high-volume media delivery or live video workflows.
- Large file uploads and heavy exports may require queued processing and lifecycle management.
- Storage cost and access patterns need attention as tenant media volume grows.

### Upgrade Path
- Keep documents and exports in object storage now.
- If video classes become real product scope, introduce a dedicated media pipeline or CDN-backed video service later.
- Preserve tenant-scoped paths and signed access URLs as the default model.

## Email

### Selected Choice
Resend.

### Why It Was Selected
- It is strong for transactional email, which is the most important early email use case for MySchoolOS.
- It is easy to integrate and keeps the notification layer simple.
- It fits invitations, password resets, approvals, and operational alerts well.
- It is a good developer-experience fit for AI-assisted and solo-founder workflows.

### Why Alternatives Were Rejected
- SendGrid: capable, but heavier and more marketing-oriented than this project needs at the start.
- AWS SES: cost-effective, but more operationally rough for a solo founder.
- Postmark: excellent, but Resend is a better fit for fast iteration and modern workflow ergonomics.

### Expected Scaling Limits
- Transactional email is a good fit, but marketing or lifecycle automation could outgrow this setup.
- Deliverability and sender reputation need active maintenance as volume increases.

### Upgrade Path
- Keep transactional mail separate from any future marketing mail.
- Add tenant-specific sender domains as white-label requirements mature.
- If volume or workflow complexity grows, the email provider can change without changing the product architecture.

## PDF Generation

### Selected Choice
HTML to PDF using Playwright.

### Why It Was Selected
- It allows the same design system and layout language used in the web app to drive report cards and official documents.
- It is easier to maintain than low-level PDF composition for a solo founder.
- It is compatible with AI-assisted UI generation because the source of truth stays in HTML and CSS.

### Why Alternatives Were Rejected
- Programmatic PDF libraries only: too low-level and time-consuming for complex school documents.
- Puppeteer: viable, but Playwright is already the broader testing and automation standard in this stack.
- Dedicated document generation platforms: extra vendor complexity before the need is proven.

### Expected Scaling Limits
- Very high-volume batch generation can become slow if PDFs are rendered synchronously.
- Complex templates and large assets can increase memory and runtime costs.

### Upgrade Path
- Generate PDFs through the worker queue rather than the request path.
- If document volume rises, isolate generation workers and cache reusable assets.
- If advanced publishing workflows emerge, keep template versioning so old documents remain reproducible.

## Background Jobs

### Selected Choice
Postgres-backed queue with a dedicated worker.

### Why It Was Selected
- It keeps the stack simple by reusing PostgreSQL instead of adding Redis immediately.
- It fits the approved architecture: one web app, one API, and a worker only when background jobs are required.
- It is easier to understand and operate for a solo founder than a multi-layer eventing platform.

### Why Alternatives Were Rejected
- Redis-backed queues first: useful at scale, but an unnecessary moving part for the MVP.
- Managed workflow tools: can be productive, but add another external dependency and abstraction layer.
- In-request background work: unsafe for report generation, email, and other asynchronous tasks.

### Expected Scaling Limits
- Heavy queue volume or complex retry orchestration may outgrow a simple Postgres queue.
- Long-running media or bulk-processing workloads may strain the shared database if not isolated carefully.

### Upgrade Path
- Start with tenant-scoped jobs and a dedicated worker.
- If volume grows, move queue processing to a more specialized system while keeping the job contract stable.
- Keep all queued work idempotent and auditable so migration later is straightforward.

## Hosting

### Selected Choice
Vercel for the frontend, Railway/Fly.io/Coolify for the backend and worker.

### Why It Was Selected
- Vercel is a practical fit for a Vite frontend and supports rapid iteration.
- Railway, Fly.io, or Coolify keep the backend and worker flexible and portable.
- The split maps cleanly to the approved deployment topology.
- This combination is manageable for a solo founder without locking the whole system into one vendor’s full-stack path.

### Why Alternatives Were Rejected
- All-in AWS: powerful, but too operationally heavy for the current team size.
- Self-managed Kubernetes: far too complex for the current phase.
- Hosting everything inside the frontend platform alone: blurs the architecture and weakens backend independence.

### Expected Scaling Limits
- Split hosting creates operational coordination overhead.
- If traffic grows, the API and worker will need independent scaling and deployment discipline.
- Different hosting providers can introduce observability and networking complexity.

### Upgrade Path
- Keep the web app and API separable from the start.
- If the backend grows substantially, move to a more standardized container platform or separate scaling model.
- Preserve environment-driven configuration so the deployment target can change without rewriting the app.

## Monitoring

### Selected Choice
Sentry.

### Why It Was Selected
- Sentry provides fast value for application errors and performance issues.
- It is simple enough for a solo-founder team to adopt quickly.
- It supports tenant-aware debugging, audit-sensitive workflows, and operational support.

### Why Alternatives Were Rejected
- Datadog or New Relic first: strong products, but more expensive and more platform-heavy than necessary right now.
- Homegrown logging only: insufficient for a tenant-sensitive production SaaS.
- OpenTelemetry-first as the primary stack: good later, but unnecessary complexity for the bootstrap phase.

### Expected Scaling Limits
- Observability volume can become noisy if event naming and tagging are not disciplined.
- More advanced distributed tracing can be added later if needed.

### Upgrade Path
- Start with structured logs and error tracking.
- Add richer tracing or metrics only if the product grows into a genuine observability need.
- If the team grows or compliance demands increase, migrate to a fuller observability platform without changing the application instrumentation model.

## Testing

### Selected Choice
Vitest, Testing Library, Playwright, and database integration tests.

### Why It Was Selected
- It is a modern TypeScript-friendly stack that is easy for AI tools to work with.
- It covers the important failure modes for multi-tenant SaaS: auth, tenant resolution, authorization, and cross-tenant leakage.
- It supports a clear split between fast unit tests and high-value integration or end-to-end tests.

### Why Alternatives Were Rejected
- Jest as the primary choice: still viable, but Vitest is lighter and more aligned with the modern TypeScript stack.
- Cypress as the main E2E tool: workable, but Playwright is stronger for complex browser flows and multi-domain behavior.
- Unit tests only: too risky for a tenant-isolated platform.

### Expected Scaling Limits
- E2E suites can become slow as the product grows.
- Database integration testing needs careful setup to stay reliable.
- Tenant leakage checks can become expensive if they are scattered rather than structured.

### Upgrade Path
- Keep unit tests close to the code they protect.
- Keep integration tests focused on the database and middleware boundaries.
- Keep Playwright coverage concentrated on the highest-risk workflows.
- If the suite grows large, split tests by responsibility and run the expensive scenarios selectively in CI.

## Recommended Overall Shape
This stack gives MySchoolOS:
- A Lovable-compatible frontend that is faster to bootstrap than an SSR-first framework
- A single TypeScript codebase style across layers
- A strict tenant-aware backend with a stable API boundary
- A shared PostgreSQL data model that matches the approved architecture
- A practical path to white-labeling, custom domains, report cards, and later LMS features
- A low-friction foundation for future video classes through dedicated media services when needed

## Final Recommendation
Adopt the recommended stack now unless a later ADR changes the frontend, hosting, or identity model.

The main reason for this stack is not novelty. It is fit:
- fit for the approved multi-tenant model
- fit for the MVP phase order
- fit for a small team that needs to ship safely
- fit for Lovable compatibility and AI-assisted development
- fit for later growth into mobile, LMS, and media-heavy capabilities without re-platforming the core
