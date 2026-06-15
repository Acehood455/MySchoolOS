# Project Context

## Purpose
Capture the current business, product, and technical context so future contributors understand what this repository is for and what constraints already exist.

## Scope
- Summarizes the project's intended direction, major assumptions, and current unknowns.
- Helps new agents avoid repeating discovery work.
- Does not contain implementation details or task lists.

## Ownership
- Primary owner: Project Lead
- Contributing owners: Product, Architecture, and Security Leads
- AI agent role: Keep this document concise, current, and grounded in approved facts.

## Update Rules
- Update when the project direction, target users, or delivery assumptions change.
- Distinguish facts from assumptions and label assumptions clearly.
- Keep the document short enough to stay useful.
- Do not introduce speculation as if it were settled.

## Current Context
- Product: Multi-tenant School ERP + LMS SaaS platform
- Repository state: Documentation foundation in progress
- Primary design concern: Prevent tenant isolation failures
- Primary delivery concern: Keep scope small enough to ship safely

## Assumptions
- The platform will serve more than one school tenant.
- AI agents will contribute to planning and documentation.
- Security and tenancy decisions must be made before implementation details.

## Unknowns
- Final target market: `[TBD]`
- Deployment model: `[TBD]`
- Initial MVP workflows: `[TBD]`
- Primary integrations: `[TBD]`
- Compliance requirements: `[TBD]`

## Working Agreements
- Prefer documentation-first decisions for major platform choices.
- Resolve product ambiguity before implementation starts.
- Preserve a single source of truth for constraints and priorities.

## Open Decisions
- Source of truth for roadmap updates: `[TBD]`
- Source of truth for module ownership: `[TBD]`
