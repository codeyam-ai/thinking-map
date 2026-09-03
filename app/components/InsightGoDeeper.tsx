'use client';

/**
 * Asking the partner to go further on this one insight.
 *
 * Two prompts and a box. The prompts FILL the box and never send it — the rule
 * `AnswerChips` and `SuggestionChips` already hold, for the same reason: a
 * prompt that submitted would turn "dig into this" into a menu of two approved
 * questions, when the whole point of the box is that the person asks their own.
 *
 * The composer is `NodeQuestionComposer` in its dark tone rather than a second
 * composer written for the board. What is substantial there — the `user.question`
 * write, the drag guard, and the send control that says whether anybody is
 * actually listening — is the part a copy would drift away from first.
 */
import { useState } from 'react';
import InsightSectionLabel from './InsightSectionLabel';
import NodeQuestionComposer from './NodeQuestionComposer';

/** Two, not four. These are a way of starting to type; a longer list reads as
 *  the set of things it is permissible to ask. */
const DEEPER_PROMPTS = ['Why do you think that?', 'What would settle it?'];

export default function InsightGoDeeper({
  nodeId,
  label,
  onClose,
}: {
  nodeId: string;
  /** The insight's own claim, so the composer says what is being asked about. */
  label: string;
  /** Collapsing the card this sits in — what the composer's × means here. */
  onClose: () => void;
}) {
  const [prefill, setPrefill] = useState<string | undefined>(undefined);

  return (
    // The whole section swallows clicks: everything in it — a prompt, the
    // field, the send control — is a reason to have opened the card, never a
    // reason to close it again.
    <section data-no-pan onClick={(event) => event.stopPropagation()}>
      <InsightSectionLabel className="mb-2">Go deeper</InsightSectionLabel>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {DEEPER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setPrefill(prompt)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/45 hover:text-white"
          >
            {prompt}
          </button>
        ))}
      </div>
      <NodeQuestionComposer
        nodeId={nodeId}
        label={label}
        tone="dark"
        prefill={prefill}
        onClose={onClose}
      />
    </section>
  );
}
