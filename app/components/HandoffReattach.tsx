import CopyablePrompt from './CopyablePrompt';

/**
 * The way back in, for a map an agent has already worked and then left.
 *
 * Its own component because of the decision it owns: what to DROP. The full
 * band's steps, seed quote and explanatory paragraphs are all written for a
 * first meeting — "no one is on this yet", "copy the prompt, paste it into your
 * agent" — and every one of them is either false or condescending on a map that
 * already has an agent's work on it. What survives is the pair of things still
 * useful to someone reattaching: the prompt naming this map, and the command
 * that opens the door.
 *
 * Keeping that subtraction in a named component is what stops it drifting back.
 * A future edit that wants to "restore the missing explanation here" has to
 * argue with this docstring first, rather than quietly adding a paragraph to a
 * branch inside `AgentHandoff`.
 */
export default function HandoffReattach({
  eyebrow,
  instruction,
  startPrompt,
  mcpCommand,
  dense = false,
}: {
  eyebrow: string;
  instruction: string;
  startPrompt: string;
  mcpCommand: string;
  /**
   * One line instead of a block, for the finished-plan screen.
   *
   * `MapScreen`'s main is an `h-screen` flex column and this strip is
   * `shrink-0`, so every row it takes comes straight out of the sibling's
   * window. On the working map that trade is fine — the map scrolls and the
   * strip is a small fraction of it. On the summary it is not: the summary IS
   * the thing the person came back for, and the full strip was costing it about
   * a quarter of the screen. Same two commands either way; the difference is
   * whether they get their own rows.
   */
  dense?: boolean;
}) {
  if (dense) {
    return (
      // `min-w-0` on the copy cells because they hold long unbroken commands —
      // without it a flex item refuses to shrink below its content and the row
      // pushes the eyebrow off the left edge instead of truncating.
      <section className="shrink-0 rounded-[20px] border border-line bg-surface px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="eyebrow shrink-0">{eyebrow}</h2>
          {/* `flex-1 min-w-0` on both cells, so the two commands SHARE the
              remaining width and truncate rather than letting the long start
              prompt claim the row and push the MCP command onto its own. Each
              cell is itself a flex row so its text and copy button sit side by
              side — the whole strip is then ONE line, which is the entire point
              of this variant. `min-w-0` is the load-bearing half at both levels:
              without it a flex item will not shrink below its content, and
              truncation never gets a chance to happen. */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CopyablePrompt
              text={startPrompt}
              label="Copy start prompt"
              tone="inline"
            />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CopyablePrompt
              text={mcpCommand}
              label="Copy MCP command"
              tone="inline"
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    // A plain border rather than the full band's lime and border-2. This is not
    // the thing on the screen asking to be acted on — the map underneath it is,
    // and outranking it here would recreate the loudness that made the panel
    // worth hiding in the first place.
    <section className="shrink-0 rounded-[20px] border border-line bg-surface p-4">
      <h2 className="eyebrow mb-1">{eyebrow}</h2>
      <p className="text-[15px] leading-[1.35] font-semibold">{instruction}</p>
      {/* Side by side from `sm` up, because this strip sits ABOVE the map and
          every row it costs is a row of the person's own thinking pushed off
          screen. Each block gets its own cell rather than being dropped straight
          into the grid: `CopyablePrompt` renders a fragment, so as direct
          children the four elements would deal out column-wise and put both
          buttons in one column, stretched to its full width. */}
      <div className="grid gap-x-6 sm:grid-cols-2">
        <div>
          <CopyablePrompt text={startPrompt} label="Copy start prompt" />
        </div>
        <div>
          <CopyablePrompt text={mcpCommand} label="Copy MCP command" />
        </div>
      </div>
    </section>
  );
}
