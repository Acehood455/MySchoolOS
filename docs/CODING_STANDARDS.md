# Coding Standards

## Purpose
Define the engineering standards that future code must follow so the platform remains maintainable, secure, and consistent across teams and AI agents.

## Scope
- Covers coding conventions, design expectations, review discipline, and quality standards.
- Serves as the baseline for future implementation work.
- Does not include actual application code or library-specific patterns.

## Ownership
- Primary owner: Engineering Lead
- Review owners: Architecture Lead and Security Lead
- AI agent role: Use these standards when generating or reviewing future code, but do not create code in this task.

## Update Rules
- Update when the codebase adopts new conventions or tooling.
- Any change must preserve readability, security, and consistency.
- Keep standards practical and enforceable.
- Unknown details should remain `[TBD]` until the team decides.
- AI tools must treat these standards as the default style and quality baseline for future code.

## Standards
### General
- Prefer clear, readable, maintainable code over clever code.
- Keep functions, modules, and components focused on a single responsibility.
- Avoid duplication when a shared abstraction would be clearer.

### Naming
- Use descriptive names that reflect domain intent.
- Avoid ambiguous abbreviations unless they are standard in the domain.

### Structure
- Keep boundaries aligned with modules and domains.
- Separate business logic from presentation and transport concerns.
- Avoid cross-cutting coupling without a documented reason.

### Error Handling
- Fail safely and explicitly.
- Preserve actionable error context without exposing sensitive data.
- Validate assumptions at system boundaries.

### Security
- Treat security checks as mandatory, not optional.
- Never trust client input.
- Never log secrets or tenant-sensitive data unnecessarily.

### Testing
- High-risk code paths require strong test coverage.
- Tenant boundaries, authorization, and critical workflows must be tested.
- Regression tests should protect against prior security and isolation bugs.

### Reviews
- Every significant change requires review.
- Reviewers should check for architecture drift, security issues, and tenant leakage risks.

## Examples
- Good standard: a small function with a single responsibility and clear domain naming.
- Bad standard: a utility that knows about every module and every tenant exception.
- Good standard: tests that cover tenant isolation for critical paths.
- Bad standard: shipping security-sensitive logic without verification.

## Decision Record
- Decision: Coding standards are documented separately from implementation so they can be reviewed independently.
- Status: Approved
- Reason: Future code contributors, including AI agents, need a shared quality baseline.
- Alternatives considered: Enforcing standards only in code review comments.
- Date: `[TBD]`

## AI Contribution Rules
- AI tools must follow these standards when drafting future code, tests, or refactors.
- AI tools must not choose complex patterns unless they are justified by the codebase.
- AI tools must preserve tenant, security, and architecture boundaries in generated code.
- AI tools should explicitly note when a suggestion is a placeholder pending language/tooling decisions.

## Review Requirements
- Code reviews should check naming, structure, security, and maintainability.
- High-risk changes require targeted review for tenant isolation and authorization.
- Reviewers should reject code that creates hidden coupling or unclear ownership.

## Change Management Requirements
- Update standards when tooling, framework conventions, or quality expectations change.
- Keep changes explicit so future contributors know which standards are current.
- Preserve compatibility guidance when introducing new conventions.

## Language and Tooling
- Primary language(s): `[TBD]`
- Formatting tools: `[TBD]`
- Linting rules: `[TBD]`
- Testing stack: `[TBD]`

## Open Decisions
- Final framework conventions: `[TBD]`
- Shared repository layout: `[TBD]`
- Commit and branch policy: `[TBD]`
