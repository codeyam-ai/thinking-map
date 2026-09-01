/**
 * CodeYam Seed Adapter for Prisma + SQLite.
 *
 * Reads a JSON seed data file (path passed as CLI arg), wipes all tables,
 * then inserts the seed data using Prisma in topological FK order.
 *
 * Usage: npx tsx .codeyam/seed-adapter.ts <path-to-seed-data.json>
 *
 * Canonical wire shape (`SeedInput` in `crates/types/src/seed_input.rs`):
 * {
 *   "seed": { "tableName": [{ "column": "value", ... }, ...] }
 * }
 *
 * The legacy flat shape (`{ "tableName": [...] }`) is also accepted for
 * backwards compatibility with hand-written adapters; the editor always
 * emits the canonical wrapped shape.
 *
 * Per-table insert success emits a structured stderr log line:
 *   [codeyam-seed] inserted <N> rows into <table>
 *
 * The editor parses these to build the row-count summary the user sees
 * in the seed banner — the format is strict by contract so drift is a
 * hard failure rather than a soft one.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// codeyam-adapter-version: 9

/**
 * Load `.env*` files into `process.env` in canonical precedence order,
 * matching Next.js conventions:
 *
 *   .env.local > .env.development.local > .env.development > .env
 *
 * Later wins. Files that don't exist are silently skipped.
 * `process.env` keys that are already set are NEVER overwritten — manually-
 * set env vars (CI, shell, the editor's `PORT` injection) always win.
 *
 * Roots searched (in order, deduped):
 *   1. `cwd` argument (defaults to `process.cwd()`)
 *   2. The adapter script's parent directory (`<project>/` when the
 *      adapter is deployed at `.codeyam/seed-adapter.ts`)
 *   3. The adapter script's directory itself (`.codeyam/`)
 *
 * The multi-root search exists because `npx tsx` can be spawned with a
 * cwd that isn't the project root (e.g. from `register-scenario` or
 * editor probes), in which case the bare `process.cwd()` lookup would
 * miss the project's `.env*` files entirely.
 *
 * Inlined per adapter rather than imported from a shared module because
 * adapters are copied verbatim into `.codeyam/seed-adapter.ts` and run
 * standalone.
 */
export function loadDotEnvFiles(cwd: string = process.cwd()): void {
  const preExisting = new Set(Object.keys(process.env));
  const filesInOrder = [
    '.env',
    '.env.development',
    '.env.development.local',
    '.env.local',
  ];

  let scriptDir: string | null = null;
  try {
    scriptDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // import.meta.url unavailable (e.g. CommonJS test harness) — fall
    // back to the explicit cwd as the only root.
  }
  const roots = Array.from(
    new Set(
      [cwd, scriptDir ? path.resolve(scriptDir, '..') : null, scriptDir].filter(
        (r): r is string => typeof r === 'string' && r.length > 0,
      ),
    ),
  );

  const seenFiles = new Set<string>();
  for (const name of filesInOrder) {
    for (const root of roots) {
      const filePath = path.join(root, name);
      if (seenFiles.has(filePath)) continue;
      seenFiles.add(filePath);
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!preExisting.has(key)) {
          process.env[key] = value;
        }
      }
    }
  }
}

/**
 * Minimal structural types for the Prisma DMMF subset this adapter touches.
 * Defined locally so the module is importable in environments where
 * @prisma/client isn't installed.
 */
export interface PrismaField {
  name: string;
  kind: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}
export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

/**
 * Lowercase a model's leading character to produce the table-key form
 * the seed JSON uses (`User` → `user`, `BlogPost` → `blogPost`).
 */
function lowerFirst(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * True when `model` is the side of the relation that physically holds
 * the foreign-key column — the side whose rows must be inserted last.
 *
 * Prisma <=6 answers this directly: `relationFromFields` lists the owned
 * FK columns on the owning side and is an empty array on the
 * back-reference. Prisma 7's DMMF stopped populating it on datamodel
 * object fields (it arrives `undefined`), which silently collapsed every
 * edge and left insert order to fall back to alphabetical seed-key order.
 *
 * When it is absent, fall back to Prisma's FK naming convention and look
 * for the owning scalar column on this model (`user` → `userId`, or
 * `<RelatedModel>Id`). A to-many side never holds the column, so it can
 * never be the owner.
 */
function ownsForeignKey(model: PrismaModel, field: PrismaField): boolean {
  if (Array.isArray(field.relationFromFields)) {
    return field.relationFromFields.length > 0;
  }
  if (field.isList === true) return false;
  const scalarNames = new Set(
    model.fields.filter((f) => f.kind === 'scalar').map((f) => f.name),
  );
  return [`${field.name}Id`, `${lowerFirst(String(field.type))}Id`].some((c) =>
    scalarNames.has(c),
  );
}

/**
 * Walk the Prisma DMMF to discover foreign-key edges: child-table →
 * parent-table relationships, expressed in the lowercased model name
 * form the seed data uses as keys. Self-references are ignored — a
 * row referencing its own table cannot dictate insert ordering.
 *
 * The DMMF schema is the canonical FK source for Prisma; querying
 * SQLite's `PRAGMA foreign_key_list` instead would work but would
 * lose the model-name → table-name mapping the seed uses.
 */
export function getPrismaFkEdges(
  models: PrismaModel[],
): Array<{ child: string; parent: string }> {
  const edges: Array<{ child: string; parent: string }> = [];
  for (const model of models) {
    const child = lowerFirst(model.name);
    for (const field of model.fields) {
      if (field.kind !== 'object') continue;
      // Only the FK-owning side produces an edge; the back-reference
      // would invert the dependency.
      if (!ownsForeignKey(model, field)) continue;
      const parent = lowerFirst(String(field.type));
      if (parent === child) continue;
      edges.push({ child, parent });
    }
  }
  return edges;
}

/**
 * Warn when the seed spans related tables yet no FK edges could be
 * derived — insert order has fallen back to the seed's input order,
 * which is alphabetical (the editor serializes seed keys through a
 * BTreeMap) and therefore not FK-safe.
 *
 * Without this the failure mode is silent: a child row inserted before
 * its parent aborts the transaction and the run reports success against
 * an empty database. Returns whether a warning was emitted.
 */
export function warnIfFkGraphUnderivable(
  seededTables: string[],
  models: PrismaModel[],
  fkEdges: Array<{ child: string; parent: string }>,
): boolean {
  if (fkEdges.length > 0) return false;
  if (seededTables.length < 2) return false;
  const seeded = new Set(seededTables);
  const related = models.filter(
    (m) =>
      seeded.has(lowerFirst(m.name)) &&
      m.fields.some((f) => f.kind === 'object'),
  );
  if (related.length === 0) return false;
  console.error(
    `[codeyam-seed] WARNING: seeded tables ${related
      .map((m) => lowerFirst(m.name))
      .join(', ')} declare relations, but no foreign-key edges could be ` +
      `derived from the Prisma DMMF. Insert order is falling back to input ` +
      `order (${seededTables.join(', ')}), which is NOT FK-safe — a child ` +
      `row inserted before its parent will violate the constraint. Check ` +
      `that this Prisma version's DMMF exposes either relationFromFields or ` +
      `conventional <relation>Id scalar columns.`,
  );
  return true;
}

/**
 * Order tables so every table is inserted AFTER all of its parents
 * (tables it has FK references to). Tables not in `tablesInSeed` are
 * not part of the graph; FK edges that reference them are dropped.
 *
 * On a cycle (every remaining node still has unresolved parents), the
 * remaining nodes are emitted in input order and a warning is logged
 * to stderr so the operator knows the FK constraints will be enforced
 * differently. Cycles in real schemas are typically nullable —
 * inserting in input order succeeds when the FK is nullable.
 */
export function topoSortTables(
  tablesInSeed: string[],
  fkEdges: Array<{ child: string; parent: string }>,
): string[] {
  const tableSet = new Set(tablesInSeed);
  const deps = new Map<string, Set<string>>();
  for (const t of tablesInSeed) deps.set(t, new Set());
  for (const { child, parent } of fkEdges) {
    if (!tableSet.has(child) || !tableSet.has(parent)) continue;
    if (child === parent) continue;
    deps.get(child)!.add(parent);
  }

  const result: string[] = [];
  const remaining = new Set(tablesInSeed);
  while (remaining.size > 0) {
    const ready = new Set<string>();
    for (const t of remaining) {
      const parents = [...deps.get(t)!].filter((p) => remaining.has(p));
      if (parents.length === 0) ready.add(t);
    }
    if (ready.size === 0) {
      console.error(
        `[codeyam-seed] FK cycle detected; falling back to input order for remaining tables: ${[
          ...remaining,
        ].join(', ')}`,
      );
      for (const t of tablesInSeed) {
        if (remaining.has(t)) {
          result.push(t);
          remaining.delete(t);
        }
      }
      break;
    }
    for (const t of tablesInSeed) {
      if (ready.has(t)) {
        result.push(t);
        remaining.delete(t);
      }
    }
  }
  return result;
}

/**
 * Lazy-load @prisma/client + the better-sqlite3 adapter and return a
 * connected PrismaClient. Deferred so importing this module from a test
 * file does not require those packages to be installed.
 */
async function openPrisma(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  models: PrismaModel[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaMod: any = await import('@prisma/client');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapterMod: any = await import('@prisma/adapter-better-sqlite3');
  const { PrismaClient, Prisma } = prismaMod;
  const PrismaBetterSqlite3 =
    adapterMod.PrismaBetterSqlite3 || adapterMod.default;
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  const prisma = new PrismaClient({ adapter });
  return { prisma, models: Prisma.dmmf.datamodel.models };
}

/**
 * Adapter entry point: load env files, parse the seed JSON, and use
 * Prisma to wipe and re-seed the SQLite database in topological FK
 * order.
 */
export async function main() {
  loadDotEnvFiles();
  const seedDataPath = process.argv[2];
  if (!seedDataPath) {
    console.error('Usage: npx tsx .codeyam/seed-adapter.ts <seed-data.json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(seedDataPath, 'utf-8');
  const data = JSON.parse(raw);
  // Canonical envelope unwrap: tables live under `seed` in the wrapped
  // shape; fall through to the flat shape for hand-written adapters
  // out in the world.
  const seed: Record<string, unknown[]> =
    data && typeof data === 'object' && data.seed && typeof data.seed === 'object'
      ? data.seed
      : data;

  const expectedTables = Object.keys(seed).filter(
    (k) => Array.isArray(seed[k]) && seed[k].length > 0,
  );
  const expectedRows = expectedTables.reduce(
    (sum, t) => sum + (seed[t] as unknown[]).length,
    0,
  );
  let actualRows = 0;

  const { prisma, models } = await openPrisma();

  // Discover ALL models from the Prisma schema — not just the tables in the seed data.
  // This ensures FK-dependent tables (e.g., Passenger → Flight) are cleared even when
  // the seed only contains the parent table's data.
  const allModels = models.map((m) => lowerFirst(m.name));

  const fkEdges = getPrismaFkEdges(models);
  const insertOrder = topoSortTables(Object.keys(seed), fkEdges);
  warnIfFkGraphUnderivable(Object.keys(seed), models, fkEdges);

  try {
    // Run everything in a single transaction for atomicity and speed.
    // SQLite auto-commits each statement by default — wrapping in a transaction
    // avoids per-statement fsync and is significantly faster for bulk operations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // Disable foreign key checks during wipe+insert — allows deleting in any
      // order and avoids FK constraint errors during the brief window between
      // clearing parent and child tables.
      await tx.$executeRawUnsafe('PRAGMA foreign_keys = OFF');

      // Wipe ALL tables in the schema (not just seeded ones)
      for (const table of [...allModels].reverse()) {
        try {
          await tx[table].deleteMany();
        } catch {
          // Table may not exist in current schema — skip
        }
      }

      // Batch-reset auto-increment counters for ALL tables.
      // Without this, SQLite IDs keep climbing across scenario switches,
      // causing hardcoded URLs like /drinks/1 to 404.
      const seqNames = allModels
        .flatMap((t) => [`'${t}'`, `'${t.charAt(0).toUpperCase() + t.slice(1)}'`])
        .join(', ');
      try {
        await tx.$executeRawUnsafe(
          `DELETE FROM sqlite_sequence WHERE name IN (${seqNames})`,
        );
      } catch {
        // sqlite_sequence may not exist — safe to ignore
      }

      // Insert seed data in topological FK order
      // Stack assumption: this SQLite adapter inserts through Prisma's
      // `createMany`, which serializes Json fields itself. The Postgres
      // JSON-column 22P02 bug fixed in prisma-postgres.ts (raw `pg` encoding
      // a JS array as a Postgres array literal) cannot occur here, so no
      // explicit JSON.stringify pass is needed.
      for (const table of insertOrder) {
        const rows = seed[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        try {
          await tx[table].createMany({ data: rows });
          actualRows += rows.length;
          console.error(
            `[codeyam-seed] inserted ${rows.length} rows into ${table}`,
          );
        } catch (err) {
          console.error(
            `  Failed to seed ${table}: ${err instanceof Error ? err.message : err}`,
          );
          process.exit(1);
        }
      }

      // Re-enable foreign key checks
      await tx.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    });

    if (expectedRows > 0 && actualRows === 0) {
      console.error(
        `[codeyam-seed] FATAL: input declared ${expectedTables.length} tables ` +
          `with ${expectedRows} total rows, but adapter inserted 0. ` +
          `Likely a contract mismatch. Inspect the snapshot at ` +
          `.codeyam/tmp/seed-input-snapshot-*.json to see what the editor sent.`,
      );
      process.exit(1);
    }

    console.log('Seed complete');
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Export mode: dump current database state to a JSON file.
 * Used by CodeYam to save interactive changes back to scenario seed data.
 *
 * Usage: npx tsx .codeyam/seed-adapter.ts --export <output-path.json>
 *
 * Accepts an optional `prismaFactory` so tests can inject a fake Prisma
 * client + models pair instead of importing `@prisma/client` and
 * `@prisma/adapter-better-sqlite3` — see `seed-adapters/test-helpers.ts`
 * for the shared fakes.
 */
export async function exportData(
  outputPath: string,
  prismaFactory: () => Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any;
    models: PrismaModel[];
  }> = openPrisma,
) {
  loadDotEnvFiles();
  const { prisma, models } = await prismaFactory();
  const modelNames = models.map((m) => m.name);

  try {
    const seed: Record<string, unknown[]> = {};
    for (const model of modelNames) {
      const camelCase = lowerFirst(model);
      try {
        const rows = await prisma[camelCase].findMany();
        if (rows.length > 0) {
          seed[camelCase] = rows;
        }
      } catch {
        // Skip tables that can't be queried
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(seed, null, 2));
    console.log(`Exported ${Object.keys(seed).length} tables`);
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  /seed-adapter\.(ts|js|cjs|mjs)$/.test(process.argv[1]);

if (invokedDirectly) {
  if (process.argv[2] === '--export') {
    exportData(process.argv[3]).catch((e) => {
      console.error('Seed adapter export error:', e);
      process.exit(1);
    });
  } else {
    main().catch((e) => {
      console.error('Seed adapter error:', e);
      process.exit(1);
    });
  }
}
