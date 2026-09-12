# Phoenix Claude Code Skills Migration

## Status
Completed the migration of Phoenix Claude Code skills to the native `.claude/skills/` layout.

## Source of truth
`.claude/skills/<skill-name>/SKILL.md` is the only canonical skill location.

The retired `skills/` tree must not be referenced or recreated.

## Operating rules
- `CLAUDE.md` defines the global Claude Code workflow.
- `.claude/skills/` contains skill-specific operating rules.
- `docs/` contains architecture decisions and technical specifications.
- Skills must not depend on deleted legacy skill paths.
- Database guidance references `docs/DATABASE_MODEL.md`.
- Work is committed directly to `main` unless a different workflow is explicitly requested.

## Validation checklist
- [x] Native skill directories exist for the Phoenix architecture/domain areas.
- [x] Global instructions point to `.claude/skills/`.
- [x] Legacy skill references removed from the global instructions and migrated skills touched so far.
- [x] Database skill points to the actual database model document.
- [ ] Remaining native skill files should be periodically scanned for stale legacy-path references as the repository evolves.

## Architectural intent
The migration is structural, not a change to domain ownership. Existing architecture documents remain authoritative for module behavior; Claude Code skills encode implementation guardrails and review expectations.
