// Loads the full dotenv cascade (`.env.local` wins over `.env`) so DB-backed
// tests resolve the same credentials the running app does. The loader sets
// `quiet: true` — a dotenv banner on stdout would corrupt `--reporter=json`.
import './app/lib/loadEnv';
import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Node by default — most of this suite is pure logic or talks to SQLite,
    // and a DOM for those would be dead weight. A rendering test opts in with
    // a `// @vitest-environment jsdom` docblock, so it gets a real DOM without
    // changing how anything else runs.
    exclude: [...configDefaults.exclude, '.codeyam/**', 'target/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
