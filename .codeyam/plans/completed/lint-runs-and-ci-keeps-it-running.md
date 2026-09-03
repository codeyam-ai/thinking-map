---
title: "Lint Runs, and CI Keeps It Running"
mode: backend
createdAt: "2026-09-03T16:49:32Z"
source: manual
---

## Summary

`npm run lint` has never worked in this repository. `eslint.config.mjs` imports
`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, but the
installed `eslint-config-next` is `15.5.25` — a package with no `exports` map,
shipping bare `core-web-vitals.js` / `typescript.js` CJS files. Node's ESM
resolver therefore refuses the extensionless subpath and ESLint dies with
`ERR_MODULE_NOT_FOUND ... Did you mean to import "eslint-config-next/core-web-vitals.js"?`
before it reads a single source file. `git log -S` shows `"next": "^16"` and
`"eslint-config-next": "^15.3.3"` were introduced in the *same* first commit
(`9aafd7c`), so this is not upgrade drift — the config has been unrunnable since
line one, and nothing gates on it (the only workflow is a deploy, and
`.codeyam/stack.json` declares no lint command).

The fix is a version bump: `eslint-config-next@16.3.4` matches the installed
`next@16.3.4` exactly and is flat-config native. `eslint.config.mjs` itself needs
no change — it is already written in the exact shape Next 16's own docs
prescribe. What is unknown, and what makes this more than a one-line diff, is
the backlog: 463 `.ts`/`.tsx` files under `app/` have never been linted. This
plan bumps the dependency, clears whatever surfaces, and adds a CI job so the
next drift fails a pull request instead of sitting undetected for the life of
the project.

## Key Decisions

- **Bump the dependency; do not touch `eslint.config.mjs`.** Next 16's ESLint
  reference (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`)
  documents precisely the current file's imports — `defineConfig`, spread
  `nextVitals`, `globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])`.
  The config was written for 16 all along; only the pinned version is behind.
  Changing the config to chase the 15-shaped `.js` subpaths would be fixing the
  wrong end.

- **Pin `^16.3.4` to match `next` exactly.** `eslint-config-next` ships in
  lockstep with `next` and carries `@next/eslint-plugin-next` with it; a
  mismatched pair is what produced this bug. The registry has stable 16.x up to
  `16.3.4`, matching the installed `next@16.3.4`.

- **Fix violations rather than baselining them.** The signals say the backlog is
  probably modest: `tsc --noEmit` is clean, there are zero explicit `: any`
  annotations, one `<img `, and one raw `<a href="/`. Nine `eslint-disable`
  comments already exist naming the three rules the authors expected to fire
  (`@next/next/no-img-element` ×4, `react-hooks/exhaustive-deps` ×4,
  `@typescript-eslint/no-explicit-any` ×1). If the real count contradicts that
  estimate, see the escape hatch in Implementation step 3.

- **The nine existing disable comments are unverified.** They were written for a
  linter that has never run, so some may suppress nothing at all. Run with
  `--report-unused-disable-directives` and delete the ones that turn out to be
  decorative — a disable comment that suppresses nothing is a false claim about
  the code.

- **Gate in CI on pull requests, not only on `main`.** A lint that runs only
  after merge reports history. The existing `.github/workflows/deploy-production.yml` triggers on
  push to `main`, which is the wrong moment and the wrong job to bolt this onto,
  so this adds a separate workflow.

- **`next lint` is not an option.** Next 16 removed the command entirely
  (`version-16.md`: "The `next lint` command has been removed. Use Biome or
  ESLint directly. `next build` no longer runs linting."). The bare `eslint`
  script in `package.json` is already correct.

## Implementation

### 1. Bump `eslint-config-next` to match `next`

**File**: `package.json`

In `devDependencies`, change `"eslint-config-next": "^15.3.3"` to
`"eslint-config-next": "^16.3.4"`. Run `npm install` so `package-lock.json`
records it. Leave the `"lint": "eslint"` script as it is — it is the form Next 16
documents.

Confirm afterwards that `npx eslint --version` and a bare `npm run lint` get past
config resolution; the failure this plan fixes happens before any file is read,
so "it printed violations" is already the success signal for this step.

### 2. Verify the flat config against the shipped 16 docs

**File**: `eslint.config.mjs`

Expected to need no edit. Diff it against the setup block in
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md` and
change it only if 16.3.4 disagrees with the documented shape. If `typescript`
turns out to be folded into `core-web-vitals` in 16, drop the now-redundant
second import rather than keeping a duplicate rule set.

### 3. Clear the backlog

**Files**: the violations reported across `app/`, `mcp/`, and `scripts/`

Capture the first real run's output before changing anything — it is the only
measurement of the backlog that exists, and step 4's gate is meaningless until it
is zero. Then:

- Fix genuine violations. Prefer the real fix over a suppression; `next/image`
  for the one `<img `, `next/link` for the one raw internal `<a href="/">`.
- Run once with `--report-unused-disable-directives` and delete every
  `eslint-disable` comment that suppresses nothing.
- For `react-hooks/exhaustive-deps` (30 `useEffect` call sites, 4 already
  suppressed), do not add dependencies mechanically — a wrong dependency array
  changes runtime behavior. Where a suppression is genuinely correct, keep it and
  give it a one-line reason.

**Escape hatch — report, do not improvise.** If the count is large enough that
fixing it all would swamp this change (say, past ~50 violations or touching more
than ~25 files), stop and report the number and the rule breakdown rather than
either grinding through it or silently downgrading rules to warnings. Splitting
the cleanup into its own plan is a decision for the user, and it needs the real
count to be made. Note that step 4's CI job cannot land until the tree is clean,
so a split means this plan lands without its gate.

### 4. Gate lint in CI

**New file**: `.github/workflows/lint.yml`

A workflow that runs on `pull_request` and on `push` to `main`, mirroring the
conventions already in `.github/workflows/deploy-production.yml`:
the `checkout` and `setup-node` actions at v4 with `node-version: 24` and
`cache: npm`, `npm ci`, then `npm run lint`.

Two details specific to this repo:

- `permissions: contents: read`, as the existing workflow declares.
- `npm ci` triggers `postinstall`, and `scripts/postinstall.mjs` already skips
  the Playwright browser download when `CI` is set — so no extra guard is needed,
  and the lint job will not pull a ~150MB browser.

Do not add the job to the deploy workflow: that workflow is
`push`-to-`main`-only and gated on the `production` environment, so a lint step
there would never see a pull request.

### 5. Declare lint to codeyam (optional, if free)

**File**: `.codeyam/stack.json`

The `commands` block declares `dev`, `test`, `setup`, `dbPush`, and
`seedAdapter`, but no lint. If the editor supports a lint command there, add it
so the codeyam loop runs the same check as CI. Skip this if no such key is
supported — the CI job in step 4 is the load-bearing gate, and an invented key
in `stack.json` would be worse than the omission.

## Reused existing code

- `.github/workflows/deploy-production.yml` — the CI conventions the new workflow
  copies: the `checkout` and `setup-node` actions at v4 (`node-version: 24`,
  `cache: npm`), `npm ci`, and the `permissions: contents: read` declaration.
- `scripts/postinstall.mjs` — `shouldSkipBrowserInstall` already returns `'CI'`
  when `CI` is set, so the new lint job inherits the Playwright skip for free and
  needs no workaround.
- `eslint.config.mjs` — kept as-is; it is already the Next 16 documented shape.

**Existing-implementation survey.** There is no lint gate anywhere in this
project today, and nothing to duplicate: `.github/workflows/` contains only
the deploy workflow, which has no lint step; `.codeyam/stack.json`'s
`commands` block declares no lint entry; and `.codeyam/glossary-index.txt`
returns zero matches for "lint", so no registered helper covers this area. The
CI job and the config test below are both genuinely new surface.

## Reproduction Test

Pins the actual defect: the project's own ESLint flat config cannot be loaded at
all, because the pinned `eslint-config-next` does not expose the subpaths it
imports.

**Target**: `eslint.config.test.mjs` (new) — run with
`codeyam-editor editor refresh-tests --test eslint_config_loads`.

```js
// eslint.config.mjs loads and produces a non-empty flat config
it('eslint_config_loads', async () => {
  const { default: config } = await import('./eslint.config.mjs');

  expect(Array.isArray(config)).toBe(true);
  expect(config.length).toBeGreaterThan(0);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: the dynamic
`import()` rejects with `ERR_MODULE_NOT_FOUND`, `Cannot find module
'/workspace/node_modules/eslint-config-next/core-web-vitals' imported from
/workspace/eslint.config.mjs`, so the test errors before reaching the first
assertion. After the bump it resolves and both assertions pass.

This test is worth keeping permanently rather than deleting after the fix: it is
the check that would have caught the mismatch in commit `9aafd7c`, it runs in
milliseconds, and it fails on exactly the drift that CI's `npm run lint` would
otherwise have to discover the slow way.

## Scenarios to Demonstrate

This is build tooling — it renders nothing, so the demonstrations are command
outcomes rather than app states:

- `npm run lint` completes and reports violations instead of dying at config
  resolution (the before/after that defines the fix).
- `npm run lint` exits `0` on a clean tree, once step 3 lands.
- The new `eslint.config.test.mjs` goes red before the bump and green after.
- A pull request with a deliberate violation (an unescaped `<img `) fails the new
  CI job — the gate proving itself, not just existing.
- `npx vitest run` stays green: 1116 tests, unaffected by any of this.
---

## Measured backlog (recorded 2026-09-03, during the open-source release pass)

Steps 1 and 2 are **done**: `eslint-config-next` is bumped to `^16` (16.3.4
installed, matching `next`), and `eslint.config.mjs` needed no structural change,
exactly as this plan predicted. `npm run lint` now gets past config resolution and
reads source for the first time in the project's life.

The first real run reported **93 problems (44 errors, 49 warnings)**. Two of those
groups were noise rather than backlog and have been cleared:

- **22 `@typescript-eslint/no-require-imports`, all inside `.codeyam/`** — capture
  and scenario scripts generated by codeyam-editor, CommonJS by design and
  rewritten by the tool. `.codeyam/**` was added to `globalIgnores` alongside
  `.next/**`. Linting machine-generated files reports errors nobody can act on.
- **49 `@typescript-eslint/no-unused-vars`, every one an `_`-prefixed parameter or
  destructure** — the codebase's existing way of saying "deliberately unread".
  The rule is now configured with `argsIgnorePattern: "^_"` (and the var / caught-error
  / destructured-array equivalents), which is the convention the code already follows.

That left **19 real errors**, and step 3's own escape hatch does not trip: 19
violations across 10 files is well under the "~50 violations or ~25 files" line, so
this stays one plan.

**Five were cleared, and NOT the way this plan expected.** Step 3 anticipated
`next/link` for "the one raw internal `<a href="/">`". There are five, and
converting them is wrong: `app/not-found.tsx:21-23` already documents why —
*"the preview proxy serves the app under a path prefix and rewrites `href` in the
server HTML, so a `next/link` here hydrates against a different href and warns on
every capture."* There are zero `next/link` imports anywhere in `app/`; every
internal link is a plain `<a>` with `suppressHydrationWarning`. The rule only flags
page-root links, so converting them would also split the pattern — `SavedMapRow`'s
`/map/${id}` stays an `<a>` either way. All five now carry an
`eslint-disable-next-line @next/next/no-html-link-for-pages` with that reason
inline. **Do not "finish the job" by converting these later.**

### What is left: 17 errors, all React Compiler rules

`eslint-config-next@16` pulls in `eslint-plugin-react-hooks` v6, whose React
Compiler rules are new and were not in this plan's estimate (which expected
`exhaustive-deps` and `no-img-element` — neither fires).

| Rule | Count | Sites |
|---|---|---|
| `react-hooks/set-state-in-effect` | 9 | `AgentHandoff.tsx:54`, `NodeQuestionComposer.tsx:82`, `QuestionCard.tsx:70`, `RoundControl.tsx:59`, `WebMcpBridge.tsx:211`, `useBoundedWait.ts:27`, `useFilePreviews.ts:54`, `useDelayedAdvance.ts:26`, `useDismissedOnce.ts:32` |
| `react-hooks/refs` | 7 | `RowThreads.tsx:57`, `useFilePreviews.ts:47`, `FetchFailureFixture.tsx:41` (×4), plus one more surfaced by `feat: One Bar Over the Map` |
| `react-hooks/immutability` | 1 | `FetchFailureFixture.tsx:44` |

**The count grows while this plan sits unbuilt.** It was 14 when first measured
against `b9fead8`; merging `c3e01ac` (`feat: One Bar Over the Map`) added three
more, in two hook files that did not exist before (`useDelayedAdvance.ts`,
`useDismissedOnce.ts`). Nothing gates lint, so every branch that lands is free to
add violations — which is the argument for step 4 rather than a reason to defer
it. Re-measure before starting; do not trust this table's total.

Three notes for whoever takes this:

- **`FetchFailureFixture.tsx` accounts for 5 of them** and is a deliberate test
  fixture that monkey-patches `window.fetch` during render. The rules are correctly
  describing what it does; the question is whether the fixture should be restructured
  or whether a file-scoped disable with a reason is the honest answer. Decide that
  before touching the rest.
- **These are refactors of working, fully-tested code** — the suite is ~1240 tests
  across 106 files. Re-run it after every site. Do not add dependencies or move
  `setState` calls mechanically; `set-state-in-effect` fires on patterns that are
  sometimes genuinely correct, and a wrong fix changes runtime behavior silently.
- **`scripts/ensureDevDatabase.integration.test.ts` fails on macOS/arm64** for an
  unrelated reason — `@embedded-postgres/darwin-arm64` ships without the
  `libicudata.68.dylib` symlink the loader wants, so `initdb` dies with a dyld
  error. It is not caused by this work and does not reproduce where
  `TEST_DATABASE_URL` is set. Do not chase it as a lint regression.

Step 4's CI gate therefore **still cannot land as `npm run lint` at full strength**.
The open-source pass added `.github/workflows/ci.yml` running `tsc`, `vitest`, and
`next build` on pull requests; adding the `lint` job to that existing workflow is the
last thing this plan does, once these are cleared.
