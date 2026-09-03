'use client';

import { useCallback, useMemo, useState } from 'react';
import { answersByNodeId, selectionsByNodeId } from '../lib/mapAnswers';
import type { ExchangeEvent } from '../lib/exchange';
import type { AnswerSelection } from '../lib/answerDraft';

/** Just enough of the bridge to record an answer. Narrowed deliberately: this
 *  hook has no business with tools, status, or the rest of the bridge, and a
 *  narrow shape is what lets a test hand it a function instead of a context. */
export interface AnswerWriter {
  answer(
    answers: Record<string, string>,
    questions?: { id: string; text: string }[],
    /** The same answer taken apart, keyed by question id. Optional: a caller
     *  with nothing structured to say omits it and the write is byte-identical
     *  to what it was before an answer could be a set. */
    parts?: Record<string, AnswerSelection>,
  ): Promise<unknown>;
}

export interface MapAnswers {
  /** Every question's current answer — from the log, plus anything written in
   *  this tab that the log has not caught up to. */
  answers: Map<string, string>;
  /** Record an answer. Absent when there is no writer, which is the isolated
   *  case: the card still reads correctly, it simply cannot be answered. */
  answer?: (
    id: string,
    label: string,
    text: string,
    parts?: AnswerSelection,
  ) => Promise<void>;
  /** How each answer was assembled, where the log recorded it. The pencil
   *  prefers this over reading the text back apart, because it is what the
   *  person actually did rather than an inference about how it was written. */
  selections: Map<string, AnswerSelection>;
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

  // The parts are read straight from the log with no optimistic layer over
  // them. They are only ever consumed when the pencil OPENS, which is long
  // after a write has landed — and the card that just answered already holds
  // its own draft, so there is nothing for an optimistic selection to fix.
  const selections = useMemo(() => selectionsByNodeId(events), [events]);

  const answer = useCallback(
    async (id: string, label: string, text: string, parts?: AnswerSelection) => {
      if (!writer) return;
      // The optimistic layer stays on the display STRING. It exists so the card
      // turns over the instant you press Save, and the string is the only part
      // the card shows.
      setPending((current) => ({ ...current, [id]: text }));
      try {
        await writer.answer(
          { [id]: text },
          [{ id, text: label }],
          parts ? { [id]: parts } : undefined,
        );
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

  return { answers, selections, answer: writer ? answer : undefined };
}
