# Foundation Build Prompts

## Purpose
Provide standardized prompt templates for Foundation work that can be reused safely with Codex, Claude Code, Gemini, Cursor, Roo Code, and Loveable.

These prompts are designed to keep implementation aligned with the governing documentation, reduce drift, and prevent unrelated or unsafe changes during Foundation execution.

## Foundation Rules

Before any code generation, the agent must read and follow:
- `AI_START_HERE.md`
- `PROJECT_CONTEXT.md`
- `NON_NEGOTIABLES.md`
- `AGENT_RULES.md`
- `ARCHITECTURE.md`
- `MULTI_TENANCY.md`
- `SECURITY_REQUIREMENTS.md`
- `ROLE_MATRIX.md`
- `DATABASE_DESIGN.md`
- `DATA_OWNERSHIP.md`
- `ENTITY_LIFECYCLES.md`
- `IMPLEMENTATION_PLAN.md`
- `ADRS.md`
- `FOUNDATION_IMPLEMENTATION_SPEC.md`
- `FOUNDATION_DATABASE_SPEC.md`
- `SCHEMA_GENERATION_SPEC.md`

Foundation work must always:
- Require a plan before coding
- Require an affected file list
- Require risk analysis
- Prohibit unrelated changes
- Respect tenant isolation, auditability, and role boundaries
- Stop if a requested change conflicts with governing documentation
- If any required document is missing, unreadable, or inaccessible, the agent must stop work and report the issue before making changes.
- Agents must not assume ownership of files that may currently be under active modification by another contributor. Potential conflicts must be reported before changes are proposed.

## Build Prompt Template

Use this template for new Foundation implementation work.

```text
Read and follow:
- AI_START_HERE.md
- PROJECT_CONTEXT.md
- NON_NEGOTIABLES.md
- AGENT_RULES.md
- ARCHITECTURE.md
- MULTI_TENANCY.md
- SECURITY_REQUIREMENTS.md
- ROLE_MATRIX.md
- DATABASE_DESIGN.md
- DATA_OWNERSHIP.md
- ENTITY_LIFECYCLES.md
- IMPLEMENTATION_PLAN.md
- ADRS.md
- FOUNDATION_IMPLEMENTATION_SPEC.md
- FOUNDATION_DATABASE_SPEC.md
- SCHEMA_GENERATION_SPEC.md

Task:
Describe the Foundation work you want completed.

Requirements:
- Produce a short implementation plan before making changes.
- List the exact files you expect to change.
- Analyze the security, tenant isolation, and audit risk.
- Make only the requested changes.
- Do not touch unrelated files.
- Do not add features outside Foundation scope.
- Do not generate schema unless explicitly requested.
- Do not invent rules that conflict with the governing docs.

Deliverable:
- Implement the requested Foundation changes only.
```

## Feature Prompt Template

Use this template for Foundation-scoped feature work.

```text
Read and follow:
- AI_START_HERE.md
- PROJECT_CONTEXT.md
- NON_NEGOTIABLES.md
- AGENT_RULES.md
- ARCHITECTURE.md
- MULTI_TENANCY.md
- SECURITY_REQUIREMENTS.md
- ROLE_MATRIX.md
- DATABASE_DESIGN.md
- DATA_OWNERSHIP.md
- ENTITY_LIFECYCLES.md
- IMPLEMENTATION_PLAN.md
- ADRS.md
- FOUNDATION_IMPLEMENTATION_SPEC.md
- FOUNDATION_DATABASE_SPEC.md
- SCHEMA_GENERATION_SPEC.md

Feature:
Describe the Foundation feature you want built.

Required before coding:
- Provide a plan for the work.
- List the files that will be affected.
- Identify tenant isolation implications.
- Identify audit implications.
- Identify any security or lifecycle impact.

Rules:
- Make only the requested change.
- Do not change unrelated areas.
- Do not introduce academic modules or non-Foundation scope.
- Do not contradict canonical roles, tenancy rules, or audit rules.

Output:
- Implement the feature only after confirming the above.
```

## Refactor Prompt Template

Use this template for safe Foundation refactoring.

```text
Read and follow:
- AI_START_HERE.md
- PROJECT_CONTEXT.md
- NON_NEGOTIABLES.md
- AGENT_RULES.md
- ARCHITECTURE.md
- MULTI_TENANCY.md
- SECURITY_REQUIREMENTS.md
- ROLE_MATRIX.md
- DATABASE_DESIGN.md
- DATA_OWNERSHIP.md
- ENTITY_LIFECYCLES.md
- IMPLEMENTATION_PLAN.md
- ADRS.md
- FOUNDATION_IMPLEMENTATION_SPEC.md
- FOUNDATION_DATABASE_SPEC.md
- SCHEMA_GENERATION_SPEC.md

Refactor target:
Describe the exact Foundation area to refactor.

Before changes:
- Produce a plan.
- List affected files.
- Explain the risk of the refactor.
- Confirm what must remain behaviorally identical.

Constraints:
- Preserve tenant isolation.
- Preserve audit behavior.
- Preserve canonical role and lifecycle rules.
- Do not expand scope.
- Do not touch unrelated files.
- Do not add feature work while refactoring.
```

## Bug Fix Prompt Template

Use this template for targeted Foundation bug fixes.

```text
Read and follow:
- AI_START_HERE.md
- PROJECT_CONTEXT.md
- NON_NEGOTIABLES.md
- AGENT_RULES.md
- ARCHITECTURE.md
- MULTI_TENANCY.md
- SECURITY_REQUIREMENTS.md
- ROLE_MATRIX.md
- DATABASE_DESIGN.md
- DATA_OWNERSHIP.md
- ENTITY_LIFECYCLES.md
- IMPLEMENTATION_PLAN.md
- ADRS.md
- FOUNDATION_IMPLEMENTATION_SPEC.md
- FOUNDATION_DATABASE_SPEC.md
- SCHEMA_GENERATION_SPEC.md

Bug:
Describe the defect and the expected behavior.

Before coding:
- Provide a short fix plan.
- List affected files.
- Analyze user impact, security impact, and tenant isolation impact.

Rules:
- Fix only the reported bug.
- Do not refactor unrelated code.
- Do not introduce new behavior unless needed to fix the bug.
- Do not violate Foundation scope or governing docs.
```

## Security Review Prompt

Use this template to request a security review of Foundation work.

```text
Read and follow:
- AI_START_HERE.md
- PROJECT_CONTEXT.md
- NON_NEGOTIABLES.md
- AGENT_RULES.md
- ARCHITECTURE.md
- MULTI_TENANCY.md
- SECURITY_REQUIREMENTS.md
- ROLE_MATRIX.md
- DATABASE_DESIGN.md
- DATA_OWNERSHIP.md
- ENTITY_LIFECYCLES.md
- IMPLEMENTATION_PLAN.md
- ADRS.md
- FOUNDATION_IMPLEMENTATION_SPEC.md
- FOUNDATION_DATABASE_SPEC.md
- SCHEMA_GENERATION_SPEC.md

Review target:
Describe the Foundation change set to review.

Required output:
- Plan of what is being reviewed
- Affected files
- Security risks
- Tenant isolation risks
- Audit coverage risks
- Approval or blocking findings

Rules:
- Review only the stated changes.
- Do not suggest unrelated feature work.
- Do not ignore governing docs.
- Treat tenant leakage, auth bypass, and audit gaps as blockers.
```

## Tenant Isolation Review Prompt

Use this template for tenant boundary reviews.

```text
Read and follow:
- AI_START_HERE.md
- PROJECT_CONTEXT.md
- NON_NEGOTIABLES.md
- AGENT_RULES.md
- ARCHITECTURE.md
- MULTI_TENANCY.md
- SECURITY_REQUIREMENTS.md
- ROLE_MATRIX.md
- DATABASE_DESIGN.md
- DATA_OWNERSHIP.md
- ENTITY_LIFECYCLES.md
- IMPLEMENTATION_PLAN.md
- ADRS.md
- FOUNDATION_IMPLEMENTATION_SPEC.md
- FOUNDATION_DATABASE_SPEC.md
- SCHEMA_GENERATION_SPEC.md

Review focus:
Assess tenant isolation for the proposed Foundation change.

Before review:
- Identify the affected files.
- State the tenant context flow.
- State whether `school_id` is present where required.
- State whether any cross-tenant access path exists.

Rules:
- No UI-only filtering.
- No cross-tenant foreign keys.
- No tenant-less tenant-owned records.
- No action may proceed if tenant isolation is ambiguous.
```

## Schema Review Prompt

Use this template for Prisma/schema governance review.

```text
Read and follow:
- AI_START_HERE.md
- PROJECT_CONTEXT.md
- NON_NEGOTIABLES.md
- AGENT_RULES.md
- ARCHITECTURE.md
- MULTI_TENANCY.md
- SECURITY_REQUIREMENTS.md
- ROLE_MATRIX.md
- DATABASE_DESIGN.md
- DATA_OWNERSHIP.md
- ENTITY_LIFECYCLES.md
- IMPLEMENTATION_PLAN.md
- ADRS.md
- FOUNDATION_IMPLEMENTATION_SPEC.md
- FOUNDATION_DATABASE_SPEC.md
- SCHEMA_GENERATION_SPEC.md

Schema request:
Describe the schema-related change or review target.

Before any schema output:
- Provide a plan.
- List affected files.
- Identify tenant-owned entities.
- Identify required indexes.
- Identify audit-sensitive tables.
- Identify security and migration risks.

Rules:
- Do not emit Prisma code unless explicitly requested and authorized.
- Do not create schema that conflicts with governance docs.
- Do not introduce cross-tenant relationships.
- Do not omit `school_id` where required.
```

## Pull Request Review Prompt

Use this template for reviewing Foundation pull requests.

```text
Read and follow:
- AI_START_HERE.md
- PROJECT_CONTEXT.md
- NON_NEGOTIABLES.md
- AGENT_RULES.md
- ARCHITECTURE.md
- MULTI_TENANCY.md
- SECURITY_REQUIREMENTS.md
- ROLE_MATRIX.md
- DATABASE_DESIGN.md
- DATA_OWNERSHIP.md
- ENTITY_LIFECYCLES.md
- IMPLEMENTATION_PLAN.md
- ADRS.md
- FOUNDATION_IMPLEMENTATION_SPEC.md
- FOUNDATION_DATABASE_SPEC.md
- SCHEMA_GENERATION_SPEC.md

Review request:
Review the linked Foundation changes.

Required review output:
- Affected files
- What changed
- Risk analysis
- Tenant isolation findings
- Security findings
- Audit findings
- Blocking issues only, if any

Rules:
- Review only the requested changes.
- Do not recommend unrelated improvements.
- Do not ignore documentation contradictions.
- Do not approve changes that weaken isolation, authentication, authorization, or auditability.
```
