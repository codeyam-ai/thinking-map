import { describe, expect, it } from 'vitest';
import { summarizeMap } from './mapStore';

const node = (
  id: string,
  parentId: string | null,
  kind: string,
  label: string,
  status = 'answered',
) => ({ id, parentId, kind, label, status });

// This rendering is what the model reads as context before every turn. It has
// to carry real node ids, because update_node names them — a summary that
// loses an id makes the map un-editable by the partner.
describe('summarizeMap', () => {
  // The model must be told plainly when there is nothing yet, rather than
  // receiving an empty string it might read as a truncation.
  it('says so explicitly when the map is empty', () => {
    expect(summarizeMap([])).toBe('(empty — nothing on the map yet)');
  });

  // Without the id, the model cannot target a node with update_node.
  it('includes each node id in brackets', () => {
    const out = summarizeMap([node('n-idea', null, 'idea', 'Educational game')]);
    expect(out).toContain('[n-idea]');
  });

  // Kind and status tell the model what is settled and what is still open.
  it('names each node kind and status', () => {
    const out = summarizeMap([
      node('n1', null, 'open-question', 'Who is it for?', 'open'),
    ]);
    expect(out).toContain('Open');
    expect(out).toContain('open');
    expect(out).toContain('Who is it for?');
  });

  // Indentation is how the flat list conveys the tree; without it the model
  // cannot tell a child from a sibling.
  it('indents children beneath their parent', () => {
    const lines = summarizeMap([
      node('root', null, 'idea', 'Root'),
      node('child', 'root', 'problem', 'Child'),
    ]).split('\n');
    expect(lines[0].startsWith('-')).toBe(true);
    expect(lines[1].startsWith('  -')).toBe(true);
  });

  // Depth must keep increasing so a three-level map does not read as flat.
  it('indents deeper for a grandchild', () => {
    const lines = summarizeMap([
      node('root', null, 'idea', 'Root'),
      node('child', 'root', 'research', 'Child'),
      node('grand', 'child', 'finding', 'Grandchild'),
    ]).split('\n');
    expect(lines[2].startsWith('    -')).toBe(true);
  });

  // Nodes arrive flat and unordered from the database; every one must appear
  // exactly once regardless of input order.
  it('renders every node exactly once, whatever order they arrive in', () => {
    const out = summarizeMap([
      node('grand', 'child', 'finding', 'Grandchild'),
      node('root', null, 'idea', 'Root'),
      node('child', 'root', 'research', 'Child'),
    ]);
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toContain('Grandchild');
  });
});
