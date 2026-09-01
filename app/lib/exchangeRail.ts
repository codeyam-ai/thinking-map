// How the exchange log reads to a person.
//
// `exchangeFormat` renders the same events for an agent, and the two are
// deliberately separate: an agent needs the revision cursor on every line, a
// person needs to know what happened to their map. Pure and apart from the
// components so the phrasing — which is the whole of what the rail says — can
// be pinned by tests rather than read off a screenshot.
//
// The work splits into three rules, each exported so it can be tested alone:
// which events are worth showing at all, how a run of them collapses, and how
// one of them is worded.

import { PHASE_LABELS, isPhase } from './mapKinds';
import type { ExchangeEvent, Origin } from './exchange';

export interface RailEntry {
  /** Stable across re-renders: the last event's id in the run. */
  id: string;
  /** The revision this entry left the map at. */
  revision: number;
  origin: Origin;
  /** What happened, in one clause. */
  text: string;
  /** Free text the side actually wrote, when there is any. Rendered with the
   *  same question emphasis the conversation used to get. */
  note: string | null;
}

function field(payload: unknown, name: string): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The node ids a `question.asked` announced. */
export function questionIds(event: ExchangeEvent): string[] {
  const payload = event.payload as { questions?: { id?: unknown }[] } | null;
  if (!Array.isArray(payload?.questions)) return [];
  return payload.questions
    .map((q) => q?.id)
    .filter((id): id is string => typeof id === 'string');
}

/** The node ids an answer closed. */
export function answeredIds(event: ExchangeEvent): string[] {
  const payload = event.payload as { answers?: { id?: unknown }[] } | null;
  if (!Array.isArray(payload?.answers)) return [];
  return payload.answers
    .map((a) => a?.id)
    .filter((id): id is string => typeof id === 'string');
}

/**
 * The nodes the person has asked about, across the whole log.
 *
 * Read off the log rather than tracked separately, so it stays true across a
 * reload and counts questions asked from any front door — not just the ones the
 * current tab happens to have sent. A malformed or missing `nodeId` is skipped
 * rather than throwing: a question that cannot be attributed should not take
 * the marks off every other node.
 */
export function askedNodeIds(events: ExchangeEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.kind !== 'user.question') continue;
    const nodeId = (event.payload as { nodeId?: unknown } | null)?.nodeId;
    if (typeof nodeId === 'string' && nodeId.length > 0) ids.add(nodeId);
  }
  return ids;
}

/** The first answer's text, which is what a one-question reply should show. */
function firstAnswer(event: ExchangeEvent): string | null {
  const payload = event.payload as { answers?: { answer?: unknown }[] } | null;
  const first = payload?.answers?.[0]?.answer;
  return typeof first === 'string' && first.length > 0 ? first : null;
}

function phaseName(event: ExchangeEvent): string | null {
  const phase = field(event.payload, 'phase');
  if (!phase || !isPhase(phase)) return phase;
  // The nav numbers the phases ("05 Explore"); a sentence should not.
  return PHASE_LABELS[phase].replace(/^\d+\s+/, '');
}

const SIDE: Record<string, string> = { agent: 'Agent', user: 'You' };

function who(origin: Origin): string {
  return SIDE[origin] ?? origin;
}

/** Kinds where a run of consecutive same-origin events reads better as a count
 *  than as one row each. A note or an answer carries distinct text every time,
 *  so those always stand alone. */
const COUNTABLE = new Set(['node.added', 'node.updated']);

/**
 * The events worth showing, with the bookkeeping dropped.
 *
 * Two things are hidden, and both are cases where one act produced two events:
 *
 *  • The `open-question` nodes `ask_user` creates, when a `question.asked`
 *    names them. "Asked two questions" is the half a person can act on; the
 *    node adds are the mechanism underneath it.
 *  • The `node.updated` that closes a question the person just answered. The
 *    answer is the act; flipping the node is its consequence.
 *
 * An agent updating the same node still shows — only the person's own
 * answer-driven close is suppressed.
 */
export function visibleEvents(events: ExchangeEvent[]): ExchangeEvent[] {
  const announced = new Set<string>();
  const resolved = new Set<string>();
  for (const event of events) {
    if (event.kind === 'question.asked') {
      for (const id of questionIds(event)) announced.add(id);
    }
    if (event.kind === 'user.answer') {
      for (const id of answeredIds(event)) resolved.add(id);
    }
  }

  return events.filter((event) => {
    if (event.kind === 'node.added') {
      const id = field(event.payload, 'id');
      return !(id && announced.has(id));
    }
    if (event.kind === 'node.updated' && event.origin === 'user') {
      const id = field(event.payload, 'id');
      const status = field(event.payload, 'status');
      return !(id && resolved.has(id) && status === 'answered');
    }
    return true;
  });
}

/**
 * How far a countable run extends from `start`.
 *
 * An agent turn that writes six nodes is one thing that happened, not six — so
 * consecutive events sharing a kind AND a side collapse into one line. Returns
 * 1 for anything not countable, so the caller can always advance by the result.
 */
export function runLength(visible: ExchangeEvent[], start: number): number {
  const first = visible[start];
  if (!first || !COUNTABLE.has(first.kind)) return 1;

  let end = start;
  while (
    end + 1 < visible.length &&
    visible[end + 1]!.kind === first.kind &&
    visible[end + 1]!.origin === first.origin
  ) {
    end += 1;
  }
  return end - start + 1;
}

/** The line for a collapsed run of adds or updates. A run of one keeps the
 *  node's label, because naming the thing beats counting it. */
export function describeRun(run: ExchangeEvent[]): RailEntry {
  const first = run[0]!;
  const last = run[run.length - 1]!;
  const verb = first.kind === 'node.added' ? 'added' : 'updated';
  const label = field(first.payload, 'label');
  const side = who(first.origin);

  return {
    id: last.id,
    revision: last.revision,
    origin: first.origin,
    text:
      run.length === 1 && label
        ? `${side} ${verb} “${label}”`
        : `${side} ${verb} ${run.length} node${run.length === 1 ? '' : 's'}`,
    note: null,
  };
}

/**
 * The line for one event that does not collapse.
 *
 * The wording IS the interface — it is the only account a person gets of what
 * an agent did to their map — so it lives in one place and is pinned by tests
 * rather than discovered by reading a screenshot.
 */
export function describeEvent(event: ExchangeEvent): RailEntry {
  const side = who(event.origin);
  let text: string;
  let note: string | null = null;

  switch (event.kind) {
    case 'phase.set': {
      const phase = phaseName(event);
      text = phase ? `${side} moved to ${phase}` : `${side} changed the phase`;
      break;
    }
    case 'agent.note':
    case 'user.note':
      text = `${side} left a note`;
      note = field(event.payload, 'text');
      break;
    case 'question.asked': {
      const count = questionIds(event).length;
      text =
        count === 1
          ? `${side} asked a question`
          : `${side} asked ${count} questions`;
      break;
    }
    case 'user.answer': {
      const count = answeredIds(event).length;
      text =
        count === 1
          ? `${side} answered a question`
          : `${side} answered ${count} questions`;
      // Only a single answer can be shown without ambiguity about which
      // question it belongs to.
      note = count === 1 ? firstAnswer(event) : null;
      break;
    }
    case 'user.node': {
      const label = field(event.payload, 'label');
      text = label ? `${side} added “${label}”` : `${side} added a node`;
      break;
    }
    case 'user.question': {
      // Naming the node is the entire difference between this and a note — it
      // is what makes the row read as an exchange about something rather than
      // an unattributed remark. The label is denormalised into the payload at
      // write time, so a node later renamed or deleted still reads as it did
      // when the question was asked.
      const label = field(event.payload, 'label');
      text = label
        ? `${side} asked about “${label}”`
        : `${side} asked about a node`;
      note = field(event.payload, 'text');
      break;
    }
    default:
      text = `${side} — ${event.kind}`;
  }

  return {
    id: event.id,
    revision: event.revision,
    origin: event.origin,
    text,
    note,
  };
}

/** Turn the raw log into the lines the rail shows, oldest first. */
export function railEntries(events: ExchangeEvent[]): RailEntry[] {
  const visible = visibleEvents(events);
  const entries: RailEntry[] = [];

  let index = 0;
  while (index < visible.length) {
    const length = runLength(visible, index);
    entries.push(
      length > 1 || COUNTABLE.has(visible[index]!.kind)
        ? describeRun(visible.slice(index, index + length))
        : describeEvent(visible[index]!),
    );
    index += length;
  }

  return entries;
}
