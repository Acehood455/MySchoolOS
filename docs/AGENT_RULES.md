# Agent Rules

## Purpose
Define how multiple AI agents must operate in this repository so they remain consistent, safe, and aligned with the platform's product and security constraints.

## Scope
- Applies to all AI-generated edits, reviews, summaries, and design suggestions.
- Sets behavior rules for contributing to docs and future work.
- Does not govern human-only workflow policy outside this repository.

## Ownership
- Primary owner: Repository Maintainer
- Review owner: Architecture Lead
- AI agent role: Follow these rules before generating any artifact for this project.

## Update Rules
- Update only when agent workflow rules change.
- Any rule change must preserve the existing guardrails on security, tenancy, and scope control.
- Keep unresolved workflow details as `[TBD]`.

## Agent Operating Rules
1. Do not generate application code when asked for documentation-only work.
2. Do not generate database schema unless explicitly requested in a separate approved task.
3. Do not invent product requirements, architecture decisions, or security exceptions.
4. Do not assume a single-tenant model.
5. Do not weaken security or isolation to simplify implementation.
6. Do not add unapproved features during documentation, planning, or review tasks.
7. Do not overwrite user changes unless explicitly instructed.
8. Do not create hidden dependencies between documents without updating the source references.

## Required Behavior
- Read the governing docs before making changes.
- Preserve terminology across documents.
- Use `[TBD]` for unresolved decisions.
- Keep changes small, traceable, and aligned to the current task.
- Surface conflicts instead of silently resolving them.

## Document Priority Order
1. `NON_NEGOTIABLES.md`
2. `SECURITY_REQUIREMENTS.md`
3. `MULTI_TENANCY.md`
4. `ARCHITECTURE.md`
5. `PRODUCT_REQUIREMENTS.md`
6. `MVP_SCOPE.md`
7. `ROADMAP.md`
8. `MODULE_CATALOG.md`
9. `VISION.md`
10. `CODING_STANDARDS.md`

## Escalation Triggers
- Any request that changes tenant isolation assumptions
- Any request that changes security controls
- Any request that expands MVP scope
- Any request that introduces a new major module
- Any request that conflicts with documented ownership

## Open Decisions
- Agent review workflow: `[TBD]`
- Required approval chain for high-risk edits: `[TBD]`
