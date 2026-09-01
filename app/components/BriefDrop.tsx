'use client';

import { useState } from 'react';
import BriefDropTarget from './BriefDropTarget';
import BriefPasteBox from './BriefPasteBox';
import BriefReadout from './BriefReadout';

/** What the intake holds once a document is in hand. */
export interface AttachedBrief {
  text: string;
  sourceName: string;
  mediaType: string;
  /** Whatever extraction wanted the person to know, or null. */
  warning: string | null;
}

/**
 * The way a twenty-page spec gets into a map.
 *
 * Owns one question — what document, if any, is attached — and shows exactly
 * one of three things depending on the answer: the readout of an attached
 * brief, the paste box, or the drop target. Extraction happens over the wire
 * because reading a PDF is a server's job; nothing is persisted by it, so a
 * brief the person discards leaves nothing behind.
 */
export default function BriefDrop({
  brief,
  onAttach,
  onClear,
}: {
  brief: AttachedBrief | null;
  onAttach: (brief: AttachedBrief) => void;
  onClear: () => void;
}) {
  const [pasting, setPasting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/briefs/extract', {
        method: 'POST',
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not read that file.');
      onAttach({
        text: data.text,
        sourceName: data.sourceName,
        mediaType: data.mediaType,
        warning: data.warning,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  if (brief) return <BriefReadout brief={brief} onClear={onClear} />;

  if (pasting) {
    return (
      <BriefPasteBox
        onAttach={(text) => {
          // A paste needs no extraction, so it can never carry a warning —
          // the person is looking at exactly what they gave us.
          onAttach({
            text,
            sourceName: 'pasted',
            mediaType: 'text/plain',
            warning: null,
          });
          setPasting(false);
        }}
        onCancel={() => setPasting(false)}
      />
    );
  }

  return (
    <BriefDropTarget
      busy={busy}
      error={error}
      onFile={(file) => void upload(file)}
      onPaste={() => setPasting(true)}
    />
  );
}
