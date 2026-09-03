'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  extractBriefFromFile,
  fetchBriefFromLink,
  type BriefAttempt,
} from '@/app/lib/briefFetch';
import { readJson } from '@/app/lib/readJson';
import { admitFiles } from '@/app/lib/attachments';
import AttachmentStrip from './AttachmentStrip';
import BriefDrop, { type AttachedBrief } from './BriefDrop';
import BriefFileInput, { ACCEPT_IMAGES } from './BriefFileInput';
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
  const imageInput = useRef<HTMLInputElement>(null);

  /**
   * Images held in browser memory until there is a map to attach them to.
   *
   * The brief travels in the SAME POST as the idea and always will — a map and
   * the document it is about are created together or not at all. Attachments
   * cannot: they are bytes, and the route that stores them is addressed by a
   * map id that does not exist yet. So they wait here, and are uploaded in the
   * gap between `POST /api/maps` answering and the push to the board.
   */
  const [pending, setPending] = useState<File[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  /** Take images in, refuse the ones that cannot land, and preview the rest.
   *  The rules are `admitFiles`, shared with the upload route so both doors
   *  refuse in the same words; what is local here is the object URL each
   *  accepted file needs in order to be previewed. */
  function addImages(files: File[]) {
    setPending((was) => {
      const { accepted, error } = admitFiles(was, files);
      setAttachError(error);
      return [...was, ...accepted];
    });
  }

  function removePending(name: string) {
    setAttachError(null);
    // No object URL to revoke here: `useFilePreviews` owns that lifecycle, and
    // dropping the file from this list is what tells it to let the URL go.
    setPending((was) => was.filter((file) => file.name !== name));
  }

  /**
   * Upload what is pending onto the map that was just created.
   *
   * Deliberately does NOT throw, and deliberately does not undo the map. The
   * map exists by this point and is the thing the person asked for; losing it
   * because the third screenshot was refused would be a far worse trade than
   * landing on a board with two of three pictures and a sentence saying so.
   */
  async function uploadPending(mapId: string): Promise<string | null> {
    let failed: string | null = null;
    for (const file of pending) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`/api/maps/${mapId}/attachments`, {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          failed = body?.error ?? `Could not attach ${file.name}.`;
        }
      } catch {
        failed = `Could not attach ${file.name}.`;
      }
    }
    return failed;
  }

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
      // Between the map existing and arriving at it. The attachments route is
      // addressed by a map id, so this is the earliest moment the images can
      // go anywhere — and the last moment before the browser holding them
      // navigates away.
      if (pending.length) {
        // A refusal is reported and then GONE PAST, on purpose. The map exists
        // by now and is the thing the person asked for; staying on this screen
        // to complain about the third screenshot would leave them looking at a
        // send button that would create a SECOND map. They land on the board
        // with what did attach, and the board's own strip is where a missing
        // one gets added — the same control, against a map that now exists.
        await uploadPending(data.id);
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
        onChooseAttachment={() => imageInput.current?.click()}
        onImages={addImages}
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

      {/* What is coming along with the idea, before there is a map to put it
          on. Above the hint, because it is a statement of fact about this
          screen's current state and the hint is only instructions. */}
      <AttachmentStrip files={pending} busy={busy} onRemove={removePending} />

      <InlineError message={attachError} className="mt-3" />

      {/* The file types still have to be stated somewhere, and one muted line
          under the input costs a fraction of the panel that used to say it. */}
      {brief || pasting || linking ? null : <IntakeHint reading={reading} />}

      <BriefFileInput
        ref={fileInput}
        error={briefError}
        onFile={(file) => void attach(() => extractBriefFromFile(file))}
      />

      {/* Its own picker rather than a mode on the brief's: the two accept
          different types and land in different places, and one input toggling
          between them would be a state nobody can see. */}
      <input
        ref={imageInput}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) addImages(picked);
          // Reset so choosing the same file twice still fires a change.
          e.target.value = '';
        }}
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
