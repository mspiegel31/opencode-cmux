# Milestones

## v1.0 MVP (Shipped: 2026-03-20)

**Phases completed:** 3 phases, 6 plans, 0 tasks

**Key accomplishments:**

- TypeScript build pipeline configured with `tsc`, ESM output, and declaration files
- `src/index.ts` entry point exporting both `CmuxPlugin` and `CmuxSubagentViewer`
- Per-plugin JSON config system with file bootstrapping, deep merge, and env var overrides
- Both plugins wired to respect individual `enabled` flags from config
- GitHub Actions CI (typecheck + build + test) and release (semantic-release + npm OIDC publish) workflows
- Full README covering installation, registration, and configuration
- Published `@mspiegel31/opencode-cmux@1.0.0` to npm

---
