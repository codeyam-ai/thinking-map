'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import BriefDrop, { type AttachedBrief } from './BriefDrop';
import BriefFileInput from './BriefFileInput';
import IdeaForm from './IdeaForm';
import SuggestionChips from './SuggestionChips';

/**
 * The entry point: arrive with something vague — or with a twenty-page spec —
 * and leave with a map started.
 *
 * Owns the submit state, whatever brief is attached, and the intake around it;
 * the input, the readout and the chips are their own components. The intake
 * state lives here rather than in `BriefDrop` because the `+` menu that drives
 * it sits INSIDE the input frame, making it a sibling of the readout — the two
 * cannot share state held by either. The brief travels in the SAME POST as the
 * idea, so a map and its source document are created together or not at all.
 */
export default function IdeaPrompt() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [brief, setBrief] = useState<AttachedBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pasting, setPasting] = useState(false);
  const [reading, setReading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setReading(true);
    setBriefError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/briefs/extract', {
        method: 'POST',
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not read that file.');
      setBrief({
        text: data.text,
        sourceName: data.sourceName,
        mediaType: data.mediaType,
        warning: data.warning,
      });
      setPasting(false);
    } catch (err) {
      setBriefError(
        err instanceof Error ? err.message : 'Could not read that file.',
      );
    } finally {
      setReading(false);
    }
  }

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
        busy={busy || reading}
        hasBrief={brief !== null}
        attachedName={brief?.sourceName ?? null}
        onChange={setValue}
        onSubmit={submit}
        onChooseFile={() => fileInput.current?.click()}
        onPaste={() => setPasting(true)}
        onDropFile={(file) => void upload(file)}
      />

      {/* The file types still have to be stated somewhere, and one muted line
          under the input costs a fraction of the panel that used to say it. */}
      {brief || pasting ? null : (
        <p className="mt-3 text-center text-[12.5px] text-muted">
          {reading
            ? 'Reading it…'
            : 'PDF, Word, Markdown or plain text — or drop one here'}
        </p>
      )}

      <BriefFileInput
        ref={fileInput}
        error={briefError}
        onFile={(file) => void upload(file)}
      />

      {error ? (
        <p role="alert" className="mt-4 text-center text-[13px] text-risk">
          {error}
        </p>
      ) : null}

      <BriefDrop
        brief={brief}
        pasting={pasting}
        onAttach={(next) => {
          setBrief(next);
          setPasting(false);
        }}
        onClear={() => setBrief(null)}
        onCancelPaste={() => setPasting(false)}
      />

      {/* The chips suggest ideas, and someone who brought a document already
          has one. */}
      {brief ? null : <SuggestionChips onPick={setValue} />}
    </div>
  );
}
