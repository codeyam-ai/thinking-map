// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMapAnswers, type AnswerWriter } from './useMapAnswers';
import type { ExchangeEvent } from '../lib/exchange';

// The optimistic layer is what this hook is for. Answering has to land on the
// card immediately — an answer still sitting in the input after you pressed
// send reads as the answer having been lost — while a write that genuinely
// failed must take it back off, or the card shows an answer the log does not
// have.

let seq = 0;
function answered(id: string, text: string): ExchangeEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    revision: seq,
    kind: 'user.answer',
    origin: 'user',
    payload: { answers: [{ id, answer: text }] },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  } as ExchangeEvent;
}

function answeredWith(
  id: string,
  text: string,
  selected: string[],
  other: string,
): ExchangeEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    revision: seq,
    kind: 'user.answer',
    origin: 'user',
    payload: { answers: [{ id, answer: text, selected, other }] },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  } as ExchangeEvent;
}

const writerThat = (impl: () => Promise<unknown>): AnswerWriter => ({
  answer: vi.fn(impl),
});

describe('useMapAnswers', () => {
  // With nothing answered, every card is still asking.
  it('reports no answers for an empty log', () => {
    const { result } = renderHook(() => useMapAnswers([], writerThat(async () => {})));
    expect(result.current.answers.size).toBe(0);
  });

  // The answers already in the log are what a reloaded page shows.
  it('reads the answers already in the log', () => {
    const events = [answered('q1', 'Just me')];
    const { result } = renderHook(() =>
      useMapAnswers(events, writerThat(async () => {})),
    );
    expect(result.current.answers.get('q1')).toBe('Just me');
  });

  // The optimistic case: the answer is on the card before the write resolves.
  it('shows an answer immediately, before the write completes', async () => {
    let release: (() => void) | undefined;
    const writer = writerThat(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const { result } = renderHook(() => useMapAnswers([], writer));

    let sent: Promise<void>;
    act(() => {
      sent = result.current.answer!('q1', 'Who is it for?', 'Just me');
    });

    await waitFor(() => expect(result.current.answers.get('q1')).toBe('Just me'));

    await act(async () => {
      release!();
      await sent!;
    });
    expect(result.current.answers.get('q1')).toBe('Just me');
  });

  // The rollback. A failed write must not leave the card claiming an answer
  // that was never recorded.
  it('takes the answer back off the card when the write fails', async () => {
    const writer = writerThat(async () => {
      throw new Error('offline');
    });
    const { result } = renderHook(() => useMapAnswers([], writer));

    await act(async () => {
      await expect(
        result.current.answer!('q1', 'Who is it for?', 'Just me'),
      ).rejects.toThrow('offline');
    });

    expect(result.current.answers.has('q1')).toBe(false);
  });

  // A failure on one question must not disturb another that succeeded.
  it('leaves other answers standing when one write fails', async () => {
    const writer: AnswerWriter = {
      answer: vi.fn(async (answers: Record<string, string>) => {
        if ('q2' in answers) throw new Error('offline');
      }),
    };
    const { result } = renderHook(() => useMapAnswers([], writer));

    await act(async () => {
      await result.current.answer!('q1', 'First?', 'Kept');
    });
    await act(async () => {
      await expect(result.current.answer!('q2', 'Second?', 'Lost')).rejects.toThrow();
    });

    expect(result.current.answers.get('q1')).toBe('Kept');
    expect(result.current.answers.has('q2')).toBe(false);
  });

  // The write goes out in the shape the bridge takes: the answer keyed by node
  // id, and the question it belongs to alongside it.
  it('hands the writer the answer and the question it belongs to', async () => {
    const writer = writerThat(async () => {});
    const { result } = renderHook(() => useMapAnswers([], writer));

    await act(async () => {
      await result.current.answer!('q1', 'Who is it for?', 'Just me');
    });

    expect(writer.answer).toHaveBeenCalledWith(
      { q1: 'Just me' },
      [{ id: 'q1', text: 'Who is it for?' }],
      // No parts: a card with no shortlist has no structure to send, and the
      // write must stay exactly the write it was before an answer could be a
      // set.
      undefined,
    );
  });

  // A card with a shortlist sends how the answer was assembled alongside it,
  // keyed by node id so the writer can attach it to the right entry.
  it('hands the writer the parts when the card supplied them', async () => {
    const writer = writerThat(async () => {});
    const { result } = renderHook(() => useMapAnswers([], writer));

    await act(async () => {
      await result.current.answer!(
        'q1',
        'Who is it for?',
        'Teachers — mostly',
        { picked: ['Teachers'], text: 'mostly' },
      );
    });

    expect(writer.answer).toHaveBeenCalledWith(
      { q1: 'Teachers — mostly' },
      [{ id: 'q1', text: 'Who is it for?' }],
      { q1: { picked: ['Teachers'], text: 'mostly' } },
    );
  });

  // The card body still shows the STRING. The parts are for reopening the
  // editor, and letting them near the display would put a raw array on a card.
  it('still shows the answer as text when parts were sent', async () => {
    const writer = writerThat(async () => {});
    const { result } = renderHook(() => useMapAnswers([], writer));

    await act(async () => {
      await result.current.answer!('q1', 'Who?', 'Teachers — mostly', {
        picked: ['Teachers'],
        text: 'mostly',
      });
    });

    expect(result.current.answers.get('q1')).toBe('Teachers — mostly');
  });

  // The parts come back off the log for the pencil to seed itself from.
  it('reads the recorded selections out of the log', () => {
    const events = [answeredWith('q1', 'Teachers — mostly', ['Teachers'], 'mostly')];
    const { result } = renderHook(() =>
      useMapAnswers(events, writerThat(async () => {})),
    );
    expect(result.current.selections.get('q1')).toEqual({
      picked: ['Teachers'],
      text: 'mostly',
    });
  });

  // An answer recorded before the log carried structure has none to report,
  // and the card falls back to reading its text apart rather than opening on
  // an empty selection nobody chose.
  it('reports no selection for an answer that carried none', () => {
    const { result } = renderHook(() =>
      useMapAnswers([answered('q1', 'Just me')], writerThat(async () => {})),
    );
    expect(result.current.selections.has('q1')).toBe(false);
  });

  // Editing an answer is posting another one, so the newer value must win on
  // the card as well as in the log.
  it('replaces an earlier answer with a newer one for the same question', async () => {
    const writer = writerThat(async () => {});
    const { result } = renderHook(() =>
      useMapAnswers([answered('q1', 'Just me')], writer),
    );

    await act(async () => {
      await result.current.answer!('q1', 'Who is it for?', 'The whole street');
    });

    expect(result.current.answers.get('q1')).toBe('The whole street');
  });

  // An isolated scenario has no exchange to write to. The map must still read
  // correctly; it simply offers no way to answer.
  it('offers no way to answer when there is no writer', () => {
    const { result } = renderHook(() =>
      useMapAnswers([answered('q1', 'Just me')], null),
    );
    expect(result.current.answer).toBeUndefined();
    expect(result.current.answers.get('q1')).toBe('Just me');
  });
});
