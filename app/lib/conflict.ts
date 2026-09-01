// Whether an agent's write is about to erase something the person did.
//
// This is the single most load-bearing decision in the exchange: last-write-wins
// would silently destroy what the human typed, which is the exact failure the
// spine exists to prevent. It lives here, pure, because a rule this important
// should be testable without a database — the executor around it is thin, the
// rule is not.

import type { ExchangeEvent } from './exchange';

/**
 * The user-origin changes to `nodeId` that landed after `expectedRevision`.
 *
 * Empty means the write is safe to apply. Non-empty means the person touched
 * this node since the agent last looked, and the caller must decline rather
 * than overwrite.
 *
 * Three narrowings, each deliberate:
 *   • `origin === 'user'` — an agent's own earlier writes are not a conflict
 *     with itself, and treating them as one would deadlock a retrying agent.
 *   • the payload's `id` must match — a busy map moves its revision constantly,
 *     so "something changed" is far too coarse a test; only a change to THIS
 *     node can clobber THIS write.
 *   • events are assumed to be the delta after `expectedRevision`; the revision
 *     comparison is the caller's, because it already had to read the map.
 */
export function findConflictingChanges(
  events: ExchangeEvent[],
  nodeId: string,
): ExchangeEvent[] {
  return events.filter((event) => {
    if (event.origin !== 'user') return false;
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload || typeof payload !== 'object') return false;
    return payload.id === nodeId;
  });
}

/**
 * True when a write guarded by `expectedRevision` needs checking at all.
 *
 * An unguarded write (no `expectedRevision`) is the agent explicitly saying it
 * does not care, and a map that has not moved cannot have a conflict — so
 * neither case is worth a read.
 */
export function needsConflictCheck(
  expectedRevision: number | undefined,
  currentRevision: number,
): boolean {
  if (typeof expectedRevision !== 'number') return false;
  return currentRevision > expectedRevision;
}
