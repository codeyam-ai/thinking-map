'use client';

import { useState } from 'react';
import BriefMenu from './BriefMenu';
import SendButton from './SendButton';

/**
 * The single free-text input the whole product starts from.
 *
 * With a brief attached the line stops being the idea and becomes the ask —
 * the sentence saying what you want out of the document — so its label, its
 * placeholder and its send button all change to say so, and it becomes
 * optional: the document is enough on its own.
 *
 * The frame carries the intake on the left and the send on the right, and the
 * form itself is the drop target: dropping a document anywhere over the prompt
 * attaches it, which is what lets the dashed panel that used to advertise that
 * disappear.
 */
export default function IdeaForm({
  value,
  busy,
  hasBrief = false,
  attachedName = null,
  onChange,
  onSubmit,
  onChooseFile,
  onPaste,
  onLink,
  onDropFile,
  onDropLink,
  onImages,
  onChooseAttachment,
}: {
  value: string;
  busy: boolean;
  hasBrief?: boolean;
  attachedName?: string | null;
  onChange: (next: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onChooseFile: () => void;
  onPaste: () => void;
  onLink: () => void;
  onDropFile: (file: File) => void;
  /** A link dragged out of another tab. Separate from `onDropFile` because it
   *  arrives as an address rather than bytes, and is fetched rather than read. */
  onDropLink: (url: string) => void;
  /** Images that arrived by paste or drop. Plural because a drop can carry
   *  several at once and refusing all but the first would be a silent loss. */
  onImages?: (files: File[]) => void;
  /** Pick images to attach; anything else is a brief. Optional so the form
   *  still renders in isolation, where no parent is holding attachments. */
  onChooseAttachment?: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  const label = hasBrief
    ? 'What do you want out of this brief?'
    : 'What would you like to figure out?';
  const send = hasBrief ? 'Start on this brief' : 'Start thinking this through';

  return (
    <form
      onSubmit={onSubmit}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) {
          // Images and documents part ways here. A dropped image is something
          // brought ALONG with the idea and joins the strip; a dropped document
          // is what the idea is ABOUT and becomes the brief, exactly as it did
          // before. The split is by media type rather than by which door the
          // file came through, because a person dropping a screenshot and a
          // scope doc together means both, and taking only the first would lose
          // one of them silently.
          const images = files.filter((f) => f.type.startsWith('image/'));
          const documents = files.filter((f) => !f.type.startsWith('image/'));
          if (images.length) onImages?.(images);
          // Still one brief. It is write-once per map by design, so the second
          // document in a drop has nowhere to go.
          if (documents.length) onDropFile(documents[0]);
          return;
        }
        // Dragging a tab, a bookmark or a link out of another window yields no
        // file at all — it yields `text/uri-list`, which is why dropping a page
        // on this form used to do nothing at all. `text/plain` is the fallback
        // for the sources that only set that one, and it is accepted only when
        // it actually parses as an address: dropping a sentence should still
        // do nothing rather than attach a brief nobody asked for.
        const list = e.dataTransfer.getData('text/uri-list');
        const dropped =
          list.split('\n').find((line) => line.trim() && !line.startsWith('#')) ??
          e.dataTransfer.getData('text/plain');
        if (!dropped) return;
        try {
          const { protocol } = new URL(dropped.trim());
          if (protocol === 'http:' || protocol === 'https:') {
            onDropLink(dropped.trim());
          }
        } catch {
          // Not an address. Nothing to attach, and nothing to say about it.
        }
      }}
      className="relative"
    >
      <label htmlFor="idea" className="sr-only">
        {label}
      </label>
      <input
        id="idea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // The clipboard gesture lands wherever focus is, and on this screen
        // focus is the input — so the handler sits on the input rather than
        // behind a control of its own. There is deliberately no "paste an
        // image here" box: ⌘V is the whole interface, and a box advertising it
        // would be a second place to do the thing you just did.
        //
        // It inspects the items for an image and ignores everything else, so
        // pasting TEXT still types into the field exactly as it always has.
        // Only an image calls preventDefault, and only then, because a paste
        // that swallowed a pasted sentence would break the primary use of this
        // input to serve the secondary one.
        onPaste={(e) => {
          const images = Array.from(e.clipboardData?.items ?? [])
            .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
            .flatMap((item) => {
              const file = item.getAsFile();
              return file ? [file] : [];
            });
          if (images.length === 0) return;
          e.preventDefault();
          onImages?.(images);
        }}
        disabled={busy}
        placeholder={
          hasBrief
            ? 'What do you want out of it? (optional)'
            : 'I want to build an educational game for kids…'
        }
        // `pl-44` reserves the width of the attach control, which sits inside
        // this frame at `left-3` rather than beside it. The two numbers move
        // together: a labelled trigger is wider than the `+` it replaced, and
        // leaving the old `pl-16` would run the placeholder underneath it.
        className={`h-[76px] w-full rounded-full border-[1.5px] bg-surface pl-44 pr-24 text-[16px] text-ink outline-none transition placeholder:text-muted focus:border-ink disabled:opacity-60 ${
          dragging ? 'border-ink bg-paper' : 'border-ink'
        }`}
      />
      <BriefMenu
        busy={busy}
        attachedName={attachedName}
        onChooseFile={onChooseFile}
        onChooseImage={onChooseAttachment}
        onPaste={onPaste}
        onLink={onLink}
      />
      <SendButton
        size="large"
        disabled={busy || (!hasBrief && value.trim().length === 0)}
        label={send}
      />
    </form>
  );
}
