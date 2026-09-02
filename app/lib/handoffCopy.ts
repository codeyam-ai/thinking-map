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
  /** The two ways to attach an agent so this stops being manual. */
  attachHint: string;
  /**
   * The MCP door as something an agent can RUN, not prose about it.
   *
   * `attachHint` names both doors and explains why there are two, which is the
   * right thing for a person to read. It is the wrong thing to hand an agent:
   * one that has just been told where the door is still has to guess the
   * command. This is that command, and it goes through the same copyable block
   * as the start prompt because it has the same job — to end up somewhere else.
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
    attachHint:
      'Attach one two ways: a browser agent (Chrome 146+, top-level, secure context), or the MCP server (npm run mcp, or /api/mcp) — where an agent parked on await_new_map picks up the next idea the moment it is submitted, with nothing to copy.',
    // The HTTP form is preferred wherever the origin is known, because it is
    // the door that works from a machine other than this one. `npm run mcp` is
    // the fallback rather than the default: it is correct only for someone
    // sitting in this checkout, and on the server render — where the browser's
    // address has not reached us — it is the one of the two that cannot be
    // wrong.
    mcpCommand: origin
      ? `claude mcp add --transport http thinking-map ${origin}/api/mcp`
      : 'npm run mcp',
  };
}
