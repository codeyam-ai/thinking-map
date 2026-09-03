// Emit the tool catalog as the static JSON fixture `webmcp-evals local` reads.
//
// This file is the entry point and nothing else: it reads the output path and
// calls the writer. Everything it used to inline — what the fixture contains,
// how it is formatted, where it goes — lives in `toolSchemaFile.ts`, where it
// can be imported and tested without writing to disk as a side effect of the
// import.
//
// Usage:
//   npx tsx scripts/emit-tool-schema.ts [outPath]
// Defaults to `evals/tools.schema.json`; `npm run evals:schema:check` passes a
// temp path and diffs the result against the committed file.

import { resolve } from 'node:path';
import {
  DEFAULT_EVAL_SCHEMA_PATH,
  writeEvalToolsSchema,
} from './toolSchemaFile';

const outPath = resolve(process.argv[2] ?? DEFAULT_EVAL_SCHEMA_PATH);
const count = writeEvalToolsSchema(outPath);
console.log(`Wrote ${count} tool schemas to ${outPath}`);
