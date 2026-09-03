import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_EVAL_SCHEMA_PATH,
  evalToolsSchema,
  serializeEvalToolsSchema,
  writeEvalToolsSchema,
} from './toolSchemaFile';
import { TOOL_CATALOG, findTool } from '../app/lib/toolCatalog';

// The eval fixture is generated so it cannot drift from the catalog that ships.
// These pin the two properties that make that worth anything: the fixture says
// exactly what the catalog says, and it is formatted so a description change
// reads as a description change in review rather than a whole-file rewrite.

describe('evalToolsSchema', () => {
  // One entry per tool, in catalog order. A fixture that silently dropped a
  // tool would leave that tool's description untested while the suite stayed
  // green, which is the failure this whole directory exists to prevent.
  it('emits one entry per catalog tool in catalog order', () => {
    const { tools } = evalToolsSchema();
    expect(tools).toHaveLength(TOOL_CATALOG.length);
    expect(tools.map((t) => t.name)).toEqual(TOOL_CATALOG.map((t) => t.name));
  });

  // The descriptions ARE the thing under test, so they must be reproduced
  // verbatim. A truncated or re-wrapped copy would mean the evals judge prose
  // the agent is never shown.
  it('reproduces each description verbatim from the catalog', () => {
    for (const entry of evalToolsSchema().tools) {
      const tool = findTool(entry.name);
      expect(tool).toBeDefined();
      expect(entry.description).toBe(tool!.description);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  // add_nodes builds its description by interpolating the insight kinds and the
  // live-insight target, so an emitter that read some static field instead of
  // the composed string would quietly ship a fixture missing the sentence that
  // teaches the distinction.
  it('carries the interpolated parts of the add_nodes description', () => {
    const addNodes = evalToolsSchema().tools.find((t) => t.name === 'add_nodes');
    expect(addNodes).toBeDefined();
    expect(addNodes!.description).toContain('themeRef');
    expect(addNodes!.description).toContain('live insights on the board');
  });

  // Every input schema must be a plain JSON Schema object. A Zod schema leaking
  // through here is not a formatting nit: it is a live graph of class instances
  // that neither JSON nor the agent boundary can carry.
  it('converts every input schema to a plain JSON Schema object', () => {
    for (const entry of evalToolsSchema().tools) {
      expect(entry.inputSchema).toBeTypeOf('object');
      expect(entry.inputSchema.type).toBe('object');
      expect(() => structuredClone(entry.inputSchema)).not.toThrow();
    }
  });

  // annotations are deliberately not emitted — local mode never reads them, so
  // including them would add diff noise that can never change a result.
  // read_map carries readOnlyHint, so it is the case that would catch a slip.
  it('omits annotations even for a tool that declares them', () => {
    expect(findTool('read_map')?.annotations).toBeDefined();
    const readMap = evalToolsSchema().tools.find((t) => t.name === 'read_map');
    expect(readMap).toBeDefined();
    expect(Object.keys(readMap!)).toEqual(['name', 'description', 'inputSchema']);
  });

  // The union in ask_user's questions field is the one schema shape that has to
  // survive conversion; losing it would silently narrow what the fixture says
  // the agent may send.
  it('keeps the ask_user questions field in the converted schema', () => {
    const askUser = evalToolsSchema().tools.find((t) => t.name === 'ask_user');
    expect(askUser).toBeDefined();
    const properties = askUser!.inputSchema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty('questions');
  });
});

describe('serializeEvalToolsSchema', () => {
  // Exactly one trailing newline. Without it every regeneration would show a
  // no-newline-at-end-of-file marker in the diff the check command prints.
  it('ends with exactly one trailing newline', () => {
    const text = serializeEvalToolsSchema();
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  // Two-space indent is what makes a re-worded description show up as one
  // changed line. A single-line dump would make the whole file one diff hunk
  // and defeat the reviewability the fixture is committed for.
  it('indents with two spaces so a description change is one diff line', () => {
    const lines = serializeEvalToolsSchema().split('\n');
    expect(lines[1]).toBe('  "tools": [');
    expect(lines.length).toBeGreaterThan(50);
  });

  // The bytes must parse back to exactly what the emitter built, or the file on
  // disk is not the fixture the tests above pinned.
  it('round-trips back to the same schema object', () => {
    expect(JSON.parse(serializeEvalToolsSchema())).toEqual(evalToolsSchema());
  });

  // Deterministic output is what lets the check command treat any diff at all
  // as a real staleness signal rather than key-order churn.
  it('produces identical bytes on repeated calls', () => {
    expect(serializeEvalToolsSchema()).toBe(serializeEvalToolsSchema());
  });
});

describe('writeEvalToolsSchema', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tool-schema-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // The bytes on disk are the ones the eval CLI reads, so they must be the
  // serializer's output and nothing else.
  it('writes the serialized fixture to the given path', () => {
    const out = join(dir, 'tools.schema.json');
    writeEvalToolsSchema(out);
    expect(readFileSync(out, 'utf-8')).toBe(serializeEvalToolsSchema());
  });

  // The check script writes to a path whose directory may not exist yet, and a
  // first generation into a fresh clone has no evals directory at all.
  it('creates missing parent directories', () => {
    const out = join(dir, 'nested', 'deeper', 'tools.schema.json');
    expect(existsSync(join(dir, 'nested'))).toBe(false);
    writeEvalToolsSchema(out);
    expect(existsSync(out)).toBe(true);
  });

  // Regenerating over a stale file must replace it wholesale — a partial
  // overwrite would leave trailing bytes from the previous, longer fixture.
  it('overwrites an existing file rather than appending', () => {
    const out = join(dir, 'tools.schema.json');
    writeFileSync(out, 'stale contents that are much longer than nothing at all');
    writeEvalToolsSchema(out);
    expect(readFileSync(out, 'utf-8')).toBe(serializeEvalToolsSchema());
  });

  // The count is what the emitter reports to the operator; deriving it from the
  // catalog rather than from the caller is what keeps that line honest.
  it('returns the number of tools written', () => {
    expect(writeEvalToolsSchema(join(dir, 'tools.schema.json'))).toBe(
      TOOL_CATALOG.length,
    );
  });
});

describe('DEFAULT_EVAL_SCHEMA_PATH', () => {
  // The emitter, the check script and the eval command all have to name the
  // same file. This constant is what stops them disagreeing.
  it('points at the committed fixture path', () => {
    expect(DEFAULT_EVAL_SCHEMA_PATH).toBe('evals/tools.schema.json');
  });
});
