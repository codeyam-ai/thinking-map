// Seed script for populating the database with demo data.
//
// Run `npx prisma generate` before this script if Prisma client is missing.
// `prisma db push` does NOT auto-generate the client.
//
// Run with: npx tsx prisma/seed.ts
// Or:       npm run db:seed
//
// IMPORTANT: This file must use the same adapter pattern as app/lib/prisma.ts.
// Do NOT use `new PrismaClient()` without the adapter — Prisma 7 requires it.

// Loads the full dotenv cascade (`.env.local` wins over `.env`), matching
// what Next.js and codeyam do. Plain `dotenv/config` would read `.env` only
// and miss the credentials codeyam writes. Must come before any env read.
import '../app/lib/loadEnv';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // TODO: seed your models here once you've added them to prisma/schema.prisma.
  console.log(
    'No models to seed yet — edit prisma/seed.ts after adding models to schema.prisma',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
