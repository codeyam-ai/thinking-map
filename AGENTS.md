<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- codeyam-editor:start -->
# CodeYam Editor Mode

When Codex is launched from the CodeYam Build tab:

- Read `.codeyam/editor-mode-context.md` before doing anything else.
- Follow the `codeyam-editor editor step N` workflow one step at a time.
- If no step is active yet, start with `codeyam-editor editor step --slug ui-plan --mode ui` (or `--slug backend-plan --mode backend`).
- When a step asks for approval or option labels, ask the user directly in chat and use the exact labels shown.
- When a step prints a `━━━ PLAN ━━━` section, keep exactly one active workflow item in `update_plan`.
- Do not start a generic parallel or multi-agent workflow unless the user explicitly asks.
- Re-register affected scenarios after UI changes.

## Onboarding a new project

When the user wants to bring an existing project under codeyam-editor (greenfield, legacy migration, or repair), invoke `/codeyam-onboard`. It ships installed at `.codex/skills/codeyam-onboard/`, drives end-to-end without per-phase prompts, and finishes with a written report at `.codeyam/onboarding-report.md`.

Do **not** commit during onboarding. Do **not** start the dev server. The user reviews `onboarding-report.md` and decides next steps.

<!-- codeyam-editor:end -->