// What asking about a node promises, in words.
//
// WebMCP is pull-only. A contribution wakes an agent already parked on
// `await_user_activity`, and does nothing whatsoever for an agent that is not
// attached. That distinction is the one thing this feature could genuinely
// mislead about, so the copy that draws it lives here — pure, and pinned by
// tests — rather than as a ternary inside a component where the only way to
// check it is to look at a screenshot.
//
// The same argument `exchangeRail` makes about its own phrasing: the wording IS
// the interface, and a regression here is a person being told an answer is
// coming when nobody is listening.

export interface AskPresence {
  /** The send control's accessible label. */
  sendLabel: string;
  /** The line under the field saying what will actually happen. */
  note: string;
}

/**
 * `listening` is "an agent is attached", NOT "an agent is idle" — a bridge
 * mid-tool-call still sees the question when its turn comes back round, so
 * `working` counts as listening just as `connected` does. Only genuine absence
 * takes the other branch.
 */
export function askPresence(listening: boolean): AskPresence {
  if (listening) {
    return {
      sendLabel: 'Ask the agent',
      note: 'An agent is listening — asking wakes it.',
    };
  }
  return {
    sendLabel: 'Leave this question',
    // Deliberately does not say "an agent will answer": nothing is attached, so
    // promising a reply would be the misleading thing.
    note: 'No agent is attached. This waits in the log until one reads it.',
  };
}
