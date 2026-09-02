// The scripted turn the dev panel replays, and how to read a tool's reply.
//
// Kept out of the component because the sequence is the closest thing this
// project has to a written description of what one agent turn looks like — say
// what you are about to do, read the map, add what you learned, ask the one
// question that would change things, report back — and because reading a
// tool's response is a real parse worth testing rather than a render detail.

/** One step of the demo loop: a real call, and why it is in the script. */
export interface DemoStep {
  name: string;
  input: unknown;
  /** What this step is demonstrating, shown above its reply. */
  note: string;
}

export const DEMO_SEQUENCE: DemoStep[] = [
  {
    name: 'post_note',
    input: { text: 'Looking at what you have so far before I add anything.' },
    note: 'says what it is about to do',
  },
  {
    name: 'read_brief',
    input: {},
    note: 'orients on the brief’s outline before deciding what to pull',
  },
  {
    name: 'read_map',
    input: {},
    note: 'reads the map',
  },
  {
    name: 'add_nodes',
    input: {
      nodes: [
        { ref: 'a', kind: 'assumption', label: 'People reread their own notes' },
        { ref: 'b', kind: 'risk', label: 'Capture friction kills it again' },
      ],
    },
    note: 'adds two nodes',
  },
  {
    name: 'ask_user',
    input: {
      questions: ['What would make you open this on a normal Tuesday?'],
      timeoutSeconds: 30,
    },
    note: 'asks, and waits for you to answer in the panel',
  },
  {
    name: 'add_nodes',
    input: {
      nodes: [
        {
          ref: 'c',
          kind: 'assumption',
          label: 'One tap is enough to beat the notebook',
        },
        {
          ref: 'd',
          kind: 'slice',
          label: 'Capture-only build: one button, no reading',
          detail:
            'About three days. No list, no search, no sync — just the tap and a file on disk.',
          // Names a node created moments earlier in this same call, which is
          // the ordinary case and the reason the link goes through the same
          // ref resolution `parentRef` does.
          tests: 'c',
        },
      ],
    },
    note: 'proposes the smallest slice, and says what it would settle',
  },
  {
    name: 'post_note',
    input: { text: 'Noted — I will keep the capture step to one tap.' },
    note: 'reports back',
  },
];

/** What the panel says instead of replaying the sequence over someone's work. */
export const DEMO_REFUSAL =
  'Not running: the sequence writes fixture nodes ("People reread their own notes"), and this map already has real work on it. Use the tool runner below to make a single deliberate call instead.';

/**
 * Whether replaying the demo sequence here would write fixture content over
 * something real.
 *
 * The guard exists because the sequence's nodes do not LOOK like fixtures —
 * "People reread their own notes" reads exactly like an assumption a person
 * would have written — so a demo run on the wrong map leaves content nobody can
 * identify as fake later. That is not a hypothetical: it is what this whole
 * change is a response to.
 *
 * It reads the event log rather than the rendered map because the log is the
 * structured half of `read_map`'s reply — counting lines of prose meant for an
 * agent to read would break the first time that prose was reworded. `phase.set`
 * is discounted deliberately: `createMap` writes one root `node.added` and the
 * first view change adds a `phase.set`, so a map nobody has touched can already
 * carry two events, and counting those as work would refuse every map.
 *
 * An unreadable reply refuses. The cost of a wrong refusal is a sentence in the
 * call log; the cost of a wrong run is somebody's thinking with two invented
 * nodes in the middle of it.
 */
export function demoWouldOverwrite(result: unknown): boolean {
  const events = (
    result as { structuredContent?: { events?: unknown } } | null | undefined
  )?.structuredContent?.events;
  if (!Array.isArray(events)) return true;

  const substantive = events.filter((event) => {
    const kind = (event as { kind?: unknown } | null)?.kind;
    return typeof kind === 'string' && kind !== 'phase.set';
  });

  return substantive.length > 1;
}

/**
 * The readable part of an MCP tool response.
 *
 * Tools answer in the MCP content shape, and the first text block is what an
 * agent would actually read. Anything else — a malformed reply, an error
 * envelope — is shown as raw JSON rather than swallowed, because a panel that
 * silently renders nothing is worse than one that shows something ugly.
 */
export function resultText(result: unknown): string {
  const content = (result as { content?: { text?: unknown }[] } | null)?.content;
  const first = content?.[0]?.text;
  return typeof first === 'string' ? first : JSON.stringify(result);
}
