// What the person has already said, and what they might say.
//
// Both feed the one affordance on a question card: the recorded answer it shows
// back, and the chips it offers to start from.
//
// The answer is read off the exchange log rather than stored on the node, and
// that is deliberate — `resolveAnswered` in `app/lib/contributions.ts` flips a
// question to `answered` and never keeps the text, because the text belongs to
// the log where both sides can see it. Editing an answer is therefore just
// posting another `user.answer`, and the edit history is free.
//
// Modelled directly on `askedNodeIds` in `app/lib/exchangeRail.ts`: a per-node
// fact derived from the log, so it stays true across a reload and counts what
// happened at every front door rather than only in this tab.

import type { ExchangeEvent } from './exchange';

/**
 * The latest answer per question id.
 *
 * Latest, not first: answering again is how an answer is edited, and the
 * server already logs the second answer without inventing a second change. So
 * the last one written is the one that stands.
 *
 * A malformed entry is skipped rather than throwing — one bad payload should
 * not blank every other answer on the map.
 */
export function answersByNodeId(events: ExchangeEvent[]): Map<string, string> {
  const answers = new Map<string, string>();

  for (const event of [...events].sort((a, b) => a.revision - b.revision)) {
    if (event.kind !== 'user.answer') continue;
    const payload = event.payload as {
      answers?: { id?: unknown; answer?: unknown }[];
    } | null;
    if (!Array.isArray(payload?.answers)) continue;

    for (const entry of payload.answers) {
      const id = entry?.id;
      const answer = entry?.answer;
      if (typeof id !== 'string' || id.length === 0) continue;
      if (typeof answer !== 'string' || answer.trim().length === 0) continue;
      answers.set(id, answer);
    }
  }

  return answers;
}

/**
 * The suggested answers stored on a node, as chips.
 *
 * SQLite has no array type, so the column holds a JSON array of strings. A
 * value that is missing, malformed, or not an array of strings yields no chips
 * at all: a card with no options is just a card with an input, which is the
 * ordinary case rather than a degraded one, so there is nothing to report.
 */
export function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (option): option is string =>
        typeof option === 'string' && option.trim().length > 0,
    );
  } catch {
    return [];
  }
}
