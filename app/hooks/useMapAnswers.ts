'use client';

import { useCallback, useMemo, useState } from 'react';
import { answersByNodeId } from '../lib/mapAnswers';
import type { ExchangeEvent } from '../lib/exchange';

/** Just enough of the bridge to record an answer. Narrowed deliberately: this
 *  hook has no business with tools, status, or the rest of the bridge, and a
 *  narrow shape is what lets a test hand it a function instead of a context. */
export interface AnswerWriter {
  answer(
    answers: Record<string, string>,
    questions?: { id: string; text: string }[],
  ): Promise<unknown>;
}

export interface MapAnswers {
  /** Every question's current answer — from the log, plus anything written in
   *  this tab that the log has not caught up to. */
  answers: Map<string, string>;
  /** Record an answer. Absent when there is no writer, which is the isolated
   *  case: the card still reads correctly, it simply cannot be answered. */
  answer?: (id: string, label: string, text: string) => Promise<void>;
}

/**
 * What every question on the map has been answered, and how to answer one.
 *
 * The optimistic layer is the whole reason this is a hook rather than a call to
 * `answersByNodeId`. The answer has to take the card's body the moment it is
 * sent — an answer still sitting in the input after you pressed send reads as
 * the answer having been lost — but it must come back out if the write actually
 * failed, or the card would show an answer the log does not have.
 *
 * The pending entry is deliberately never cleared on success. The log catches
 * up on its own, and the two values agree by then; clearing it early would open
 * a window where the card has dropped the optimistic answer and not yet been
 * handed the real one, which flickers the question back to unanswered.
 */
export function useMapAnswers(
  events: ExchangeEvent[],
  writer?: AnswerWriter | null,
): MapAnswers {
  const [pending, setPending] = useState<Record<string, string>>({});

  const answers = useMemo(() => {
    const logged = answersByNodeId(events);
    // Pending wins: it is this tab's newer knowledge of the same fact.
    for (const [id, text] of Object.entries(pending)) logged.set(id, text);
    return logged;
  }, [events, pending]);

  const answer = useCallback(
    async (id: string, label: string, text: string) => {
      if (!writer) return;
      setPending((current) => ({ ...current, [id]: text }));
      try {
        await writer.answer({ [id]: text }, [{ id, text: label }]);
      } catch (error) {
        setPending((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        throw error;
      }
    },
    [writer],
  );

  return { answers, answer: writer ? answer : undefined };
}
