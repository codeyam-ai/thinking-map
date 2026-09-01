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
    name: 'post_note',
    input: { text: 'Noted — I will keep the capture step to one tap.' },
    note: 'reports back',
  },
];

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
