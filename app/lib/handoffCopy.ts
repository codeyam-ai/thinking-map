// What a map with nobody working on it says for itself, in words.
//
// WebMCP is pull-only. Submitting an idea writes a map; it does not summon
// anyone to think about it. A person who has just typed their idea and landed
// on an empty map has no way to know that, and the tempting thing to show them
// — a spinner, "getting started…" — would be a lie about work that will never
// begin on its own.
//
// So the wording lives here, pure and pinned by tests, rather than as strings
// inside a component where the only way to check it is to look at a screenshot.
// Same argument `askPresence` makes about its own phrasing, and the same reason:
// the wording IS the interface, and a regression here is a person being told
// something is happening when nothing is.

/**
 * One way in, as the panel offers it: a label, the one line that says what this
 * route is, and the single thing to copy if it has one.
 *
 * Tabs rather than a stack because the three doors are ALTERNATIVES — a reader
 * needs exactly one of them, and showing all three at once made the panel read
 * as a wall of instructions in which every line might be the one that applies.
 * One visible block at a time is the shape of "pick your situation".
 */
export interface HandoffAttachTab {
  /** Stable key — the label is copy and may be rewritten; this may not. */
  id: 'browser' | 'agent' | 'claude';
  /** The tab's own label, short enough to sit in a row of three. */
  label: string;
  /** One line: what this route is, and what it takes. */
  body: string;
  /**
   * The one thing to copy on this tab, if any. The browser tab deliberately
   * has none — its whole point is that there is nothing to copy — and encoding
   * that as an ABSENT field rather than an empty string is what stops a
   * renderer drawing an empty box under it.
   */
  copy?: { text: string; label: string };
}

export interface HandoffCopy {
  /** The small label above the panel. */
  eyebrow: string;
  /** What to do about it, at heading weight — the line the panel leads with. */
  instruction: string;
  /**
   * The instruction broken into the two moves it actually takes. Stated as
   * steps because "hand this to your agent" is only obvious to someone who
   * already knows the answer; the person this panel is for does not.
   */
  steps: readonly string[];
  /** Why nothing is working on this map yet. */
  explanation: string;
  /** A prompt the person can copy straight into an agent, naming this map. */
  startPrompt: string;
  /**
   * The one line above the tabs saying what attaching buys — not HOW, which is
   * what the tabs are for.
   *
   * Separate from `explanation` because they answer different questions:
   * `explanation` says why nobody is here, this says why you would want
   * somebody to be.
   */
  attachHint: string;
  /**
   * The three ways in, as tabs — see `HandoffAttachTab`.
   *
   * Ordered browser / any agent / Claude Code, from the route that needs
   * nothing copied to the one that is a single client's shortcut. `agent` is
   * the one the panel opens on: it is the only tab whose answer works for
   * every reader, and the browser tab is the one whose answer is "not you,
   * or you would not be looking at this".
   */
  attachTabs: readonly HandoffAttachTab[];
  /**
   * The MCP door as something an agent can RUN, not prose about it.
   *
   * Flat, and NOT beside a matching `mcpUrl`, because only one caller needs it
   * flat: `HandoffReattach` shows the command with no tabs around it, on a map
   * whose reader has attached before and does not need the three-way choice.
   * The full band reaches the same string through `attachTabs`, so the endpoint
   * has exactly one public spelling per surface and the two cannot drift.
   */
  mcpCommand: string;
}

export interface HandoffCopyInput {
  mapId: string;
  /** Absent or blank for a map started from a document rather than a sentence. */
  seedIdea?: string;
  hasBrief: boolean;
  /**
   * True when an agent has already worked this map and nothing is attached now.
   *
   * Not decoration: "No one is on this yet" is simply false on a map carrying
   * six agent-written nodes, and someone who reads a false sentence about their
   * own map stops trusting the true ones next to it.
   */
  worked?: boolean;
  /**
   * The page's own origin, e.g. `https://example.com` — passed in rather than
   * read off `window` here, which is what keeps this module pure and testable.
   * Absent on the server, where the browser's address is not knowable yet.
   */
  origin?: string;
}

/**
 * `hasBrief` decides which tool the prompt names, which is why it is an
 * argument rather than a branch in the component: a brief-only map has no
 * sentence to quote, and pointing that person at `read_map` would send the
 * agent to the emptier of the two things it could read.
 */
export function handoffCopy({
  mapId,
  seedIdea,
  hasBrief,
  worked = false,
  origin,
}: HandoffCopyInput): HandoffCopy {
  const firstTool = hasBrief ? 'read_brief' : 'read_map';
  const idea = seedIdea?.trim();

  // The same endpoint, spelled the two ways the tabs hand it over. Computed
  // once here rather than inline at each use: the tabs and the flat fields must
  // never be able to disagree about the address, and `HandoffReattach` reads
  // the flat `mcpCommand` while the band reads it through a tab.
  const mcpUrl = origin ? `${origin}/api/mcp` : '/api/mcp';
  // The HTTP form is preferred wherever the origin is known, because it is the
  // door that works from a machine other than this one. `npm run mcp` is the
  // fallback rather than the default: it is correct only for someone sitting in
  // this checkout, and on the server render — where the browser's address has
  // not reached us — it is the one of the two that cannot be wrong.
  const mcpCommand = origin
    ? `claude mcp add --transport http thinking-map ${mcpUrl}`
    : 'npm run mcp';

  return {
    // A map an agent has already worked is not waiting to be discovered, so the
    // eyebrow that opens the full band would be false on it. Both variants say
    // the same true thing about the present moment — nothing is attached — and
    // differ only on whether anything ever was.
    eyebrow: worked ? 'The agent that was here has gone' : 'No one is on this yet',
    // The one sentence the panel previously never said. Copy-and-paste is named
    // as the path that WORKS, not as a fallback: await_new_map only helps an
    // agent already connected and already parked in that call, so for the
    // person reading this, pasting the prompt is the thing that starts the map.
    instruction: worked ? 'Pick this back up' : 'Hand this to your agent',
    steps: [
      'Copy the prompt below.',
      'Paste it into your agent’s chat window.',
    ],
    // Deliberately does not say "an agent is on its way": nothing is attached,
    // and a map cannot call for one. Saying what IS true — the idea is saved,
    // and it waits — is the honest version, and it is also the useful one.
    explanation:
      'Your idea is saved. Nothing is working on it yet — a map cannot summon a thinking partner, so an agent has to come to it.',
    startPrompt: hasBrief
      ? `Work on thinking map ${mapId}. Start with ${firstTool} to read the brief it was started from, then deconstruct it.`
      : `Work on thinking map ${mapId}${
          idea ? ` — "${idea}"` : ''
        }. Start with ${firstTool}, then deconstruct the idea.`,
    // The payoff, once, above the tabs. It used to also carry the two doors and
    // their caveats in the same breath, which is what made the panel read as a
    // wall — the doors are alternatives, so they belong in tabs where a reader
    // sees only the one they need.
    attachHint:
      'Attach an agent and it gets this map’s tools — it can read the brief, add nodes and ask you questions in place, with nothing pasted back and forth.',
    // Ordered by how little they ask of the reader. Every body is ONE sentence:
    // a reader picking a tab has already told us their situation, so the tab's
    // job is to answer it, not to re-explain the other two.
    attachTabs: [
      {
        id: 'browser',
        label: 'MCP-enabled browser',
        // Stated with its limit intact, because `webMcpUnavailableReason` will
        // refuse anything that is not a secure top-level context in a browser
        // implementing WebMCP — so "just use an agentic browser" would be a
        // promise this app cannot keep. The second clause is the honest part:
        // an agent that could already reach this page would have hidden the
        // whole panel, so a reader seeing this tab is being told it is not
        // their route.
        body:
          'A browser that implements WebMCP — Chrome 146+, at the top level, over HTTPS or localhost — drives this map directly, with nothing to copy. If you can read this panel, yours does not.',
      },
      {
        id: 'agent',
        label: 'Any agent',
        // The universal route, which is why the panel opens here. `await_new_map`
        // is named on THIS tab rather than the Claude Code one because it is a
        // property of the server both tabs point at, and this is the tab every
        // reader can act on.
        body:
          'Add this endpoint in your agent’s connector settings. An agent parked on await_new_map then picks up your next idea the moment you submit it, with nothing to copy.',
        copy: { text: mcpUrl, label: 'Copy MCP URL' },
      },
      {
        id: 'claude',
        label: 'Claude Code',
        // A shortcut, and labelled as one. It spells the same endpoint the tab
        // before it hands over raw; nobody needs both, which is exactly why
        // they are tabs and not two blocks stacked.
        body:
          'Run this once and this map’s tools are available in your session.',
        copy: { text: mcpCommand, label: 'Copy MCP command' },
      },
    ],
    mcpCommand,
  };
}
