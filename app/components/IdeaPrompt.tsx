'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import IdeaForm from './IdeaForm';
import SuggestionChips from './SuggestionChips';

/**
 * The entry point: arrive with something vague, leave with a map started.
 *
 * Owns the submit state; the input and the chips are their own components.
 */
export default function IdeaPrompt() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const seedIdea = value.trim();
    if (!seedIdea || busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedIdea }),
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
        onChange={setValue}
        onSubmit={submit}
      />
      {error ? (
        <p role="alert" className="mt-4 text-center text-[13px] text-risk">
          {error}
        </p>
      ) : null}
      <SuggestionChips onPick={setValue} />
    </div>
  );
}
