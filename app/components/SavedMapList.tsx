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
    <section className="mt-8 w-full max-w-[930px] lg:mt-12">
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
