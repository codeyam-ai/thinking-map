/**
 * CodeYam Seed Adapter for Prisma + PostgreSQL.
 *
 * Reads a JSON seed data file (path passed as CLI arg), wipes all tables
 * using TRUNCATE CASCADE, then inserts the seed data via direct pg client.
 *
 * Usage: npx tsx .codeyam/seed-adapter.ts <path-to-seed-data.json>
 *
 * The JSON file has the format:
 * {
 *   "type": "application",
 *   "seed": {
 *     "tableName": [{ "column": "value", ... }, ...]
 *   },
 *   "externalApis": { ... }  // optional, not used by this adapter
 * }
 *
 * Requirements:
 * - DATABASE_URL env var with a PostgreSQL connection string
 * - @prisma/client installed (for schema introspection via DMMF)
 * - pg installed (for direct database access)
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

// codeyam-adapter-version: 9

/**
 * The directory this adapter file itself lives in, or `null` when
 * `import.meta.url` is unavailable (a CJS transpile, an inlined eval).
 */
export function currentScriptDir(): string | null {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

/**
 * The ordered, de-duplicated set of directories to search for
 * project-root-relative files. `npx tsx` can be spawned with a cwd that is
 * not the project root, so the adapter also looks beside itself
 * (`.codeyam/`) and one level up (the project root when installed as
 * `.codeyam/seed-adapter.ts`).
 */
export function searchRoots(cwd: string, scriptDir: string | null): string[] {
  return Array.from(
    new Set(
      [cwd, scriptDir ? path.resolve(scriptDir, '..') : null, scriptDir].filter(
        (r): r is string => typeof r === 'string' && r.length > 0,
      ),
    ),
  );
}

/**
 * Load `.env*` files into `process.env` in canonical precedence order.
 * See prisma-sqlite.ts for the full multi-root rationale; the loader is
 * inlined per adapter so each shipped file is standalone.
 */
export function loadDotEnvFiles(cwd: string = process.cwd()): void {
  const preExisting = new Set(Object.keys(process.env));
  const filesInOrder = [
    '.env',
    '.env.development',
    '.env.development.local',
    '.env.local',
  ];

  const roots = searchRoots(cwd, currentScriptDir());

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

// Minimal structural types for the Prisma DMMF subset this adapter touches.
// Defined locally so the module is importable in environments where
// @prisma/client isn't installed (the seed-adapters/ files ship as standalone
// copies into user projects).
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

export interface QueryClient {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * Build a mapping from lowercased seed-data keys to actual PostgreSQL table names.
 * Prisma creates tables with the model name (PascalCase) unless @@map is used.
 *
 * Accepts the models array as an argument so this helper is testable without
 * loading @prisma/client.
 */
export function buildTableNameMap(
  models: PrismaModel[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const model of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbName = (model as any).dbName || model.name;
    const lowered = lowerFirst(model.name);
    map[lowered] = dbName;
    map[model.name] = dbName;
  }
  return map;
}

/**
 * Build column name mapping from Prisma field names to database column names.
 *
 * Accepts the models array as an argument so this helper is testable without
 * loading @prisma/client.
 */
export function buildColumnMap(
  models: PrismaModel[],
  tableName: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const model of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbName = (model as any).dbName || model.name;
    if (dbName !== tableName) continue;
    for (const field of model.fields) {
      if (field.kind === 'object') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const colName = (field as any).dbName || field.name;
      map[field.name] = colName;
    }
    break;
  }
  return map;
}

/**
 * Collect the Prisma `Json`-typed field names for a single table. These are
 * the columns whose array/object seed values must be JSON.stringify-ed before
 * being handed to the `pg` client — otherwise pg encodes a JS array as a
 * Postgres array literal and the JSONB insert fails with error `22P02`.
 *
 * Keyed by Prisma field name (the seed-data key), matching the insert loop's
 * iteration variable. Accepts the models array so this helper is testable
 * without loading @prisma/client.
 */
export function buildJsonFieldSet(
  models: PrismaModel[],
  tableName: string,
): Set<string> {
  const set = new Set<string>();
  for (const model of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbName = (model as any).dbName || model.name;
    if (dbName !== tableName) continue;
    for (const field of model.fields) {
      if (field.kind === 'object') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((field as any).type === 'Json') set.add(field.name);
    }
    break;
  }
  return set;
}

/**
 * Encode a single seed value for a parameterized INSERT. For a JSON-typed
 * field, a non-null array/object is serialized with `JSON.stringify` so the
 * `pg` client sends valid JSON text rather than a Postgres array literal
 * (the `22P02` bug). Every other value — including a string that already
 * holds JSON text — passes through untouched so it is not double-encoded.
 */
export function encodeJsonParam(value: unknown, isJsonField: boolean): unknown {
  if (isJsonField && value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

// ---------------------------------------------------------------------------
// PROJECT CUSTOMISATION — carried across the SQLite → PostgreSQL migration.
// The shipped template has no binary handling; without this, a seeded image
// arrives as the literal characters of its base64 string. Re-apply it if this
// file is ever refreshed from the shipped template again.
// ---------------------------------------------------------------------------

/**
 * Collect the Prisma `Bytes`-typed field names for a single table.
 *
 * JSON has no binary literal, so a seed file carrying a real image can only
 * carry it as base64. Scoped by the schema's own `Bytes` fields rather than by
 * guessing at a field name, so a base64-looking String column is untouched.
 *
 * Added for MapAttachment, whose whole point is holding a picture a person
 * attached; a seed that could not carry one could not demonstrate the feature.
 *
 * Mirrors `buildJsonFieldSet` — same keying by Prisma field name, same reason.
 */
export function buildBytesFieldSet(
  models: PrismaModel[],
  tableName: string,
): Set<string> {
  const set = new Set<string>();
  for (const model of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbName = (model as any).dbName || model.name;
    if (dbName !== tableName) continue;
    for (const field of model.fields) {
      if (field.kind === 'object') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((field as any).type === 'Bytes') set.add(field.name);
    }
    break;
  }
  return set;
}

/**
 * Decode a base64 seed value into the Buffer a Postgres `bytea` column wants.
 * A non-string (already a Buffer, or null) passes through untouched.
 */
export function encodeBytesParam(
  value: unknown,
  isBytesField: boolean,
): unknown {
  if (isBytesField && typeof value === 'string') {
    return Buffer.from(value, 'base64');
  }
  return value;
}

/**
 * A field Prisma populates in the *client* rather than the database. Prisma
 * emits these columns as `NOT NULL` with no `DEFAULT`, so an adapter that
 * writes through raw `pg` — as this one does — must supply them itself or
 * Postgres rejects the row with `23502`.
 */
export interface ClientManagedField {
  name: string;
  kind: 'updatedAt' | 'uuid' | 'cuid' | 'nanoid';
}

/**
 * Read `data.schemaFile` from a root's `.codeyam/stack.json`, or `null` when
 * the file is absent, unparseable, or declares no schema path.
 */
function readStackSchemaFile(root: string): string | null {
  try {
    const raw = fs.readFileSync(
      path.join(root, '.codeyam', 'stack.json'),
      'utf-8',
    );
    const parsed: unknown = JSON.parse(raw);
    const schemaFile = (parsed as { data?: { schemaFile?: unknown } } | null)
      ?.data?.schemaFile;
    return typeof schemaFile === 'string' && schemaFile.length > 0
      ? schemaFile
      : null;
  } catch {
    return null;
  }
}

/**
 * Locate the project's `schema.prisma`: `.codeyam/stack.json`'s
 * `data.schemaFile` first, then Prisma's conventional
 * `prisma/schema.prisma`. Searched across the same multi-root set
 * `loadDotEnvFiles` uses, because `npx tsx` is not always spawned from the
 * project root. Returns `null` when no candidate exists.
 */
export function resolvePrismaSchemaPath(
  cwd: string = process.cwd(),
  scriptDir: string | null = currentScriptDir(),
): string | null {
  for (const root of searchRoots(cwd, scriptDir)) {
    const configured = readStackSchemaFile(root);
    const candidates = [
      ...(configured ? [path.resolve(root, configured)] : []),
      path.resolve(root, 'prisma', 'schema.prisma'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * The text of the project's Prisma schema, or `null` when it cannot be
 * found or read. A missing schema is never fatal — the adapter degrades to
 * inserting only the columns the seed supplies, and `describeSeedInsertError`
 * explains the consequence if that turns out to be too few.
 */
export function readPrismaSchemaText(
  cwd: string = process.cwd(),
  scriptDir: string | null = currentScriptDir(),
): string | null {
  const schemaPath = resolvePrismaSchemaPath(cwd, scriptDir);
  if (schemaPath === null) return null;
  try {
    return fs.readFileSync(schemaPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Drop a `//` line comment, ignoring a `//` that falls inside a quoted
 * string (`@map("a//b")`).
 */
function stripLineComment(line: string): string {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && ch === '/' && line[i + 1] === '/') {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Classify a field's attribute text, or `null` when Prisma does not manage
 * the field client-side. `@default(now())` is deliberately absent: Prisma
 * emits a real `DEFAULT CURRENT_TIMESTAMP` for it, so the database fills it.
 */
function classifyManagedAttributes(
  attributes: string,
): ClientManagedField['kind'] | null {
  if (/@updatedAt\b/.test(attributes)) return 'updatedAt';
  if (attributes.includes('@default(uuid(')) return 'uuid';
  if (attributes.includes('@default(cuid(')) return 'cuid';
  if (attributes.includes('@default(nanoid(')) return 'nanoid';
  return null;
}

/**
 * Parse a `schema.prisma` for the fields Prisma populates client-side,
 * keyed by model name. Every parsed model gets an entry, empty when it
 * declares none.
 *
 * Walks `model <Name> { ... }` blocks line by line rather than matching
 * braces with one whole-file regex — a `.prisma` file is not a regular
 * language, and this repo has been bitten by wrong-grammar parses before.
 * Optional fields (`DateTime?`) are skipped: a nullable column accepts the
 * omission, so nothing needs filling.
 *
 * Pure and text-in, so it unit-tests with an inline schema string and no
 * Prisma install.
 */
export function parseClientManagedFields(
  schemaText: string,
): Record<string, ClientManagedField[]> {
  const byModel: Record<string, ClientManagedField[]> = {};
  let currentModel: string | null = null;

  for (const rawLine of schemaText.split('\n')) {
    const line = stripLineComment(rawLine).trim();
    if (line.length === 0) continue;

    if (currentModel === null) {
      const opened = /^model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(line);
      if (opened) {
        currentModel = opened[1];
        byModel[currentModel] = [];
      }
      continue;
    }

    if (line.startsWith('}')) {
      currentModel = null;
      continue;
    }
    // Block-level attributes (@@map, @@index, @@unique) are not fields.
    if (line.startsWith('@@')) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [name, type] = parts;
    if (type.endsWith('?')) continue;

    const kind = classifyManagedAttributes(parts.slice(2).join(' '));
    if (kind !== null) byModel[currentModel].push({ name, kind });
  }

  return byModel;
}

/**
 * The client-managed fields declared for a *database table*, or `[]` when no
 * model maps to it (or the schema was unavailable).
 *
 * The indirection is load-bearing: `parseClientManagedFields` keys its map by
 * Prisma MODEL name, while the insert loop works in database TABLE names, and
 * `@@map` makes those two differ. Looking the table up directly in the parsed
 * map would silently return nothing for every mapped model.
 */
export function managedFieldsForTable(
  models: PrismaModel[],
  managedByModel: Record<string, ClientManagedField[]>,
  table: string,
): ClientManagedField[] {
  for (const model of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbName = (model as any).dbName || model.name;
    if (dbName !== table) continue;
    return managedByModel[model.name] ?? [];
  }
  return [];
}

/**
 * Supply the client-managed columns a seed row omits, returning the
 * augmented column list and rows to insert.
 *
 * `updatedAt` takes the injected `now` (never an ambient clock, so the
 * result is assertable); `uuid` gets a fresh `randomUUID()` per row.
 * `cuid` / `nanoid` are NOT fabricated — their values are not reproducible
 * without those generators, so they are reported in `unfillable` for
 * `describeSeedInsertError` to name rather than silently replaced with
 * something the app would treat as a valid id. A field the seed already
 * supplies is always left alone.
 */
export function fillClientManagedFields(
  rows: Record<string, unknown>[],
  managed: ClientManagedField[],
  now: Date,
): {
  fieldNames: string[];
  rows: Record<string, unknown>[];
  unfillable: string[];
} {
  if (rows.length === 0) {
    return { fieldNames: [], rows, unfillable: [] };
  }

  // PROJECT CUSTOMISATION — re-apply if this file is refreshed from the
  // shipped template. This was `Object.keys(rows[0])`, which builds the INSERT
  // column list from the FIRST row alone. Seed rows are not uniform: an
  // optional column that only appears on a later row was dropped from every
  // row silently, with no error and a green suite.
  //
  // Found via `distinct-capture-check`: `complete-what-to-do-next` and
  // `a-plan-with-a-gap-one-slice-proves-nothing` differ by exactly one field,
  // `mapNode[17].testsNodeId`, which row 0 does not carry. Both rendered the
  // identical frame because that column never reached the database.
  //
  // Union in first-seen order, so column order stays deterministic.
  const fieldNames: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        fieldNames.push(key);
      }
    }
  }
  const supplied = seen;
  const missing = managed.filter((f) => !supplied.has(f.name));
  const fillable = missing.filter(
    (f) => f.kind === 'updatedAt' || f.kind === 'uuid',
  );
  const unfillable = missing
    .filter((f) => f.kind === 'cuid' || f.kind === 'nanoid')
    .map((f) => f.name);

  if (fillable.length === 0) {
    return { fieldNames, rows, unfillable };
  }

  const filledRows = rows.map((row) => {
    const out = { ...row };
    for (const field of fillable) {
      out[field.name] = field.kind === 'updatedAt' ? now : randomUUID();
    }
    return out;
  });

  return {
    fieldNames: [...fieldNames, ...fillable.map((f) => f.name)],
    rows: filledRows,
    unfillable,
  };
}

/**
 * Turn a failed seed INSERT into an actionable message. A bare Postgres
 * `23502` from inside a scenario capture is a long way from "your seed
 * adapter cannot populate `@updatedAt`", so name the table, the column, the
 * cause, and the remedy. Any other error passes through with its own
 * message untouched.
 */
export function describeSeedInsertError(
  err: unknown,
  table: string,
  unfillable: string[],
  schemaFound: boolean,
): string {
  const detail = err as { code?: unknown; column?: unknown } | null;
  if (detail?.code !== '23502') {
    return err instanceof Error ? err.message : String(err);
  }

  const column =
    typeof detail.column === 'string' ? detail.column : '<unknown>';
  const lines = [
    `[codeyam-seed] FATAL: INSERT INTO "${table}" failed with Postgres 23502 — ` +
      `null value in column "${column}" violates its not-null constraint.`,
    `Prisma populates fields like @updatedAt and @default(uuid()) in the CLIENT, ` +
      `not via a database DEFAULT, and this adapter writes through raw \`pg\`, ` +
      `so the column stays unset unless the seed data or this adapter supplies it.`,
  ];

  if (!schemaFound) {
    lines.push(
      `The Prisma schema could not be resolved, so no client-managed field could ` +
        `be filled. Point "data.schemaFile" in .codeyam/stack.json at the schema ` +
        `(the default lookup is prisma/schema.prisma).`,
    );
  } else if (unfillable.length > 0) {
    lines.push(
      `These client-managed fields on this table cannot be generated by the ` +
        `adapter — @default(cuid()) and @default(nanoid()) need their own ` +
        `generators — so add them to the seed data: ${unfillable.join(', ')}.`,
    );
  } else {
    lines.push(
      `The Prisma schema was found and declares no client-managed field named ` +
        `"${column}" on this model, so this column is genuinely missing from the ` +
        `seed data. Add it there.`,
    );
  }

  return lines.join('\n');
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
 * form the seed data uses as keys. Self-references are ignored.
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
 * Topological order so every table is inserted AFTER all of its parents.
 * On a cycle, remaining tables are emitted in input order with a warning;
 * nullable FKs typically make this safe.
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
        `[codeyam-seed] FK cycle detected; falling back to input order for: ${[
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
 * Lazy-load @prisma/client and return its DMMF models. Deferred so importing
 * this module from a test file does not require @prisma/client to be
 * installed.
 */
async function loadPrismaModels(): Promise<PrismaModel[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('@prisma/client');
  return mod.Prisma.dmmf.datamodel.models;
}

/**
 * Connect to PostgreSQL via the deferred-imported `pg` module and
 * return a `QueryClient`-shaped wrapper plus an `end()` disposer.
 */
async function connectPg(databaseUrl: string): Promise<{
  client: QueryClient;
  end: () => Promise<void>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pgModule: any = await import('pg');
  const Client = pgModule.default?.Client || pgModule.Client;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return { client, end: () => client.end() };
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
    console.error(
      'DATABASE_URL must be set to a PostgreSQL connection string.',
    );
    process.exit(1);
  }
  return databaseUrl;
}

/**
 * Every sequence-backed column in the public schema: `serial`/`bigserial`
 * (which carry a `nextval(...)` column default) and `GENERATED ... AS
 * IDENTITY`. `pg_get_serial_sequence` resolves the owning sequence for both
 * on PG 10+.
 *
 * Read from the catalog rather than assuming the column is named `id`. The
 * hardcoded `'id'` lookup this replaces threw for every table whose
 * sequence-backed column is named otherwise, and the error was swallowed —
 * so those sequences were never resynced at all.
 *
 * Stack assumption: scoped to `table_schema = 'public'`, matching
 * `JSON_COLUMNS_QUERY` / `TABLE_NAMES_QUERY` in the sibling adapters. A
 * multi-schema project is already outside these adapters' reach.
 */
export const SEQUENCE_COLUMNS_QUERY =
  "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')";

/**
 * Build one `setval` per sequence-backed column, resyncing each sequence
 * from the rows that are already in the table.
 *
 * Seed rows carry explicit ids, and an explicit id never advances a Postgres
 * sequence — so these statements must run AFTER the inserts. `is_called` is
 * the third argument: true when rows exist, so `nextval` returns `max+1`;
 * false on an empty table, so it returns 1.
 *
 * Identifiers are interpolated from the database catalog, not from user
 * input — the same provenance the table-name interpolation in these adapters
 * already relies on.
 */
export function buildSequenceResyncStatements(
  rows: Array<{ table_name: unknown; column_name: unknown }>,
): string[] {
  return rows.map((row) => {
    const table = String(row.table_name);
    const column = String(row.column_name);
    return (
      `SELECT setval(pg_get_serial_sequence('"${table}"', '${column}'), ` +
      `COALESCE((SELECT max("${column}") FROM "${table}"), 1), ` +
      `(SELECT count(*) FROM "${table}") > 0)`
    );
  });
}

/**
 * Resync every sequence-backed column in the public schema from the rows now
 * in its table.
 *
 * Must run strictly AFTER the seed inserts: the seed rows carry explicit ids,
 * and an explicit id never advances a Postgres sequence, so resyncing before
 * them (or not at all) leaves `nextval()` returning 1 while rows already
 * occupy 1..N — and the app's first write dies on a duplicate key.
 *
 * Stops at the first failing statement and returns it rather than throwing,
 * so the caller can close its connection and surface the failure without
 * discarding the rows it has already inserted.
 */
export async function resyncSequences(
  client: QueryClient,
): Promise<{ count: number; failure: string | null }> {
  const sequenceColumns = await client.query(SEQUENCE_COLUMNS_QUERY);
  const statements = buildSequenceResyncStatements(
    sequenceColumns.rows as Array<{
      table_name: unknown;
      column_name: unknown;
    }>,
  );
  let count = 0;
  for (const statement of statements) {
    try {
      await client.query(statement);
      count += 1;
    } catch (err) {
      return { count, failure: `${statement} — ${err}` };
    }
  }
  return { count, failure: null };
}

/**
 * Adapter entry point: load env files, parse the seed JSON, truncate
 * Prisma's tracked tables and insert the seed data via direct `pg`
 * queries in topological FK order.
 *
 * Accepts optional `clientFactory`, `modelsLoader`, `schemaLoader` and `now`
 * — the same injection seam `exportData` already has — so the TRUNCATE /
 * INSERT loop is exercisable without a live database, `@prisma/client`, or
 * an ambient clock. Every default reproduces the CLI behaviour exactly.
 */
export async function main(
  clientFactory: () => Promise<{
    client: QueryClient;
    end: () => Promise<void>;
  }> = () => connectPg(requireDatabaseUrl()),
  modelsLoader: () => Promise<PrismaModel[]> = loadPrismaModels,
  schemaLoader: () => string | null = () => readPrismaSchemaText(),
  now: Date = new Date(),
) {
  loadDotEnvFiles();
  const seedDataPath = process.argv[2];
  if (!seedDataPath) {
    console.error('Usage: npx tsx .codeyam/seed-adapter.ts <seed-data.json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(seedDataPath, 'utf-8');
  const data = JSON.parse(raw);
  // Canonical envelope unwrap: tables live under `seed`. Fall through
  // to the flat shape for back-compat with hand-written adapters.
  const seed: Record<string, unknown[]> =
    data && typeof data === 'object' && data.seed && typeof data.seed === 'object'
      ? data.seed
      : data;

  const expectedTables = Object.keys(seed).filter(
    (k) => Array.isArray(seed[k]) && seed[k].length > 0,
  );
  const expectedRows = expectedTables.reduce(
    (sum, t) => sum + seed[t].length,
    0,
  );
  let actualRows = 0;
  let sequenceResyncFailure: string | null = null;

  const models = await modelsLoader();
  const tableMap = buildTableNameMap(models);

  // The DMMF does not expose @updatedAt or @default(uuid()) (Prisma 7's field
  // objects carry only name/kind/type), so the fields Prisma manages
  // client-side have to come from the schema file itself.
  const schemaText = schemaLoader();
  const managedByModel =
    schemaText === null ? {} : parseClientManagedFields(schemaText);

  // Discover ALL models from the Prisma schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTables = models.map((m) => (m as any).dbName || m.name);

  console.log(
    `Clearing ${allTables.length} tables, seeding: ${Object.keys(seed).join(', ')}`,
  );

  const fkEdges = getPrismaFkEdges(models);
  const insertOrder = topoSortTables(Object.keys(seed), fkEdges);
  warnIfFkGraphUnderivable(Object.keys(seed), models, fkEdges);

  const { client, end } = await clientFactory();

  try {
    // TRUNCATE all tables in one statement — CASCADE handles FK dependencies.
    // RESTART IDENTITY resets every sequence back to 1 at wipe time, so a
    // table left unseeded still hands out id 1 and hardcoded links like
    // `/drinks/1` keep working across a scenario switch.
    const quoted = allTables.map((t) => `"${t}"`).join(', ');
    await client.query(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);
    console.log(`  Cleared ${allTables.length} tables`);

    // Insert seed data using batched INSERT, in topological FK order
    for (const seedKey of insertOrder) {
      const rows = seed[seedKey];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const table = tableMap[seedKey] || seedKey;
      const columnMap = buildColumnMap(models, table);
      const jsonFields = buildJsonFieldSet(models, table);
      const bytesFields = buildBytesFieldSet(models, table);

      // Fill the columns Prisma would have populated in its client before the
      // column list is derived, so the JSON encoding and the placeholders
      // below see the final set.
      const managed = managedFieldsForTable(models, managedByModel, table);
      const filled = fillClientManagedFields(
        rows as Record<string, unknown>[],
        managed,
        now,
      );
      const fieldNames = filled.fieldNames;
      const dbColumns = fieldNames.map((f) => columnMap[f] || f);
      const quotedCols = dbColumns.map((c) => `"${c}"`).join(', ');

      const params: unknown[] = [];
      const valueClauses: string[] = [];
      for (const row of filled.rows) {
        const placeholders: string[] = [];
        for (const field of fieldNames) {
          // A row that OMITS this column gets the SQL `DEFAULT` keyword, not a
          // NULL parameter. The two are not interchangeable: `offsetX` is
          // `Float @default(0)` — NOT NULL with a default — so an explicit NULL
          // fails with Postgres 23502 while DEFAULT yields 0. Where a column
          // has no default, DEFAULT yields NULL, which is the same answer.
          //
          // This distinction only arises because the column list above is the
          // union across rows; before that, an absent column was omitted from
          // the statement entirely and Postgres applied the default itself.
          // DEFAULT restores exactly that behaviour per row.
          if (!(field in row)) {
            placeholders.push('DEFAULT');
            continue;
          }
          params.push(
            encodeBytesParam(
              encodeJsonParam(row[field], jsonFields.has(field)),
              bytesFields.has(field),
            ),
          );
          placeholders.push(`$${params.length}`);
        }
        valueClauses.push(`(${placeholders.join(', ')})`);
      }

      try {
        await client.query(
          `INSERT INTO "${table}" (${quotedCols}) VALUES ${valueClauses.join(', ')}`,
          params,
        );
      } catch (err) {
        throw new Error(
          describeSeedInsertError(
            err,
            table,
            filled.unfillable,
            schemaText !== null,
          ),
        );
      }
      actualRows += rows.length;
      console.error(`[codeyam-seed] inserted ${rows.length} rows into ${table}`);
    }

    // Resync each sequence from the data now in the table. This runs AFTER
    // the inserts on purpose: the seed rows carry explicit ids, which never
    // advance a sequence, so a pre-insert reset would leave `nextval()`
    // returning 1 while rows already occupy 1..N.
    // A failure is not swallowed — an unresynced sequence is exactly the
    // defect this step exists to prevent — but it is reported after `end()`
    // fires so the already-inserted rows are not lost.
    const resync = await resyncSequences(client);
    sequenceResyncFailure = resync.failure;
    console.log(`  Resynced ${resync.count} sequences`);
  } finally {
    await end();
  }

  if (sequenceResyncFailure !== null) {
    console.error(
      `[codeyam-seed] FATAL: sequence resync failed: ${sequenceResyncFailure}. ` +
        `Rows were inserted, but auto-increment sequences still point at ` +
        `already-used ids — the app's first write would collide on a ` +
        `duplicate key.`,
    );
    process.exit(1);
  }

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
}

/**
 * Export mode: dump current database state to a JSON file.
 *
 * Accepts optional `clientFactory` and `modelsLoader` so tests can inject
 * fakes instead of opening a real `pg` connection or importing
 * `@prisma/client` — see `seed-adapters/test-helpers.ts` for the shared
 * `QueryClient` fake.
 */
export async function exportData(
  outputPath: string,
  clientFactory: () => Promise<{
    client: QueryClient;
    end: () => Promise<void>;
  }> = () => connectPg(requireDatabaseUrl()),
  modelsLoader: () => Promise<PrismaModel[]> = loadPrismaModels,
) {
  loadDotEnvFiles();
  const models = await modelsLoader();
  const tableMap = buildTableNameMap(models);
  const modelNames = models.map((m) => m.name);

  const { client, end } = await clientFactory();

  try {
    const seed: Record<string, unknown[]> = {};
    for (const model of modelNames) {
      const camelCase = lowerFirst(model);
      const table = tableMap[camelCase] || model;
      try {
        const result = await client.query(`SELECT * FROM "${table}"`);
        if (result.rows.length > 0) {
          seed[camelCase] = result.rows;
        }
      } catch {
        // Skip tables that can't be queried
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(seed, null, 2));
    console.log(`Exported ${Object.keys(seed).length} tables`);
  } finally {
    await end();
  }
}

export const __test__ = { connectPg, loadPrismaModels };

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
