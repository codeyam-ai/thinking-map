import { describe, expect, it } from 'vitest';
import { cardEyebrow } from './cardEyebrow';

// The eyebrow is the only thing on a card that names its state, so a wrong one
// is the card contradicting its own body — most sharply when an answered
// question still calls itself open.

describe('cardEyebrow', () => {
  // The ordinary case: the kind's own label, and nothing else to say.
  it('names the node kind', () => {
    expect(cardEyebrow({ kind: 'finding' })).toBe('Finding');
    expect(cardEyebrow({ kind: 'constraint' })).toBe('Constraint');
  });

  // An unanswered question is open, which is exactly what it should say.
  it('calls an unanswered question open', () => {
    expect(cardEyebrow({ kind: 'open-question' })).toBe('Open');
  });

  // The rule with teeth. Leaving this at "Open" would label the answer printed
  // directly underneath it as unanswered.
  it('calls an answered question answered rather than open', () => {
    expect(cardEyebrow({ kind: 'open-question', answered: true })).toBe('Answered');
  });

  // `answered` is meaningful only on a question — nothing else on the map has
  // an answer, so a statement node must keep its own kind.
  it('leaves a non-question kind alone even when flagged answered', () => {
    expect(cardEyebrow({ kind: 'finding', answered: true })).toBe('Finding');
  });

  // The map is co-authored, so the person's own contributions say so.
  it('badges a node the person wrote', () => {
    expect(cardEyebrow({ kind: 'constraint', origin: 'user' })).toBe(
      'Constraint · yours',
    );
  });

  // The agent's own writes are the default and carry no badge — badging both
  // sides would make the distinction useless.
  it('does not badge a node the agent wrote', () => {
    expect(cardEyebrow({ kind: 'constraint', origin: 'agent' })).toBe('Constraint');
  });

  // Provenance, so it can be seen without opening anything.
  it('marks a node the person has asked about', () => {
    expect(cardEyebrow({ kind: 'goal', asked: true })).toBe('Goal · asked');
  });

  // Where a claim came from, when it came from one identifiable part of the
  // client's brief.
  it('names the brief section a claim came from', () => {
    expect(cardEyebrow({ kind: 'problem', sourceRef: 's7' })).toBe('Problem · §7');
  });

  // The order is fixed so the line reads the same way on every card, with the
  // document reference last because it is the only fact not about the node.
  it('appends every fact in a fixed order', () => {
    expect(
      cardEyebrow({
        kind: 'open-question',
        answered: true,
        origin: 'user',
        asked: true,
        sourceRef: 's3',
      }),
    ).toBe('Answered · yours · asked · §3');
  });

  // A kind the vocabulary does not know is shown as-is rather than blanking the
  // line — a card that cannot name itself is worse than one naming itself oddly.
  it('falls back to the raw kind when the vocabulary has no label', () => {
    expect(cardEyebrow({ kind: 'invented-kind' })).toBe('invented-kind');
  });

  // Absent optional facts must not leave stray separators behind.
  it('leaves no dangling separator when the optional facts are absent', () => {
    expect(cardEyebrow({ kind: 'goal', origin: null, sourceRef: null })).toBe('Goal');
  });
});
