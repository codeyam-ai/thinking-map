'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  extractBriefFromFile,
  fetchBriefFromLink,
  type BriefAttempt,
} from '@/app/lib/briefFetch';
import { readJson } from '@/app/lib/readJson';
import BriefDrop, { type AttachedBrief } from './BriefDrop';
import BriefFileInput from './BriefFileInput';
import IdeaForm from './IdeaForm';
import InlineError from './InlineError';
import IntakeHint from './IntakeHint';
import SuggestionChips from './SuggestionChips';

/**
 * The entry point: arrive with something vague — or with a twenty-page spec —
 * and leave with a map started.
 *
 * Owns the submit state, whatever brief is attached, and the intake around it;
 * the input, the readout and the chips are their own components. The intake
 * state lives here rather than in `BriefDrop` because the attach menu that
 * drives it sits INSIDE the input frame, making it a sibling of the readout —
 * the two cannot share state held by either. The brief travels in the SAME POST
 * as the idea, so a map and its source document are created together or not at
 * all.
 *
 * Three doors in, one landing place: a file, pasted text, or a link. Only the
 * link needs the server to go and get it, and that retrieval is guarded in
 * `briefUrl.ts` rather than here — a browser cannot be trusted with the
 * decision and, thanks to CORS, cannot make the request either.
 */
export default function IdeaPrompt() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [brief, setBrief] = useState<AttachedBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The command a failing route offered, when it offered one. Development
   *  only, because that is where the classifier fills the field at all. */
  const [fix, setFix] = useState<string | null>(null);

  const [pasting, setPasting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [reading, setReading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * The half both doors share: run the request, then land whatever came back.
   *
   * The reading itself is `briefFetch`'s job — both routes answer with the
   * identical body shape and `FirstCard` reads them the same way, so the
   * parsing lives in one module rather than once per component. What stays
   * here is only what is local: which flags to lower, and where the error goes.
   */
  async function attach(attempt: () => Promise<BriefAttempt>) {
    setReading(true);
    setBriefError(null);
    try {
      const { brief: next, error } = await attempt();
      if (!next) {
        setBriefError(error);
        return;
      }
      setBrief(next);
      setPasting(false);
      setLinking(false);
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
    setFix(null);
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
      const { data, error, failure } = await readJson<{ id: string }>(
        response,
        'Could not start a map.',
      );
      if (!data) {
        // A route that named the fix gets to offer it. The classifier already
        // withholds this outside development, so there is no second check here
        // — in production the field is simply absent.
        setFix(typeof failure?.command === 'string' ? failure.command : null);
        throw new Error(error ?? 'Could not start a map.');
      }
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
        onPaste={() => {
          setLinking(false);
          setPasting(true);
        }}
        onLink={() => {
          setPasting(false);
          setLinking(true);
        }}
        onDropFile={(file) => void attach(() => extractBriefFromFile(file))}
        // A dropped link goes straight to the fetch. Opening the link box
        // pre-filled would ask the person to confirm the address they just
        // dragged, which is a question they already answered.
        onDropLink={(url) => void attach(() => fetchBriefFromLink(url))}
      />

      {/* The file types still have to be stated somewhere, and one muted line
          under the input costs a fraction of the panel that used to say it. */}
      {brief || pasting || linking ? null : <IntakeHint reading={reading} />}

      <BriefFileInput
        ref={fileInput}
        error={briefError}
        onFile={(file) => void attach(() => extractBriefFromFile(file))}
      />

      <InlineError message={error} command={fix} className="mt-4" />

      <BriefDrop
        brief={brief}
        pasting={pasting}
        linking={linking}
        onAttach={(next) => {
          setBrief(next);
          setPasting(false);
          setLinking(false);
        }}
        onAttachLink={(url) => void attach(() => fetchBriefFromLink(url))}
        onClear={() => setBrief(null)}
        onCancelPaste={() => setPasting(false)}
        onCancelLink={() => setLinking(false)}
      />

      {/* The chips suggest ideas, and someone who brought a document already
          has one. */}
      {brief ? null : <SuggestionChips onPick={setValue} />}
    </div>
  );
}
