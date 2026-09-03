// Database connection singleton.
// All application code imports from here — API routes, server components, etc.
//
// Usage:
//   import { prisma } from "@/app/lib/prisma";
//   const items = await prisma.yourModel.findMany();
//
// This and prisma/seed.ts are the only two files that name the database
// driver; both must use the same adapter. See DATABASE.md for the
// connection strings a deployment needs.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseConnection } from './databaseUrl';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Read at module load, deliberately: every test that points at a throwaway
// database sets DATABASE_URL and then imports this module dynamically, and a
// later assignment would be ignored. `databaseConnection` throws rather than
// falling back — see the note in that file for why there is no default, and
// why the schema has to be passed separately from the connection string.
const { connectionString, schema } = databaseConnection();

const adapter = new PrismaPg(
  { connectionString },
  schema ? { schema } : undefined,
);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
