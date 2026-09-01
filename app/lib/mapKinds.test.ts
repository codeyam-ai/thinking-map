import { describe, expect, it } from 'vitest';
import { isNodeKind, isNodeStatus, isPhase } from './mapKinds';

// SQLite has no enums, so these strings arrive from the database and from the
// model's tool calls unvalidated. These guards are the only thing standing
// between a bad value and a node the map cannot draw.
describe('map vocabulary guards', () => {
  // A real phase must pass, or the workspace falls back and shows the wrong
  // step as active.
  it('accepts every phase in the loop', () => {
    for (const phase of [
      'idea',
      'deconstruct',
      'map',
      'research',
      'explore',
      'next-steps',
    ]) {
      expect(isPhase(phase)).toBe(true);
    }
  });

  // A typo or a model hallucination must not become the active phase.
  it('rejects a phase that is not part of the loop', () => {
    expect(isPhase('brainstorm')).toBe(false);
    expect(isPhase('')).toBe(false);
    expect(isPhase('Idea')).toBe(false);
  });

  // The kinds the map knows how to draw, including the four that only appear
  // on the summary screen.
  it('accepts the node kinds the map can draw', () => {
    for (const kind of [
      'idea',
      'open-question',
      'research',
      'gap',
      'approach',
      'known',
      'next-step',
    ]) {
      expect(isNodeKind(kind)).toBe(true);
    }
  });

  // applyToolCalls drops unknown kinds rather than storing them; this is the
  // check that makes that possible.
  it('rejects a node kind the map has no treatment for', () => {
    expect(isNodeKind('sticky-note')).toBe(false);
    expect(isNodeKind('')).toBe(false);
  });

  // Status drives the visual treatment, so only these three are meaningful.
  it('accepts the three node statuses', () => {
    expect(isNodeStatus('open')).toBe(true);
    expect(isNodeStatus('answered')).toBe(true);
    expect(isNodeStatus('updated')).toBe(true);
  });

  // Anything else would fall through to the default treatment silently.
  it('rejects an unknown node status', () => {
    expect(isNodeStatus('pending')).toBe(false);
    expect(isNodeStatus('OPEN')).toBe(false);
  });
});
