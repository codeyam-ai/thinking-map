'use client';

import { useCallback, useRef, useState } from 'react';

export interface PendingQuestion {
  id: string;
  text: string;
}

/** What `ask_user` resolves with: the questions, paired with what was said. */
export type AnsweredQuestion = PendingQuestion & { answer: string };

export interface AskUser {
  /** Questions an agent is waiting on right now. Empty when nothing is pending. */
  pending: PendingQuestion[];
  /** Park an agent's turn until the person answers or the clock runs out. */
  ask(questions: PendingQuestion[], timeoutMs: number): Promise<AnsweredQuestion[] | null>;
  /** Release a parked turn. A no-op when nothing is waiting, which is the
   *  ordinary case — a person answering a question on the map need not know
   *  whether an agent happens to be blocked on it. */
  settle(answers: AnsweredQuestion[] | null): void;
}

/**
 * The `ask_user` promise lifecycle.
 *
 * Separate from the log because it is a different clock: the log is a durable
 * record that outlives everyone, while this is one agent's turn parked in
 * memory for as long as it is willing to wait. Giving up costs nothing — the
 * questions stay on the map and the answer lands in the log for the next read —
 * which is exactly why the two are not one piece of state.
 */
export function useAskUser(onSettled?: () => void): AskUser {
  const [pending, setPending] = useState<PendingQuestion[]>([]);

  // Held in a ref because the promise has to be resolved from an event handler
  // that must not re-render to work.
  const waiting = useRef<{
    resolve: (answers: AnsweredQuestion[] | null) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const settle = useCallback(
    (answers: AnsweredQuestion[] | null) => {
      const current = waiting.current;
      if (!current) return;
      clearTimeout(current.timer);
      waiting.current = null;
      setPending([]);
      onSettled?.();
      current.resolve(answers);
    },
    [onSettled],
  );

  const ask = useCallback(
    (questions: PendingQuestion[], timeoutMs: number) =>
      new Promise<AnsweredQuestion[] | null>((resolve) => {
        // A second ask while one is outstanding releases the first as
        // unanswered rather than stranding its promise forever.
        settle(null);
        setPending(questions);
        const timer = setTimeout(() => settle(null), timeoutMs);
        timer.unref?.();
        waiting.current = { resolve, timer };
      }),
    [settle],
  );

  return { pending, ask, settle };
}
