import { describe, expect, it } from 'vitest';
import { askPresence } from './askPresence';

// The honest-copy rule is the load-bearing claim of the ask feature: WebMCP is
// pull-only, so the UI must not imply an answer is coming when nothing is
// attached. These pin that promise as text, because the failure mode is a
// person believing they have been heard when they have not.

describe('askPresence', () => {
  // With someone listening the control should say what it does — ask — rather
  // than the neutral "send" that reads the same in both worlds.
  it('names the agent in the send label when one is listening', () => {
    expect(askPresence(true).sendLabel).toBe('Ask the agent');
  });

  // The whole point: absence is stated, not glossed over.
  it('says plainly that no agent is attached when none is', () => {
    expect(askPresence(false).note).toBe(
      'No agent is attached. This waits in the log until one reads it.',
    );
  });

  // The label has to change too. A send control reading "Ask the agent" with
  // nothing attached is the exact overpromise this module exists to prevent.
  it('drops the promise of a reply from the send label when nothing is attached', () => {
    expect(askPresence(false).sendLabel).toBe('Leave this question');
  });

  // The wake is the real mechanism and worth saying, because it is what makes
  // asking different from leaving a note.
  it('says asking wakes the agent when one is listening', () => {
    expect(askPresence(true).note).toBe('An agent is listening — asking wakes it.');
  });

  // Guarding the negative directly: no branch may promise an answer from an
  // agent that is not there.
  it('never claims an agent will answer when none is attached', () => {
    const { sendLabel, note } = askPresence(false);
    expect(`${sendLabel} ${note}`).not.toMatch(/will answer|is listening|wakes/i);
  });

  // Both branches must be usable copy — an empty string would render as a
  // control with no label and a blank line where the honesty should be.
  it('returns non-empty copy in both states', () => {
    for (const listening of [true, false]) {
      const { sendLabel, note } = askPresence(listening);
      expect(sendLabel.length).toBeGreaterThan(0);
      expect(note.length).toBeGreaterThan(0);
    }
  });

  // The two states must be distinguishable, or the UI is not actually telling
  // the person which case they are in.
  it('says something different in each state', () => {
    expect(askPresence(true)).not.toEqual(askPresence(false));
  });
});
