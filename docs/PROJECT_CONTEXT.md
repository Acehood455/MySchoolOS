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
- Treat this as the orientation page for new humans and AI tools.

## Current Context
- Product: School OS, a multi-tenant cloud-based operating system for primary and secondary schools
- Repository state: Documentation foundation in progress
- Primary design concern: Prevent tenant isolation failures
- Primary delivery concern: Keep scope small enough to ship safely
- Primary platform principles: multi-tenant first, security first, documentation first, modular architecture, feature flags, and white-label support
- Current data model decision: single Neon PostgreSQL database with shared tables and `school_id` tenant isolation
- Current identity decision: server-managed session authentication with admin-created users only in the MVP

## Examples
- Good context note: "We are still deciding the initial school segment."
- Bad context note: "This will definitely serve every education market."
- Good context note: "Tenant isolation is the primary design concern."
- Bad context note: "The architecture can be decided later."

## Decision Record
- Decision: The repository uses documentation-first alignment for major product and architecture choices.
- Status: Approved
- Reason: Multiple AI agents need a shared baseline before implementation begins.
- Alternatives considered: Ad hoc chat-based alignment and implementation-first discovery.
- Date: 2026-06-16

## Assumptions
- The platform will serve more than one school tenant.
- AI agents will contribute to planning and documentation.
- Security and tenancy decisions must be made before implementation details.

## AI Contribution Rules
- AI tools should use this document to understand the current state before proposing changes.
- AI tools must not convert assumptions into facts.
- AI tools must update the unknowns section when a decision becomes approved.
- AI tools should reference this file when summarizing project state.

## Review Requirements
- Product, architecture, and security owners should review major context changes.
- Any update that affects project direction must be reflected in the authoritative docs.

## Change Management Requirements
- Keep the context current with the latest approved project direction.
- Remove stale assumptions when they are no longer true.
- If the project direction shifts, update the linked governing documents in the same change window.

## Unknowns
- Final target market: `[TBD]`
- Application hosting topology: One shared web app and API surface, with a worker only if background jobs require it.
- Primary integrations: `[TBD]`
- Compliance requirements: Deferred until the launch market is chosen.

## Working Agreements
- Prefer documentation-first decisions for major platform choices.
- Resolve product ambiguity before implementation starts.
- Preserve a single source of truth for constraints and priorities.

## Open Decisions
- Source of truth for roadmap updates: Product owns roadmap updates.
- Source of truth for module ownership: Architecture owns module ownership.
