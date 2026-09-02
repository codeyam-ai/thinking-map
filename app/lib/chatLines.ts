// How the log reads to a PERSON.
//
// The sibling of `renderEvents` in `exchangeFormat`, which renders the same log
// for an agent. They are deliberately not one function: an agent needs every
// event with its revision so it can pass a cursor back, and a person needs a
// conversation — which means dropping the kinds that describe the board,
// because the board is right there.
//
// The colour rule lives here too, in the sense that matters: an answer carries
// the id of the node it closed, and a general note does not. That difference is
// what lets the panel show answering-a-card and saying-something-general as the
// two different things they already are, and it is a property of the LOG, not
// of the rendering — hence a pure function with tests rather than a detail
// inside a component.

import type { ExchangeEvent } from './exchange';
import type { GalaxyNodeInput, GalaxyTheme } from './galaxyLayout';

/** One bubble. `nodeId` is the card an answer closed — absent on anything said
 *  about the map as a whole. */
export interface ChatLine {
  who: 'you' | 'partner';
  text: string;
  nodeId?: string;
}

/**
 * Read the exchange log as a conversation.
 *
 * One event can yield SEVERAL lines: a `user.answer` closing three cards is
 * three things said about three different subjects, and joining them into one
 * bubble would ask a single background to be three colours. It can also yield
 * NONE — `node.added`, `theme.added`, `phase.set` and friends are things you
 * can see on the board, and narrating them here would make the panel a
 * changelog of a picture the person is already looking at.
 */
export function chatLines(events: ExchangeEvent[]): ChatLine[] {
  return events.flatMap(lineFor);
}

function lineFor(e: ExchangeEvent): ChatLine[] {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  switch (e.kind) {
    case 'user.note': {
      const text = String(p.text ?? '').trim();
      return text ? [{ who: 'you', text }] : [];
    }
    case 'user.answer': {
      const answers = Array.isArray(p.answers) ? p.answers : [];
      const out: ChatLine[] = [];
      for (const a of answers) {
        const rec = (a ?? {}) as { id?: unknown; answer?: unknown };
        const text = String(rec.answer ?? '').trim();
        if (!text) continue;
        const line: ChatLine = { who: 'you', text };
        if (typeof rec.id === 'string' && rec.id) line.nodeId = rec.id;
        out.push(line);
      }
      return out;
    }
    case 'agent.note': {
      const text = String(p.text ?? '').trim();
      return text ? [{ who: 'partner', text }] : [];
    }
    case 'question.asked': {
      const qs = Array.isArray(p.questions) ? p.questions : [];
      // The recorded shape is `{ id, text }` per question — see the
      // `question.asked` write in `toolRuntime`. Stringifying the object gave
      // every agent-asked question the bubble "[object Object]". A bare string
      // is still accepted because it costs nothing and a log written by an
      // older or hand-rolled caller should degrade to its words, not to noise.
      const asked = qs
        .map((q) =>
          typeof q === 'string'
            ? q.trim()
            : String((q as { text?: unknown })?.text ?? '').trim(),
        )
        .filter(Boolean);
      return asked.length ? [{ who: 'partner', text: asked.join(' · ') }] : [];
    }
    default:
      return [];
  }
}

/**
 * Node id → the hue of the theme it belongs to.
 *
 * Deliberately PARTIAL. A node with no theme, a node whose theme is gone, and a
 * node that no longer exists all simply have no entry, and the caller renders
 * those neutrally. That is the honest treatment: a default colour would claim a
 * theme the answer does not belong to, and an error would break a transcript
 * over a card somebody deleted.
 */
export function hueByNodeId(
  themes: GalaxyTheme[],
  nodes: GalaxyNodeInput[],
): Map<string, number> {
  const hueByTheme = new Map(themes.map((t) => [t.id, t.hue]));
  const out = new Map<string, number>();
  for (const n of nodes) {
    const hue = n.themeId == null ? undefined : hueByTheme.get(n.themeId);
    if (hue !== undefined) out.set(n.id, hue);
  }
  return out;
}
