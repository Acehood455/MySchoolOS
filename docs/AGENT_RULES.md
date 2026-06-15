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
- All AI tools contributing here must follow the same rules, even if their default behavior differs.

## Agent Operating Rules
1. Do not generate application code when asked for documentation-only work.
2. Do not generate database schema unless explicitly requested in a separate approved task.
3. Do not invent product requirements, architecture decisions, or security exceptions.
4. Do not assume a single-tenant model.
5. Do not assume white-label support means shared administrative control.
6. Do not weaken security or isolation to simplify implementation.
7. Do not add unapproved features during documentation, planning, or review tasks.
8. Do not overwrite user changes unless explicitly instructed.
9. Do not create hidden dependencies between documents without updating the source references.
10. Do not rewrite a document in a way that erases unresolved decisions.
11. Do not answer with code when the request is for documentation governance.

## Examples
- Good agent behavior: identify a tenancy conflict and stop to clarify rather than guessing.
- Good agent behavior: update the related docs together after a change to architecture.
- Bad agent behavior: inventing a permission model because a prompt asked for one.
- Bad agent behavior: merging documents silently and losing traceability.

## Required Behavior
- Read the governing docs before making changes.
- Preserve terminology across documents.
- Use `[TBD]` for unresolved decisions.
- Keep changes small, traceable, and aligned to the current task.
- Surface conflicts instead of silently resolving them.
- Prefer explicit uncertainty over false confidence.

## Decision Record
- Decision: All AI contributors must use the docs as the authoritative source of truth.
- Status: Approved
- Reason: Multiple agents need one shared policy surface to avoid drift.
- Alternatives considered: Per-agent local conventions and no shared governance document.
- Date: `[TBD]`

## AI Contribution Rules
- AI tools must read the governing documents before proposing changes.
- AI tools must state when a request conflicts with a non-negotiable.
- AI tools must preserve terms like tenant, module, and owner consistently.
- AI tools must not cross from documentation into implementation when instructed not to.
- If uncertain, AI tools should use `[TBD]` rather than inventing a decision.

## Review Requirements
- High-risk AI-generated changes require human review.
- Any change touching security, tenancy, or MVP scope requires cross-functional review.
- Reviewers should check whether the AI preserved the source-of-truth hierarchy.

## Change Management Requirements
- Record why a rule was added or changed.
- Keep the rules short enough that contributors will actually read them.
- Update dependencies when a change in one doc affects AI behavior elsewhere.

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

## Operational Notes for AI Tools
- Codex, Loveable, Claude Code, Gemini, and Cursor should all treat this same priority order.
- Agent output should reference the governing doc instead of restating policy from memory.
- When documents disagree, the higher-priority doc wins until a human resolves the conflict.

## Escalation Triggers
- Any request that changes tenant isolation assumptions
- Any request that changes security controls
- Any request that expands MVP scope
- Any request that introduces a new major module
- Any request that conflicts with documented ownership
- Any request to provide implementation details when documentation-only work is requested
- Any request to use feature flags as a substitute for permissions

## Open Decisions
- Agent review workflow: `[TBD]`
- Required approval chain for high-risk edits: `[TBD]`
