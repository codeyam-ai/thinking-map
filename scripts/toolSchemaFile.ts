// The eval fixture, derived from the tool catalog.
//
// `evals/tools.schema.json` is what `webmcp-evals local` shows a model: one
// entry per tool, carrying the name, the description, and the input schema.
// Those three fields are the thing the eval suite is judging — they are prompt
// engineering, and until the suite existed nothing checked that a re-worded
// description still produced the behaviour it was written to produce.
//
// The fixture is GENERATED, never hand-written. `toolCatalog.ts`'s own header
// explains why this app defines its tools exactly once and consumes that from
// every front door; a checked-in hand copy of the schemas would be a fourth
// door, free to drift from the three real ones. Generating means the evals run
// against the same bytes the browser agent is handed.
//
// Import surface is deliberately narrow: `toolCatalog.ts` and
// `toolInvocation.ts` ONLY. Both are isomorphic by design and reach no
// database. `toolRuntime.ts` imports `server-only` and would drag Prisma in,
// at which point generating the fixture would need the
// `--conditions=react-server` dance that `npm run mcp` needs. Keeping to the
// two pure modules is what makes the emitter a plain `npx tsx` one-liner.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { TOOL_CATALOG } from '../app/lib/toolCatalog';
import { jsonSchemaFor, type JsonSchema } from '../app/lib/toolInvocation';

/** Where the committed fixture lives. Named here rather than in the emitter so
 *  the writer and every caller of it cannot disagree about the path. */
export const DEFAULT_EVAL_SCHEMA_PATH = 'evals/tools.schema.json';

/** One tool as the eval CLI's local mode reads it. */
export interface EvalToolEntry {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

/**
 * The catalog as the eval fixture describes it.
 *
 * The CLI maps each entry to `{ functionName, description, parameters }` and
 * hands those to the model, so these three fields are the whole contract.
 * `annotations` (the catalog's `readOnlyHint`) is deliberately omitted: local
 * mode never reads it, and a field that cannot change an eval result would
 * only add noise to the diff this file exists to make reviewable.
 */
export function evalToolsSchema(): { tools: EvalToolEntry[] } {
  return {
    tools: TOOL_CATALOG.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: jsonSchemaFor(tool),
    })),
  };
}

/**
 * The fixture as bytes.
 *
 * Two-space indent and a trailing newline are the reason
 * `npm run evals:schema:check` produces a diff you can read — a re-worded
 * description shows up as one changed line rather than a whole-file rewrite.
 * That formatting is the point of the check, so it gets its own name and its
 * own tests rather than living inline in the emitter.
 */
export function serializeEvalToolsSchema(): string {
  return `${JSON.stringify(evalToolsSchema(), null, 2)}\n`;
}

/**
 * Write the fixture, creating its directory if needed.
 *
 * Returns how many tools were written so the caller can report without
 * re-deriving the catalog length.
 */
export function writeEvalToolsSchema(outPath: string): number {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serializeEvalToolsSchema());
  return TOOL_CATALOG.length;
}
