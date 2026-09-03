// Installs the Playwright browser used by codeyam's scenario capture — but only
// where something will actually use it.
//
// This used to be an unconditional `playwright install chromium` in the
// `postinstall` script. On Vercel that downloaded a ~150MB browser on every
// production build to serve a devDependency the deployed app never loads:
// nothing in `app/` or `mcp/` imports playwright, and captures run on the
// developer's machine and in codeyam's own tooling, never in the deployed
// function.
//
// So: skip it on Vercel and on CI generally, and keep the local behaviour
// exactly as it was. A developer cloning the repo still gets a browser without
// having to know it was needed.
//
// Written as a script file rather than shell in package.json on purpose —
// the equivalent one-liner needs `||` exit-code trickery that reads as a bug,
// and would not work on Windows.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Whether to skip the browser download, and why.
 *
 * Returns the name of the variable that caused the skip, or `null` to install.
 * Separated from the install below because this decision is the entire point of
 * the script — and the only part that can be checked without actually running an
 * install.
 *
 * `VERCEL` is checked before `CI` so the reported reason is the specific one on
 * Vercel, where both are set.
 */
export function shouldSkipBrowserInstall(env = process.env) {
  if (env.VERCEL) return 'VERCEL';
  if (env.CI) return 'CI';
  return null;
}

function main() {
  const reason = shouldSkipBrowserInstall();

  if (reason) {
    console.log(
      `postinstall: skipping "playwright install chromium" (${reason} is set) — ` +
        'the deployed app never loads playwright.',
    );
    return;
  }

  const result = spawnSync('playwright', ['install', 'chromium'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  // Don't fail the whole install if the browser download fails. It is needed for
  // scenario capture, not for building or running the app, and a developer on a
  // flaky network should still end up with working `node_modules`.
  if (result.status !== 0) {
    console.warn(
      'postinstall: "playwright install chromium" did not succeed. Scenario ' +
        'capture will not work until you run it manually; everything else will.',
    );
  }
}

// Only install when run as a script. Without this guard, importing the module
// to test the predicate above would download a browser as a side effect — which
// is the exact behaviour this file exists to stop doing unnecessarily.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
