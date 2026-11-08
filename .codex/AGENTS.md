# Codex project workflow

Read root `AGENTS.md` explicitly: this file is inside `.codex/` and is not a substitute for root instructions.

- Follow `docs/ai-workflow.mdx` and root `AGENTS.md`: work logs are only for completed code changes.
- Keep work within the current user's request. Do not implement roadmap items automatically.
- Preserve user changes, protect secrets, use PowerShell, and do not auto-commit.
- Only after completed application or operational script code changes, write a phase-linked work log and update relevant status/index/navigation. Do not log questions, reviews, Git operations, config/docs-only work or unfinished work.
- `.codex/config.toml` contains runtime configuration only. Managed application policies may override it; project-local settings may require project trust.
