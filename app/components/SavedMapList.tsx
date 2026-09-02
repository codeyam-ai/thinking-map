'use client';

import { useState } from 'react';
import SavedMapRow, { type SavedMap } from './SavedMapRow';

/** How many rows the strip shows before it asks to be opened. */
const VISIBLE = 3;

/**
 * Maps persist, so returning is a first-class arrival — this is what someone
 * coming back on day three sees above the fold.
 *
 * A strip rather than a section: this list is usually empty and is never the
 * reason someone opened the page, so it no longer spends a section heading's
 * worth of ceremony on itself. Three rows show, the rest are one click away.
 */
export default function SavedMapList({ maps }: { maps: SavedMap[] }) {
  const [expanded, setExpanded] = useState(false);

  if (maps.length === 0) return null;

  const shown = expanded ? maps : maps.slice(0, VISIBLE);

  return (
    // mx-auto, not just max-w. A max-width with no centring anchors the block
    // to the left edge of whatever contains it, so the rows drifted away from
    // the card they belong under while the heading — which centres its own text
    // — stayed put. Narrower than it was, too: this list sits beneath a 440px
    // card, and a row three times that width reads as a different section of
    // the page rather than as an afterthought under the thing you came for.
    <section className="mx-auto mt-16 w-full max-w-[620px]">
      <h2 className="eyebrow mb-4 text-center">Pick up where you left off</h2>
      <ul className="flex flex-col gap-2.5">
        {shown.map((map) => (
          <SavedMapRow key={map.id} map={map} />
        ))}
      </ul>
      {maps.length > VISIBLE && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full text-center text-[13px] text-muted underline-offset-4 transition hover:text-ink hover:underline"
        >
          Show all {maps.length}
        </button>
      ) : null}
    </section>
  );
}
