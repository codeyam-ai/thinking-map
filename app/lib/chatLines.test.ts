import { describe, expect, it } from 'vitest';
import { chatLines, hueByNodeId } from './chatLines';
import type { ExchangeEvent } from './exchange';
import type { GalaxyNodeInput, GalaxyTheme } from './galaxyLayout';

// The panel's whole claim is that answering a card and saying something general
// are two different acts. That difference is carried by the log — an answer
// knows which node it closed — so these tests pin the reading, not the pixels.

function event(partial: Partial<ExchangeEvent>): ExchangeEvent {
  return {
    id: 'e1',
    revision: 1,
    kind: 'node.added',
    origin: 'agent',
    payload: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as ExchangeEvent;
}

function node(partial: Partial<GalaxyNodeInput>): GalaxyNodeInput {
  return {
    id: 'n1',
    themeId: null,
    kind: 'open-question',
    label: 'A question',
    detail: null,
    status: 'open',
    ...partial,
  };
}

function theme(partial: Partial<GalaxyTheme>): GalaxyTheme {
  return { id: 't1', label: 'A theme', hue: 318, order: 0, ...partial };
}

describe('chatLines', () => {
  // A new board has said nothing yet, and that must read as not-yet rather
  // than as a panel that failed to load.
  it('is empty for an empty log', () => {
    expect(chatLines([])).toEqual([]);
  });

  // The kinds this drops are all things you can SEE on the board. Narrating
  // them would make the panel a changelog of a picture you are looking at.
  it('drops the events the board already shows', () => {
    const events = [
      event({ kind: 'node.added', payload: { label: 'A card' } }),
      event({ kind: 'theme.added', payload: { label: 'A theme' } }),
      event({ kind: 'phase.set', payload: { phase: 'explore' } }),
    ];
    expect(chatLines(events)).toEqual([]);
  });

  // The general channel: no node is attached because nothing on the map is
  // being closed, and that absence is what keeps the bubble neutral.
  it('reads a general note as yours, with no node attached', () => {
    const events = [event({ kind: 'user.note', payload: { text: 'Push back' } })];
    expect(chatLines(events)).toEqual([{ who: 'you', text: 'Push back' }]);
  });

  // Both sides of the exchange appear, or the transcript is a monologue and a
  // person answering cards cannot see what was said back.
  it("reads the partner's note as theirs", () => {
    const events = [
      event({ kind: 'agent.note', payload: { text: 'I dropped that branch' } }),
    ];
    expect(chatLines(events)).toEqual([
      { who: 'partner', text: 'I dropped that branch' },
    ]);
  });

  // The point of the whole change: an answer is traceable to its card, which is
  // what lets it be coloured by that card's theme.
  it('carries the node id of the card an answer closed', () => {
    const events = [
      event({
        kind: 'user.answer',
        payload: { answers: [{ id: 'n-who', answer: 'A rota of two or three' }] },
      }),
    ];
    expect(chatLines(events)).toEqual([
      { who: 'you', text: 'A rota of two or three', nodeId: 'n-who' },
    ]);
  });

  // The old reducer joined these into ONE bubble with " · ". Two answers to two
  // differently-themed cards would then want one background to be two colours.
  it('splits one event answering several cards into one line each', () => {
    const events = [
      event({
        kind: 'user.answer',
        payload: {
          answers: [
            { id: 'n-who', answer: 'A rota' },
            { id: 'n-risk', answer: 'Nobody has asked yet' },
          ],
        },
      }),
    ];
    expect(chatLines(events)).toEqual([
      { who: 'you', text: 'A rota', nodeId: 'n-who' },
      { who: 'you', text: 'Nobody has asked yet', nodeId: 'n-risk' },
    ]);
  });

  // An empty answer is a recording artefact, not something anyone said; a
  // blank bubble would read as a message that failed to render.
  it('drops an answer with no words in it', () => {
    const events = [
      event({
        kind: 'user.answer',
        payload: { answers: [{ id: 'n1', answer: '   ' }, { id: 'n2', answer: 'Yes' }] },
      }),
    ];
    expect(chatLines(events)).toEqual([{ who: 'you', text: 'Yes', nodeId: 'n2' }]);
  });

  // An answer recorded without an id is still something the person said; it
  // simply cannot be traced to a card, so it renders as a general remark.
  it('omits the node id when an answer carries none', () => {
    const events = [
      event({ kind: 'user.answer', payload: { answers: [{ answer: 'Yes' }] } }),
    ];
    expect(chatLines(events)).toEqual([{ who: 'you', text: 'Yes' }]);
  });

  // The recorded shape is `{ id, text }`; stringifying it gave every
  // agent-asked question the bubble "[object Object]".
  it('reads asked questions from their text, not their object', () => {
    const events = [
      event({
        kind: 'question.asked',
        payload: {
          questions: [
            { id: 'q1', text: 'Do you reread your notes?' },
            { id: 'q2', text: 'Alone, or shared?' },
          ],
        },
      }),
    ];
    expect(chatLines(events)).toEqual([
      {
        who: 'partner',
        text: 'Do you reread your notes? · Alone, or shared?',
      },
    ]);
  });

  // A log written by an older or hand-rolled caller should degrade to its
  // words rather than to noise — it costs nothing to accept.
  it('still reads a question recorded as a bare string', () => {
    const events = [
      event({ kind: 'question.asked', payload: { questions: ['Alone, or shared?'] } }),
    ];
    expect(chatLines(events)).toEqual([
      { who: 'partner', text: 'Alone, or shared?' },
    ]);
  });

  // Order IS the content of a transcript: a reply that precedes its question
  // says something different from one that follows it.
  it('keeps the log in order across kinds', () => {
    const events = [
      event({ kind: 'agent.note', payload: { text: 'First' } }),
      event({ kind: 'node.added', payload: { label: 'ignored' } }),
      event({ kind: 'user.note', payload: { text: 'Second' } }),
    ];
    expect(chatLines(events).map((l) => l.text)).toEqual(['First', 'Second']);
  });

  // Total over anything the log can hold. A malformed row must cost its own
  // bubble, never the whole conversation.
  it('survives an event whose payload is missing entirely', () => {
    const events = [event({ kind: 'user.note', payload: null })];
    expect(chatLines(events)).toEqual([]);
  });
});

describe('hueByNodeId', () => {
  // The lookup the colour rule rests on — an answer can only wear its card's
  // colour if the card can be traced to a theme.
  it('gives a node the hue of its theme', () => {
    const map = hueByNodeId(
      [theme({ id: 't-who', hue: 318 }), theme({ id: 't-risk', hue: 96 })],
      [node({ id: 'n1', themeId: 't-who' }), node({ id: 'n2', themeId: 't-risk' })],
    );
    expect(map.get('n1')).toBe(318);
    expect(map.get('n2')).toBe(96);
  });

  // Neutral, not broken: a default hue would claim a theme the answer does not
  // belong to.
  it('leaves out a node whose theme is gone', () => {
    const map = hueByNodeId([theme({ id: 't-who' })], [node({ id: 'n1', themeId: 't-gone' })]);
    expect(map.has('n1')).toBe(false);
  });

  // The root idea belongs to no theme. It has no colour to claim, so it must
  // not borrow one.
  it('leaves out a node that belongs to no theme', () => {
    const map = hueByNodeId([theme({ id: 't-who' })], [node({ id: 'n-idea', themeId: null })]);
    expect(map.has('n-idea')).toBe(false);
  });

  // Every answer on a themeless map renders neutral — the ordinary early
  // state of a board, not a failure.
  it('is empty for a map with no themes at all', () => {
    expect(hueByNodeId([], [node({ id: 'n1', themeId: 't-who' })]).size).toBe(0);
  });
});
