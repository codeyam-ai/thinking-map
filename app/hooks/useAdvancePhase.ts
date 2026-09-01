'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PHASE_LABELS, type Phase } from '../lib/mapKinds';

/** Just enough of the bridge to leave a note. Narrowed deliberately, the way
 *  `AnswerWriter` is: this has no business with tools or status, and a narrow
 *  shape is what lets a test hand it a function instead of a context. */
export interface NoteWriter {
  (kind: 'user.note', payload: unknown): Promise<void>;
}

export interface AdvancePhase {
  advance(): Promise<void>;
  busy: boolean;
  /** Set when the phase write did not land. Null the rest of the time. */
  error: string | null;
}

/**
 * Moving the map to its next phase, from the page.
 *
 * This is the first page-side caller of `set_phase` — until now the phase only
 * ever moved because an agent moved it, which meant a person who had answered
 * everything had to go to the other window and ask.
 *
 * The ORDER is the interesting part and the reason this is a hook rather than
 * an inline handler. The note goes on the log BEFORE the phase moves, so an
 * agent reading the log finds a sentence saying what was decided rather than a
 * phase that silently changed under it. If the phase write then fails, the
 * record of the decision still stands; the reverse — a phase that moved with
 * nothing explaining why — is the state worth avoiding.
 */
export function useAdvancePhase(
  next: Phase | null,
  mapId?: string,
  contribute?: NoteWriter,
): AdvancePhase {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = useCallback(async () => {
    if (!next || !mapId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await contribute?.('user.note', {
        text: `Moving the map on to ${PHASE_LABELS[next]}.`,
      });
      const res = await fetch(`/api/maps/${mapId}/tools`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'set_phase', input: { phase: next } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // The phase is server-rendered, so the page has to be told to re-read it.
      router.refresh();
    } catch {
      // Deliberately not "nothing happened": the note usually DID land, and
      // telling someone their note was lost when it is on the log would be its
      // own small lie.
      setError('That did not go through. The note is on the log either way.');
    } finally {
      setBusy(false);
    }
  }, [next, mapId, busy, contribute, router]);

  return { advance, busy, error };
}
