# AI Start Here

STOP.

Before making any changes, read these documents in order:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/NON_NEGOTIABLES.md`
3. `docs/AGENT_RULES.md`
4. `docs/ARCHITECTURE.md`
5. `docs/SECURITY_REQUIREMENTS.md`
6. The relevant module spec for the requested change

Do not proceed until all required documents have been reviewed.

The documentation is the source of truth.

If documentation and code conflict, documentation wins until explicitly updated.

## Purpose
Give every AI tool a single starting point before it reads, plans, edits, or proposes changes.

## Scope
- Applies to all AI tools contributing to this repository.
- Applies before documentation work, architecture work, refactoring, testing, and implementation work.

## Ownership
- Primary owner: Repository Maintainer
- Review owner: Architecture Lead
- AI agent role: Always begin here before touching the repository.

## Update Rules
- Update this file only when the required reading order or source-of-truth policy changes.
- Keep the language short, direct, and unambiguous.
- If this file conflicts with a later document, the later document must explicitly supersede it.

## Review Requirements
- Any change to this file must be reviewed for consistency with `docs/AGENT_RULES.md` and `docs/NON_NEGOTIABLES.md`.

## Change Management Requirements
- Preserve the stop-first instruction.
- Preserve the reading order unless a human explicitly changes it.
- Do not add extra workflow steps that dilute the instruction.
