// Loads the full dotenv cascade (`.env.local` wins over `.env`) so DB-backed
// tests resolve the same credentials the running app does. The loader sets
// `quiet: true` — a dotenv banner on stdout would corrupt `--reporter=json`.
import './app/lib/loadEnv';
import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    exclude: [...configDefaults.exclude, '.codeyam/**', 'target/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
