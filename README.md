# MySchoolOS

Foundation bootstrap for the MySchoolOS multi-tenant school platform.

## Structure
- `apps/web` - Vite frontend shell
- `apps/api` - Fastify backend shell
- `apps/worker` - worker shell
- `packages/shared` - shared types and errors
- `packages/ui` - shared UI primitives
- `packages/config` - shared configuration tokens
- `packages/db` - Prisma client and database helpers
- `packages/observability` - logging foundation
- `prisma` - Prisma schema and migrations

## Scripts
- `npm run dev:web`
- `npm run dev:api`
- `npm run dev:worker`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
