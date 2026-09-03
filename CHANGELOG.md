# Changelog

Notable changes to Thinking Map. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project has not
yet cut a tagged release — everything below is on `main`.

## [Unreleased]

### Added

- Continuous integration on pull requests: type-check, the full test suite, and a
  production build (`.github/workflows/ci.yml`).
- Open-source project documents: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, issue templates, and a pull request template.

### Fixed

- `npm run lint` now runs at all. `eslint.config.mjs` was written for
  `eslint-config-next` v16 while the dependency was pinned to `^15.3.3`, so ESLint
  died at config resolution before reading a single file — it had never worked.
  Generated `.codeyam/` scripts are excluded from linting, and the `_`-prefixed
  unused-parameter convention the codebase already follows is now configured
  rather than reported.

[Unreleased]: https://github.com/codeyam-ai/thinking-map/commits/main
