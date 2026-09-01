'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import BriefDrop, { type AttachedBrief } from './BriefDrop';
import IdeaForm from './IdeaForm';
import SuggestionChips from './SuggestionChips';

/**
 * The entry point: arrive with something vague — or with a twenty-page spec —
 * and leave with a map started.
 *
 * Owns the submit state and whatever brief is attached; the input, the intake
 * and the chips are their own components. The brief travels in the SAME POST
 * as the idea, so a map and its source document are created together or not at
 * all.
 */
export default function IdeaPrompt() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [brief, setBrief] = useState<AttachedBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const seedIdea = value.trim();
    // A brief on its own is enough to start from; a blank form is not.
    if ((!seedIdea && !brief) || busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedIdea,
          ...(brief
            ? {
                brief: {
                  text: brief.text,
                  sourceName: brief.sourceName,
                  mediaType: brief.mediaType,
                },
              }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not start a map.');
      router.push(`/map/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a map.');
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[930px]">
      <IdeaForm
        value={value}
        busy={busy}
        hasBrief={brief !== null}
        onChange={setValue}
        onSubmit={submit}
      />
      {error ? (
        <p role="alert" className="mt-4 text-center text-[13px] text-risk">
          {error}
        </p>
      ) : null}
      <BriefDrop
        brief={brief}
        onAttach={setBrief}
        onClear={() => setBrief(null)}
      />
      {/* The chips suggest ideas, and someone who brought a document already
          has one. */}
      {brief ? null : <SuggestionChips onPick={setValue} />}
    </div>
  );
}
