// Loads the full dotenv cascade (`.env.local` wins over `.env`), matching
// what Next.js and codeyam do. Plain `dotenv/config` would read `.env` only
// and miss the credentials codeyam writes. Must come before any env read.
import './app/lib/loadEnv';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
