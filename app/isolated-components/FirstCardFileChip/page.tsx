'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/FirstCardFileChip';
import { useFilePreviews } from '../../hooks/useFilePreviews';
import { pastedScreenshot } from '../fixtures';

// One file the first card is carrying, before there is a board to put it on.
//
// A client component, not a server one: the props are a `File` and an event
// handler, and neither crosses the server boundary. That is also what makes
// these frames honest — the preview URL is minted by the real hook, in the
// browser, exactly as it is on the landing screen.
//
// The harness stands up the yellow card behind the chip, because the whole
// visual claim is that this chip is a wash of the card's own colour, in
// deliberate contrast to the link chip that inverts to black. On a default
// background that distinction is invisible.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Image';

  const presets: Record<string, File> = {
    // The headline: a pasted screenshot, shown as a picture. A pasted image
    // has no useful filename — the clipboard supplies "Screenshot <date>.png"
    // — so the thumbnail is the only thing identifying it.
    Image: pastedScreenshot(),
    // A document, which has a name worth reading and no picture worth showing.
    // The absence of a thumbnail is the difference, and it has to read as a
    // different KIND of thing rather than as an image that failed.
    Document: new File(['board notes'], 'board-notes.txt', {
      type: 'text/plain',
    }),
    // A filename far longer than its chip. It must truncate rather than widen,
    // because the card's own controls sit on the row below and a chip that
    // grows pushes them out of line.
    LongName: pastedScreenshot(
      'northgate-library-digital-membership-renewal-brief-v4-final.png',
    ),
  };

  const file = presets[s];
  // Hooks must run unconditionally, so the preview is built before the unknown
  // -scenario branch rather than after it.
  const previews = useFilePreviews(file ? [file] : []);
  if (!file) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9"
        style={{ background: '#e4ec4b' }}
      >
        <ul className="flex flex-wrap gap-2">
          <Component
            file={file}
            previewUrl={previews[file.name]}
            onRemove={() => {}}
          />
        </ul>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <Harness />
    </Suspense>
  );
}
