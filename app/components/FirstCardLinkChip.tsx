'use client';

import type { FetchedBrief } from '@/app/lib/briefFetch';
import { shortenName } from '@/app/lib/attachments';

/**
 * One page the first card is holding, before there is a board to put it on.
 *
 * Its own component, mirroring `FirstCardFileChip`, because the card carries
 * two genuinely different kinds of thing and each deserves to be looked at on
 * its own. This one INVERTS — black on the card's yellow — because it is the
 * brief: the document the board will be ABOUT, rather than something brought
 * along with it. A file's chip is a wash of the same yellow, and that contrast
 * is the whole visual claim; it only survives if the two are shown side by
 * side, which is what having two components makes possible.
 *
 * The name truncates rather than widening. The card is 440px and its controls
 * sit on the row below, so a page whose title runs to a sentence — which is
 * most of them — must not push the send button out of line. The full name
 * stays in the remove button's label, so nothing is actually lost.
 */
export default function FirstCardLinkChip({
  brief,
  onRemove,
}: {
  brief: FetchedBrief;
  onRemove: () => void;
}) {
  return (
    <li className="flex max-w-full items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[12px] text-[#e4ec4b]">
      <span className="truncate">{shortenName(brief.sourceName, 34)}</span>
      <button
        type="button"
        aria-label={`Remove ${brief.sourceName}`}
        onClick={onRemove}
        className="text-[#e4ec4b]/60 hover:text-[#e4ec4b]"
      >
        ×
      </button>
    </li>
  );
}
