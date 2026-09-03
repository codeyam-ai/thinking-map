import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

describe('eslint config', () => {
  // The flat config loads at all and yields a non-empty rule set. This project's
  // ESLint config was unrunnable from its first commit: `next` and
  // `eslint-config-next` were pinned to different majors in the same commit, and
  // the 15.x package ships no `exports` map, so Node's ESM resolver refused the
  // extensionless `eslint-config-next/core-web-vitals` subpath that
  // `eslint.config.mjs` imports. Every `npm run lint` died with
  // ERR_MODULE_NOT_FOUND before reading a single source file — which is why the
  // backlog went unnoticed for the life of the project.
  //
  // The check is deliberately about LOADING, not about any particular rule: the
  // failure mode is total, and a config that resolves at all is the whole fix.
  // It is kept permanently rather than deleted after the bump, because it is the
  // check that would have caught the mismatch at commit `9aafd7c`, it runs in
  // milliseconds, and it fails on exactly the drift that CI's `npm run lint`
  // would otherwise have to discover the slow way.
  it('eslint_config_loads', async () => {
    const { default: config } = await import('./eslint.config.mjs');

    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
  });

  // `.codeyam/` holds editor-generated tooling — every file carries a
  // "codeyam-generated — DO NOT EDIT" header and is rewritten wholesale on the
  // next codeyam-editor update, so a lint fix there cannot survive. It supplied
  // 68 of the 93 problems the first working lint run reported. Without the
  // ignore, a green tree goes red again the moment the editor regenerates.
  it('eslint_ignores_generated_codeyam_tooling', async () => {
    const eslint = new ESLint();

    expect(await eslint.isPathIgnored('.codeyam/capture.js')).toBe(true);
    // The app itself must stay linted — an over-broad ignore would be the
    // silent version of turning the linter back off.
    expect(await eslint.isPathIgnored('app/lib/mapRounds.ts')).toBe(false);
  });

  // The React Compiler rule set arrived with eslint-config-next 16 and flags 14
  // deliberate, individually-documented patterns across 9 files. Warnings, not
  // "off", is the recorded decision: new code still gets told, but CI does not
  // block on a backlog that predates the linter ever running. Pinned because
  // both directions are silent regressions — promoting them to errors breaks CI
  // on untouched code, and dropping them to "off" loses the signal entirely.
  it('eslint_keeps_react_compiler_rules_as_warnings', async () => {
    const eslint = new ESLint();
    const { rules } = await eslint.calculateConfigForFile('app/components/QuestionCard.tsx');

    // ESLint normalises severity to a number: 0 off, 1 warn, 2 error.
    expect(rules['react-hooks/set-state-in-effect']?.[0]).toBe(1);
    expect(rules['react-hooks/refs']?.[0]).toBe(1);
    expect(rules['react-hooks/immutability']?.[0]).toBe(1);
  });

  // Every internal link here is a plain `<a href="/">`, and that is forced by
  // the environment rather than chosen for convenience: the CodeYam preview
  // proxy serves the app under a path prefix and rewrites `href` in the server
  // HTML, so a `next/link` hydrates against a different href and warns on every
  // scenario capture. Each such site carries its own `eslint-disable-next-line`
  // naming that reason. This asserts the OUTCOME — the file lints clean — rather
  // than the mechanism, so it holds whether the reason lives in a per-site
  // comment or in the config, and fails if either is dropped.
  it('eslint_allows_plain_anchors_for_preview_proxy', async () => {
    const eslint = new ESLint();
    const [result] = await eslint.lintFiles(['app/not-found.tsx']);

    expect(result.errorCount).toBe(0);
  });
});
