'use client';

import { useState } from 'react';

// Kept as named constants rather than ternaries inline in the JSX: the two
// tones differ in several values each, and reading them side by side is the
// only way to see that `primary` is a promotion of the same control and not a
// different one.
const PROMPT_CLASS = {
  default:
    'mt-4 rounded-2xl border border-line px-4 py-3 font-mono text-[12px] leading-[1.6]',
  primary:
    'mt-4 rounded-2xl border border-line bg-surface px-4 py-3 font-mono text-[13px] leading-[1.6] break-words',
} as const;

const BUTTON_CLASS = {
  default: 'mt-3 rounded-full border border-ink px-4 py-2 text-[13px] font-semibold',
  primary:
    'mt-3 rounded-full border border-ink bg-lime px-5 py-2.5 text-[14px] font-semibold hover:bg-lime-deep',
} as const;

/**
 * A block of text whose whole purpose is to end up somewhere else.
 *
 * Its own component because it is the only part of the handoff panel with
 * behavior, and the behavior has a failure mode worth being deliberate about:
 * clipboard access can be refused, and a copy button that silently does nothing
 * is worse than one that never claimed to work. The text stays on screen either
 * way, so there is always the select-and-copy path underneath.
 *
 * `tone` exists because the same block has to read as a secondary control in
 * some callers and as the one thing to do on the screen in the handoff band.
 * It defaults to the original appearance so promoting one caller cannot restyle
 * the others.
 */
export default function CopyablePrompt({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  tone = 'default',
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  tone?: 'default' | 'primary';
}) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      <p className={PROMPT_CLASS[tone]}>{text}</p>
      <button
        type="button"
        className={BUTTON_CLASS[tone]}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(text)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {/* The label flip is the entire success signal, so it cannot be only a
            visual one — a live region makes the confirmation audible too. */}
        <span aria-live="polite">{copied ? copiedLabel : label}</span>
      </button>
    </>
  );
}
