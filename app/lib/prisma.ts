// Database connection singleton.
// This is the ONLY file that changes when upgrading to a hosted database.
// All application code imports from here — API routes, server components, etc.
//
// Usage:
//   import { prisma } from "@/app/lib/prisma";
//   const items = await prisma.yourModel.findMany();
//
// To upgrade to a hosted database (e.g., Supabase PostgreSQL), see DATABASE.md.

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
