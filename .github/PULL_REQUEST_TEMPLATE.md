## What this changes

<!-- What the change does, and why. The diff shows what; it can't show why. -->

## How you verified it

<!-- What you actually ran or clicked through. "CI is green" is not verification
     of a UI change; say what you looked at. -->

## Checks

- [ ] `npx prisma generate` then `npx tsc --noEmit` is clean
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] New tests have a `//` comment above each `it()` saying what they verify and why
- [ ] No new `npm run lint` violations (see `CONTRIBUTING.md` — lint is not yet a CI gate)
- [ ] Docs updated if behavior changed (`README.md`, `DATABASE.md`, `AGENT_CONTRACT.md`, `FEATURE_PATTERNS.md`)

## Anything reviewers should know

<!-- Trade-offs you made, things you deliberately left out, parts you're unsure
     about. Flagging a doubt here is much cheaper than a reviewer finding it. -->
