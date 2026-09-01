'use client';

import { useState } from 'react';

/**
 * A block of text whose whole purpose is to end up somewhere else.
 *
 * Its own component because it is the only part of the handoff panel with
 * behavior, and the behavior has a failure mode worth being deliberate about:
 * clipboard access can be refused, and a copy button that silently does nothing
 * is worse than one that never claimed to work. The text stays on screen either
 * way, so there is always the select-and-copy path underneath.
 */
export default function CopyablePrompt({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      <p className="mt-4 rounded-2xl border border-line px-4 py-3 font-mono text-[12px] leading-[1.6]">
        {text}
      </p>
      <button
        type="button"
        className="mt-3 rounded-full border border-ink px-4 py-2 text-[13px] font-semibold"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(text)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? copiedLabel : label}
      </button>
    </>
  );
}
