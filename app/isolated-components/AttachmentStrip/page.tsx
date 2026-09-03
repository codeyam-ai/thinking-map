'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/AttachmentStrip';
import { pastedScreenshot } from '../fixtures';

// What is coming along with the idea, under the prompt on the light intake.
//
// A client component because the props are real `File` objects and a handler.
// The strip owns its own previews through `useFilePreviews`, so these frames
// exercise the actual object-URL path rather than a stubbed src.
//
// The distinction the frames are for: an image is identified by its PICTURE,
// and anything else by a small disc carrying its extension. A pasted
// screenshot is the case that makes this necessary — it arrives named
// "Screenshot <date>.png", which tells the person nothing about which one it
// is, so the thumbnail is the only way to catch a mis-paste before it becomes
// part of a board.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';

  const presets: Record<string, File[]> = {
    // The realistic arrival: the picture of the thing being replaced, and the
    // document describing it. The two kinds have to be tellable apart without
    // reading either name.
    Default: [
      pastedScreenshot(),
      new File(['board notes'], 'board-notes.txt', { type: 'text/plain' }),
    ],
    // One pasted screenshot and nothing else — the state a person lands in the
    // instant after pressing ⌘V, and the one the thumbnail exists for.
    OnePastedImage: [pastedScreenshot()],
    // No pictures at all: two documents, both identified by their extension
    // disc. This is what the strip looked like before images, and it still has
    // to read as a list of things rather than as thumbnails that failed.
    DocumentsOnly: [
      new File(['a'], 'northgate-renewal-brief.pdf', {
        type: 'application/pdf',
      }),
      new File(['b'], 'board-notes.md', { type: 'text/markdown' }),
    ],
    // At the cap — four is the limit, so this is the widest the strip ever
    // gets and the frame where wrapping is actually decided.
    Full: [
      pastedScreenshot('Screenshot 2026-09-03 at 14.22.11.png'),
      pastedScreenshot('Screenshot 2026-09-03 at 14.31.02.png'),
      new File(['a'], 'northgate-renewal-brief.pdf', {
        type: 'application/pdf',
      }),
      new File(['b'], 'board-notes.md', { type: 'text/markdown' }),
    ],
  };

  const files = presets[s];
  if (!files) return <div>Unknown scenario: {s}</div>;

  return (
    // The width of the real prompt it sits under, so wrapping happens where it
    // actually happens rather than at a fabricated width.
    <div id="codeyam-capture">
      <div style={{ width: '100%', maxWidth: 930 }}>
        <Component files={files} busy={false} onRemove={() => {}} />
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
