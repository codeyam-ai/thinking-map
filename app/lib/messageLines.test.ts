import { describe, expect, it } from 'vitest';
import { splitAssistantLines } from './messageLines';

// The questions ARE the product, so they get typographic weight in the
// conversation panel. This decides which lines get it.
describe('splitAssistantLines', () => {
  // A question is what the partner is asking of the person, so it must be
  // detected for the panel to give it weight.
  it('marks a line ending in a question mark as a question', () => {
    expect(splitAssistantLines('Who is this for?')).toEqual([
      { text: 'Who is this for?', isQuestion: true },
    ]);
  });

  // Ordinary prose must stay ordinary — over-marking would flatten the
  // distinction that makes questions stand out.
  it('leaves a statement unmarked', () => {
    expect(splitAssistantLines('That changes a few things.')).toEqual([
      { text: 'That changes a few things.', isQuestion: false },
    ]);
  });

  // The real shape of an assistant reply: a lead-in sentence followed by the
  // two or three questions worth asking.
  it('splits a multi-line reply and marks only the questions', () => {
    const content =
      'Interesting. Three things I want to understand:\nWho is this for?\nWhat should they learn?';
    expect(splitAssistantLines(content)).toEqual([
      { text: 'Interesting. Three things I want to understand:', isQuestion: false },
      { text: 'Who is this for?', isQuestion: true },
      { text: 'What should they learn?', isQuestion: true },
    ]);
  });

  // A model reply often carries blank lines; rendering them would open gaps
  // in the bubble.
  it('drops blank lines rather than rendering empty paragraphs', () => {
    expect(splitAssistantLines('First.\n\n\nSecond?')).toEqual([
      { text: 'First.', isQuestion: false },
      { text: 'Second?', isQuestion: true },
    ]);
  });

  // Trailing spaces would otherwise defeat the "?" check and lose a question.
  it('trims surrounding whitespace on each line', () => {
    expect(splitAssistantLines('   padded?   ')).toEqual([
      { text: 'padded?', isQuestion: true },
    ]);
  });

  // An empty reply must render nothing rather than an empty bubble.
  it('returns nothing for empty or whitespace-only content', () => {
    expect(splitAssistantLines('')).toEqual([]);
    expect(splitAssistantLines('   \n  \n')).toEqual([]);
  });

  // Only a line that ENDS in "?" is being asked of the person; a question mark
  // inside a sentence is usually quoting them back to themselves.
  it('does not treat a mid-line question mark as a question line', () => {
    expect(splitAssistantLines('You asked "why?" and that is worth keeping.')).toEqual([
      { text: 'You asked "why?" and that is worth keeping.', isQuestion: false },
    ]);
  });
});
