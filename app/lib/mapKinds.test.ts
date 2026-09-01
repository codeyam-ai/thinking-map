import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_PHASE_NAMES,
  PHASES,
  PHASE_ASK,
  PHASE_LABELS,
  isNodeKind,
  isNodeStatus,
  isPhase,
  normalizePhase,
} from './mapKinds';

// SQLite has no enums, so these strings arrive from the database and from the
// model's tool calls unvalidated. These guards are the only thing standing
// between a bad value and a node the map cannot draw.
describe('map vocabulary guards', () => {
  // A real phase must pass, or the workspace falls back and shows the wrong
  // step as active.
  it('accepts every phase in the loop', () => {
    for (const phase of ['idea', 'map', 'research', 'explore', 'next-steps']) {
      expect(isPhase(phase)).toBe(true);
    }
  });

  // The merge is the point: five steps, not six. Pinned as a literal so that
  // re-adding a phase has to come here and say so.
  it('has five phases, with deconstruct no longer among them', () => {
    expect([...PHASES]).toEqual([
      'idea',
      'map',
      'research',
      'explore',
      'next-steps',
    ]);
    // `isPhase` answers "is this one of the five", so the retired name is not.
    expect(isPhase('deconstruct')).toBe(false);
  });

  // A typo or a model hallucination must not become the active phase.
  it('rejects a phase that is not part of the loop', () => {
    expect(isPhase('brainstorm')).toBe(false);
    expect(isPhase('')).toBe(false);
    expect(isPhase('Idea')).toBe(false);
  });

  // Existing rows carry `deconstruct`, and there was no data migration — so
  // every read path has to resolve it. This is the guarantee that lets those
  // maps keep rendering.
  it('resolves the retired phase name to the phase that replaced it', () => {
    expect(normalizePhase('deconstruct')).toBe('map');
  });

  // A current name resolves to itself, so callers need only one function.
  it('resolves a current phase to itself', () => {
    for (const phase of PHASES) {
      expect(normalizePhase(phase)).toBe(phase);
    }
  });

  // Null rather than a guess: the caller picks its own fallback instead of
  // being handed a phase the stored value never meant.
  it('resolves an unknown phase to null', () => {
    expect(normalizePhase('brainstorm')).toBeNull();
    expect(normalizePhase('')).toBeNull();
    expect(normalizePhase('Deconstruct')).toBeNull();
  });

  // The tool schema validates against this, so an agent that learned the old
  // vocabulary keeps working rather than having its call rejected.
  it('still accepts the retired name as a set_phase argument', () => {
    expect(ACCEPTED_PHASE_NAMES).toContain('deconstruct');
    for (const phase of PHASES) expect(ACCEPTED_PHASE_NAMES).toContain(phase);
  });

  // The labels renumber with the merge. A label out of step with its position
  // is the nav telling the person they are on a different step than they are.
  it('numbers the labels in order from 01', () => {
    PHASES.forEach((phase, i) => {
      expect(PHASE_LABELS[phase]).toMatch(
        new RegExp(`^0${i + 1} `),
      );
    });
  });

  // PHASE_ASK sits beside the labels precisely so it cannot drift from them;
  // a phase with no entry would render an empty footer under a finished round.
  it('has an ask for every phase, pointing only at real phases', () => {
    for (const phase of PHASES) {
      const ask = PHASE_ASK[phase];
      expect(ask.sentence.length).toBeGreaterThan(0);
      if (ask.next) expect(isPhase(ask.next)).toBe(true);
      // An action without somewhere to go would be a dead button.
      if (ask.action) expect(ask.next).not.toBeNull();
    }
  });

  // The two ends of the loop have no page-side button: `idea` has not reached
  // the map yet, and `next-steps` is where the loop arrives.
  it('offers no action at the two ends of the loop', () => {
    expect(PHASE_ASK.idea.action).toBeNull();
    expect(PHASE_ASK['next-steps'].action).toBeNull();
    expect(PHASE_ASK.map.action).toBe('Ready to research →');
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
