import CopyablePrompt from './CopyablePrompt';

/**
 * The nudge for a map an agent can see but has not been asked to work.
 *
 * Its own component for the same reason `HandoffReattach` is: it owns a
 * subtraction. The full lime band explains how to ATTACH an agent — two doors,
 * an MCP command, a prompt naming the map by id — and every one of those is
 * already solved for the person reading this. Their agent is attached. What
 * they are missing is one sentence to send it.
 *
 * So this keeps exactly that, and the note explaining why it is still needed.
 * Quieter than the lime band on purpose: it marks a page that is working, not
 * one that is stuck.
 */
export default function AgentStartCue({
  eyebrow,
  instruction,
  note,
  prompt,
  dense = false,
}: {
  eyebrow: string;
  instruction: string;
  note: string;
  prompt: string;
  /** One row instead of a block, matching `HandoffReattach`'s dense variant —
   *  `MapScreen`'s main is an `h-screen` flex column, so rows here come
   *  straight out of the map underneath. */
  dense?: boolean;
}) {
  if (dense) {
    return (
      <section className="shrink-0 rounded-[20px] border border-line bg-surface px-4 py-2">
        {/* `min-w-0` at both levels: a flex item will not shrink below its
            content, so without it the prompt claims the row and pushes the
            eyebrow off the left edge instead of truncating. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="eyebrow shrink-0">{eyebrow}</h2>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CopyablePrompt text={prompt} label={instruction} tone="inline" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="shrink-0 rounded-[20px] border border-line bg-surface p-5">
      <h2 className="eyebrow">{eyebrow}</h2>
      <p className="mt-1 text-[17px] font-semibold text-ink">{instruction}</p>
      <p className="mt-1 text-[13px] text-muted">{note}</p>
      <div className="mt-3">
        <CopyablePrompt text={prompt} label="Copy start prompt" />
      </div>
    </section>
  );
}
