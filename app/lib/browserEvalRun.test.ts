import { describe, expect, it } from 'vitest';
import { browserEvalArgs, evalSchemaName } from './browserEvalRun';

// Everything else in the browser eval run needs a PostgreSQL, a dev server and
// a Chrome to say anything at all. These two functions are the parts that do
// not — and they are the two where a mistake is silent and expensive.

describe('evalSchemaName', () => {
  // A stray schema on a shared server has to be identifiable as eval debris
  // rather than someone's data. Same argument `uniqueSchemaName` makes for its
  // own prefix.
  it('prefixes the schema so eval debris is recognisable', () => {
    expect(evalSchemaName('abcd1234')).toBe('eval_standing_wait_abcd1234');
  });

  // The name is interpolated into a DROP SCHEMA statement. Hex cannot carry a
  // quote, so the identifier is safe by construction — this pins that the
  // default really is hex and not something looser.
  it('defaults to a suffix that cannot break a SQL identifier', () => {
    expect(evalSchemaName()).toMatch(/^eval_standing_wait_[0-9a-f]{8}$/);
  });

  // Two runs at once must not share a schema: the second would push into the
  // first's tables and the first's teardown would drop the second's data.
  it('does not repeat itself between runs', () => {
    expect(evalSchemaName()).not.toBe(evalSchemaName());
  });
});

describe('browserEvalArgs', () => {
  // `-u` pointing anywhere but the seeded map produces "0 tools registered on
  // page", which reads as a WebMCP fault rather than a wrong URL — so the flag
  // pairing is worth pinning even though it looks obvious.
  it('points the CLI at the target page and the suite file', () => {
    const args = browserEvalArgs('http://127.0.0.1:3000/map/abc', 'evals/suites/standing-wait.json');

    expect(args.slice(0, 2)).toEqual(['webmcp-evals', 'browser']);
    expect(args[args.indexOf('-u') + 1]).toBe('http://127.0.0.1:3000/map/abc');
    expect(args[args.indexOf('-e') + 1]).toBe('evals/suites/standing-wait.json');
  });

  // Omitting this does not fail — it silently changes which model driver runs,
  // and the run still completes with different results.
  it('selects the vercel backend by default', () => {
    const args = browserEvalArgs('http://x/map/a', 'suite.json');
    expect(args[args.indexOf('--backend') + 1]).toBe('vercel');
  });

  // Everything after `--` on the npm command line has to reach the CLI, or
  // `--model` is dropped and the run charges the wrong provider.
  it('forwards the caller arguments', () => {
    const args = browserEvalArgs('http://x/map/a', 'suite.json', [
      '--model',
      'anthropic:claude-haiku-4-5-20251001',
      '--runs',
      '3',
    ]);
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('anthropic:claude-haiku-4-5-20251001');
    expect(args[args.indexOf('--runs') + 1]).toBe('3');
  });

  // Ordering, not merely presence: commander takes the LAST occurrence of a
  // repeated option, so a caller's `--backend gemini` only wins if the
  // forwarded arguments come after the defaults.
  it('puts caller arguments last so they override the defaults', () => {
    const args = browserEvalArgs('http://x/map/a', 'suite.json', ['--backend', 'gemini']);
    expect(args.lastIndexOf('--backend')).toBeGreaterThan(args.indexOf('--backend'));
    expect(args[args.lastIndexOf('--backend') + 1]).toBe('gemini');
  });
});
