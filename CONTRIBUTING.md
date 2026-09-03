# Contributing to Thinking Map

Thanks for taking an interest. This document covers getting the project running,
the checks a change has to pass, and how the codeyam workflow this project is
built with fits in.

## Getting set up

You need **Node.js 24** (the version CI runs) and git. You do **not** need a
database, a hosting account, or an API key.

```bash
git clone https://github.com/codeyam-ai/thinking-map && cd thinking-map
npm run setup   # install dependencies, provision PostgreSQL, push the schema, seed
npm run dev     # http://localhost:3000
```

With no `DATABASE_URL` set, `setup` starts a local PostgreSQL server of its own
and writes the connection string to `.env.local`. Set `DATABASE_URL` yourself and
that database is used instead, untouched. See [`DATABASE.md`](DATABASE.md) for the
full picture, including where credentials go and how to deploy.

**Credentials never go in `.env`.** That file is committed and holds documented
placeholders only. Real connection strings and keys belong in `.env.local`, which
is gitignored and overrides every value in `.env`.

## The checks

Run these before opening a pull request. CI
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same three on
every PR, so anything that passes locally passes there.

```bash
npx prisma generate   # the Prisma client is generated, not committed — run this first
npx tsc --noEmit      # type-check; must be clean
npm test              # vitest, ~1150 tests
npm run build         # next build
```

A few things worth knowing:

- **`npx prisma generate` first, always.** The generated client is not in git. A
  type error naming a model field that plainly exists in `prisma/schema.prisma`
  almost always means the client on disk is stale.
- **The DB-backed tests provision their own PostgreSQL** and stop it afterwards
  (`app/lib/testDatabase.ts`), so `npm test` needs nothing configured. Set
  `TEST_DATABASE_URL` only to point them at a database you already have — and use
  a *direct* connection, since `db push` needs a real session.
- **`npm run lint` does not pass yet.** The ESLint config was unrunnable for most
  of this project's life; it works now, and 14 React Compiler violations remain to
  be cleared. That work is tracked in
  `.codeyam/plans/lint-runs-and-ci-keeps-it-running.md`, and lint is deliberately
  not a CI gate until it is clean. Please don't add new violations, and don't
  silence the rules wholesale.

## Testing conventions

- **Every `it()` block has a `//` comment directly above it** explaining what the
  test verifies and why it matters — not a restatement of the title. These
  descriptions are read by tooling and shown in the codeyam UI.
- **Test behavior, not implementation.** Assert on output and observable effects
  so tests survive refactors.
- **Tests must not depend on what is running on your machine.** No fixed shared
  ports, no assumptions about a neighbouring dev server.

## Pull requests

1. Branch off `main`.
2. Keep the change focused — one concern per PR.
3. Make sure the four checks above pass.
4. Fill in the pull request template. It asks what changed and how you verified
   it; both are genuinely read.
5. Explain *why* in the description. What the diff does is visible; what problem
   it solves is not.

Commit messages are for a technical audience: concise, information-dense, focused
on what changed and why.

## Working with codeyam-editor

This project is built with [codeyam-editor](https://codeyam.com) — code and
runnable data scenarios are authored side by side against a live preview. You do
**not** need it to contribute; the npm commands above are the whole story.

If you do use it, note that `.codeyam/` holds generated capture and scenario
scripts. They are rewritten by the tool, are excluded from linting, and are not
somewhere to make changes by hand.

Two quirks that look like bugs and are not:

- `package.json` runs `next dev --webpack`. Next 16 defaults to Turbopack, and
  Turbopack's dev output does not hydrate through the codeyam preview proxy. This
  is deliberate.
- A plain `npm run dev` does not serve `/isolated-components/*`, the fixture pages
  scenario captures render from — they would fill a dev session with convincing
  fake maps. Use `CODEYAM_APP_PORT=1 npm run dev` if you want them.
- Internal links are plain `<a>` elements with `suppressHydrationWarning`, not
  `next/link`. The preview proxy serves the app under a path prefix and rewrites
  `href` in the server HTML, so `next/link` would hydrate against a different href
  on every capture. Please keep that pattern.

## Before you build a feature

If your change touches auth, file uploads, email, or another external service,
read [`FEATURE_PATTERNS.md`](FEATURE_PATTERNS.md) first — it records decisions
already made so you don't have to relitigate them.

If your change touches how an agent attaches to a map, read
[`AGENT_CONTRACT.md`](AGENT_CONTRACT.md).

## Reporting bugs and asking for features

Open an issue using one of the templates. A bug report that includes what you
expected, what happened, and how to reproduce it is worth ten that don't.

## Code of Conduct

This project ships a [Code of Conduct](CODE_OF_CONDUCT.md). By participating you
agree to uphold it.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE) that covers this project.
