import { describe, expect, it } from 'vitest';
import { roundProgress } from './roundProgress';
import type { FlatNode } from './mapLayout';

// The count under a round, and the thing that decides whether the map reaches
// for the next one. Its one real trap is the difference between "open" as the
// map caption means it and "open" as a person answering means it.

function node(id: string, kind: string, status = 'open'): FlatNode {
  return {
    id,
    parentId: 'root',
    kind,
    label: id,
    detail: null,
    status,
    sourceUrl: null,
    order: 0,
  };
}

const noAnswers = new Map<string, string>();

describe('roundProgress', () => {
  // The opening state of a round of questions.
  it('counts every question as open when none are answered', () => {
    const nodes = [
      node('q1', 'open-question'),
      node('q2', 'open-question'),
      node('q3', 'open-question'),
    ];
    expect(roundProgress(nodes, noAnswers)).toEqual({
      questions: 3,
      answered: 0,
      open: 3,
    });
  });

  // The ordinary working state — the "2 of 3 answered" the footer prints.
  it('counts a partly answered round', () => {
    const nodes = [
      node('q1', 'open-question'),
      node('q2', 'open-question'),
      node('q3', 'open-question'),
    ];
    const answers = new Map([
      ['q1', 'Kids aged 6 to 8'],
      ['q2', 'They read below grade level'],
    ]);
    expect(roundProgress(nodes, answers)).toEqual({
      questions: 3,
      answered: 2,
      open: 1,
    });
  });

  // Nothing left to do: this is what opens the next row.
  it('reports nothing open once every question is answered', () => {
    const nodes = [node('q1', 'open-question'), node('q2', 'open-question')];
    const answers = new Map([
      ['q1', 'yes'],
      ['q2', 'no'],
    ]);
    expect(roundProgress(nodes, answers).open).toBe(0);
  });

  // THE TRAP. A goal or assumption the agent has not filled in carries
  // `status: 'open'` and shows in the map's caption as still open — but it has
  // no answer box, so the person cannot clear it. Counting it would leave the
  // loop permanently one short and the next row never reached for.
  it('ignores non-question nodes even when their status says open', () => {
    const nodes = [
      node('n-goal', 'goal', 'open'),
      node('n-assumption', 'assumption', 'open'),
    ];
    expect(roundProgress(nodes, noAnswers)).toEqual({
      questions: 0,
      answered: 0,
      open: 0,
    });
  });

  // A round of pure statements is complete on arrival — there was never
  // anything in it for the person to do.
  it('treats a round of statements as complete', () => {
    const nodes = [node('n1', 'finding', 'answered'), node('n2', 'risk')];
    expect(roundProgress(nodes, noAnswers).open).toBe(0);
  });

  // An answer for a question that is not in THIS round must not count toward
  // it — the answers map spans the whole map, the round does not.
  it('counts only answers belonging to the nodes it was given', () => {
    const nodes = [node('q1', 'open-question')];
    const answers = new Map([
      ['q1', 'here'],
      ['q-from-an-earlier-round', 'elsewhere'],
    ]);
    expect(roundProgress(nodes, answers)).toEqual({
      questions: 1,
      answered: 1,
      open: 0,
    });
  });

  // An empty round is not a half-finished one.
  it('reports an empty round as having nothing to do', () => {
    expect(roundProgress([], noAnswers)).toEqual({
      questions: 0,
      answered: 0,
      open: 0,
    });
  });
});
