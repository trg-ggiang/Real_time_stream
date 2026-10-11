# Codex project workflow

Read root `AGENTS.md` explicitly: this file is inside `.codex/` and is not a substitute for root instructions.

- Follow `docs/ai-workflow.mdx` and the mandatory session-close checklist in root `AGENTS.md`.
- Keep work within the current user's request. Do not implement roadmap items automatically.
- Preserve user changes, protect secrets, use PowerShell, and do not auto-commit.
- At session end, write a phase-linked work log, update phase status, session index, changelog, and docs navigation.
- `.codex/config.toml` contains runtime configuration only. Managed application policies may override it; project-local settings may require project trust.
