# Agent Rules

## Purpose
Define how all AI contributors must operate in this repository so they remain consistent, safe, and aligned with the platform's product, security, and architecture constraints.

## Scope
- Applies to all AI-generated edits, reviews, summaries, and design suggestions.
- Sets behavior rules for contributing to docs and future work.
- Does not govern human-only workflow policy outside this repository.
- Applies to Codex, Loveable, Claude Code, Gemini, Cursor, and any other AI contributor.

## Ownership
- Primary owner: Repository Maintainer
- Review owner: Architecture Lead
- AI agent role: Follow these rules before generating any artifact for this project.

## Update Rules
- Update only when agent workflow rules change.
- Any rule change must preserve the existing guardrails on security, tenancy, and scope control.
- Keep unresolved workflow details as `[TBD]`.
- All AI tools contributing here must follow the same rules, even if their default behavior differs.
- This document must stay consistent with `NON_NEGOTIABLES.md`, `SECURITY_REQUIREMENTS.md`, `MULTI_TENANCY.md`, and `ARCHITECTURE.md`.

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
12. Do not make unrelated modifications while solving a focused request.
13. Do not touch protected files without explicit approval.
14. Do not perform broad refactors when a smaller safe change is available.
15. Do not introduce new dependencies unless they are required, approved, and documented.
16. Do not remove tests or weaken test coverage to simplify a change.
17. Do not propose architectural changes without explaining the risk and tradeoffs first.

## Required Reading Order
AI contributors must read documents in this order before making changes:
1. `AI_START_HERE.md`
2. `NON_NEGOTIABLES.md`
3. `SECURITY_REQUIREMENTS.md`
4. `MULTI_TENANCY.md`
5. `ARCHITECTURE.md`
6. `ADRS.md`
7. `PRODUCT_REQUIREMENTS.md`
8. `MVP_SCOPE.md`
9. `ROADMAP.md`
10. `MODULE_CATALOG.md`
11. `VISION.md`
12. `PROJECT_CONTEXT.md`
13. `CODING_STANDARDS.md`

## Planning Requirements
- Start with the smallest safe change that satisfies the request.
- State the intended outcome before proposing implementation details.
- Identify assumptions and mark them `[TBD]` when unresolved.
- Break large changes into reviewable steps.
- If a request spans multiple domains, propose a sequence instead of a single broad change.
- Explain risks before proposing any architectural change.

## Scope Control
- Stay within the explicit user request unless a blocking issue requires a narrow, documented extension.
- Never bundle unrelated fixes, cleanups, or enhancements into the same change.
- Prefer one concern per change unless the documents require a coordinated update.
- If scope must expand, explain why the expansion is necessary and what it will impact.
- Refuse feature creep even when the extra work seems convenient.

## Documentation Updates
- Update the authoritative docs whenever a decision changes.
- Keep terminology consistent across documents.
- Update related docs together when a change affects shared concepts.
- Add or revise decision records when a rule, requirement, or architecture choice changes.
- Preserve unresolved decisions as `[TBD]` until a human resolves them.
- Do not silently edit a document in a way that changes its meaning.

## Risk Assessment Requirements
- Identify security risk, tenancy risk, architecture drift risk, and test coverage risk before making changes.
- Call out any impact on protected zones, release gates, or cross-document consistency.
- Explain why the chosen approach is the smallest safe change.
- If a change touches identity, tenancy, exports, finance, or admin functions, treat it as high risk until reviewed.
- Always explain risks before proposing architectural changes.

## Protected File Handling
- Treat `NON_NEGOTIABLES.md` as the highest-priority project authority.
- Treat `SECURITY_REQUIREMENTS.md`, `MULTI_TENANCY.md`, `ARCHITECTURE.md`, and other authoritative docs as protected zones.
- Request explicit approval before editing protected files.
- Do not rewrite protected files to make them softer, shorter, or less specific unless the change is required and approved.
- If a protected file conflicts with a request, surface the conflict instead of improvising.

## Refactoring Restrictions
- Only refactor when the refactor is necessary to satisfy the request or remove a verified defect.
- Do not refactor adjacent code "while you are here" unless the user asked for it.
- Do not change behavior as a side effect of cleanup unless the behavior change is documented and approved.
- Preserve public contracts, ownership boundaries, and documented rules unless a change is explicitly approved.
- Prefer surgical edits over sweeping rewrites.

## Dependency Restrictions
- Do not add dependencies unless they are necessary for the requested work.
- Do not upgrade or replace dependencies as a side effect of unrelated work.
- Do not change dependency versions without a clear reason and review of impact.
- Any dependency change must be documented if it affects architecture, security, or testing.
- Prefer existing approved tooling over introducing new packages or services.

## Testing Requirements
- Any change that affects behavior must have an appropriate test strategy.
- High-risk changes require targeted tests for tenancy, security, and regression coverage.
- Do not weaken or remove tests unless replacements are added in the same change.
- If tests cannot be run, say so explicitly and explain why.
- Prefer the smallest set of tests that proves the requested change is safe.

## Examples
- Good agent behavior: identify a tenancy conflict and stop to clarify rather than guessing.
- Good agent behavior: update the related docs together after a change to architecture.
- Bad agent behavior: inventing a permission model because a prompt asked for one.
- Bad agent behavior: merging documents silently and losing traceability.
- Good agent behavior: explain the risks of a service split before recommending one.
- Bad agent behavior: refactor unrelated modules because they "look old."

## Required Behavior
- Read the governing docs before making changes.
- Preserve terminology across documents.
- Use `[TBD]` for unresolved decisions.
- Keep changes small, traceable, and aligned to the current task.
- Surface conflicts instead of silently resolving them.
- Prefer explicit uncertainty over false confidence.
- Prefer the smallest safe change.
- Never perform unrelated modifications.
- Always explain architectural risk before proposing a design change.

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
- AI tools must not modify protected files without explicit approval.
- AI tools must not bundle unrelated changes into a single response or patch.

## Review Requirements
- High-risk AI-generated changes require human review.
- Any change touching security, tenancy, or MVP scope requires cross-functional review.
- Reviewers should check whether the AI preserved the source-of-truth hierarchy.
- Reviewers should verify that the change is the smallest safe change that satisfies the request.

## Change Management Requirements
- Record why a rule was added or changed.
- Keep the rules short enough that contributors will actually read them.
- Update dependencies when a change in one doc affects AI behavior elsewhere.
- Record when a request was intentionally narrowed to avoid unrelated modifications.

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
10. `PROJECT_CONTEXT.md`
11. `CODING_STANDARDS.md`

## Operational Notes for AI Tools
- Codex, Loveable, Claude Code, Gemini, and Cursor should all treat this same priority order.
- Agent output should reference the governing doc instead of restating policy from memory.
- When documents disagree, the higher-priority doc wins until a human resolves the conflict.
- When architecture changes are proposed, explain the risk before the recommendation.

## Escalation Triggers
- Any request that changes tenant isolation assumptions
- Any request that changes security controls
- Any request that expands MVP scope
- Any request that introduces a new major module
- Any request that conflicts with documented ownership
- Any request to provide implementation details when documentation-only work is requested
- Any request to use feature flags as a substitute for permissions
- Any request to edit protected files without approval

## Open Decisions
- Agent review workflow: `[TBD]`
- Required approval chain for high-risk edits: `[TBD]`
