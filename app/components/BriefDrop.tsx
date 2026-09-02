'use client';

import type { FetchedBrief } from '@/app/lib/briefFetch';
import BriefLinkBox from './BriefLinkBox';
import BriefPasteBox from './BriefPasteBox';
import BriefReadout from './BriefReadout';

/**
 * What the intake holds once a document is in hand.
 *
 * The same shape a brief route hands back, because it IS that shape — kept as
 * an alias rather than a second declaration so the two can never drift, and
 * kept exported from here because that is where every caller already imports
 * it from.
 */
export type AttachedBrief = FetchedBrief;

/**
 * The way a twenty-page spec gets into a map.
 *
 * Still answers one question — what document, if any, is attached — and shows
 * exactly one thing depending on the answer: the readout, the paste box, the
 * link box, or nothing. That last one used to be a dashed panel advertising
 * drag-and-drop; it is now NOTHING, because the advertisement moved into the
 * attach menu inside the input frame and the drop target became the form
 * itself. At rest this component renders nothing at all, which is what gives
 * the question the screen.
 *
 * The upload and the intake state live in `IdeaPrompt`, the nearest parent that
 * also renders the input the menu sits inside — the menu and the readout are
 * siblings, so their shared state cannot live in either one.
 */
export default function BriefDrop({
  brief,
  pasting,
  linking,
  onAttach,
  onAttachLink,
  onClear,
  onCancelPaste,
  onCancelLink,
}: {
  brief: AttachedBrief | null;
  pasting: boolean;
  linking: boolean;
  onAttach: (brief: AttachedBrief) => void;
  /** Reports the address and nothing else. The fetch belongs to the parent,
   *  which already owns the reading state the upload drives. */
  onAttachLink: (url: string) => void;
  onClear: () => void;
  onCancelPaste: () => void;
  onCancelLink: () => void;
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

  if (linking) {
    return <BriefLinkBox onAttach={onAttachLink} onCancel={onCancelLink} />;
  }

  return null;
}
