'use client';

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
 * Still answers one question — what document, if any, is attached — and shows
 * exactly one of three things depending on the answer. The third thing used to
 * be a dashed panel advertising drag-and-drop; it is now NOTHING, because the
 * advertisement moved into the `+` menu inside the input frame and the drop
 * target became the form itself. At rest this component renders nothing at all,
 * which is what gives the question the screen.
 *
 * The upload and the intake state live in `IdeaPrompt`, the nearest parent that
 * also renders the input the menu sits inside — the menu and the readout are
 * siblings, so their shared state cannot live in either one.
 */
export default function BriefDrop({
  brief,
  pasting,
  onAttach,
  onClear,
  onCancelPaste,
}: {
  brief: AttachedBrief | null;
  pasting: boolean;
  onAttach: (brief: AttachedBrief) => void;
  onClear: () => void;
  onCancelPaste: () => void;
}) {
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
        }}
        onCancel={onCancelPaste}
      />
    );
  }

  return null;
}
