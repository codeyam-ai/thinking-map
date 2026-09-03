'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/FirstCardAttachments';
import type { FetchedBrief } from '../../lib/briefFetch';
import { pastedScreenshot } from '../fixtures';

// A client component, not a server one: the props below are event handlers, and
// a server component cannot pass a function across the boundary.
//
// The harness stands up the yellow card these chips sit inside, because the
// whole visual claim being made here is that the link chip INVERTS against it —
// black on yellow, where a browsed file's chip is a wash of the same yellow.
// On a default background that distinction is invisible and the capture proves
// nothing.

const PAGE_BRIEF: FetchedBrief = {
  text: '# Digital Membership Renewal\n\nNorthgate Library District serves 41,000 cardholders.',
  sourceName: 'Digital Membership Renewal — northgate.example.gov/board/renewal-brief',
  mediaType: 'text/html',
  warning: null,
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'LinkAttached';
  const preset: Record<string, { brief: FetchedBrief | null; files: File[] }> = {
    // A page attached and nothing else — the ordinary result of the link door,
    // and the state that shows the name truncating rather than growing.
    LinkAttached: { brief: PAGE_BRIEF, files: [] },
    // The headline state this whole change exists for: a screenshot pasted onto
    // the first card, showing as a picture BEFORE the board is created. A
    // pasted image has no useful filename — the clipboard supplies
    // "Screenshot <date>.png" — so the thumbnail is the only thing that says
    // what was attached, and the only way to catch a mis-paste.
    PastedScreenshot: { brief: null, files: [pastedScreenshot()] },
    // A screenshot alongside a document, which is the realistic arrival: the
    // spec AND the picture of the thing being replaced. The two chips have to
    // stay tellable apart at a glance.
    ScreenshotAndDoc: {
      brief: null,
      files: [pastedScreenshot(), new File(['notes'], 'board-notes.txt')],
    },
    // A short source name, which is what an untitled page or a bare domain
    // gives you. Truncation is for names that need it, not a house style.
    ShortName: {
      brief: { ...PAGE_BRIEF, sourceName: 'northgate.example.gov/spec' },
      files: [],
    },
    // Browsed files only: the pre-existing state, unchanged by the link door,
    // and the contrast that makes the inverted chip mean something.
    FilesOnly: {
      brief: null,
      files: [
        new File([''], 'northgate-renewal-brief.pdf'),
        new File([''], 'board-notes.txt'),
      ],
    },
    // Both at once is a real state — someone can browse for a doc AND point at
    // a page — and the two have to read as different kinds of thing.
    Both: {
      brief: { ...PAGE_BRIEF, sourceName: 'northgate.example.gov/spec' },
      files: [new File([''], 'board-notes.txt')],
    },
    // A filename far longer than its chip, which is the edge case that decides
    // whether either chip can live in a 440px card at all.
    LongFilename: {
      brief: null,
      files: [
        new File(
          [''],
          'northgate-library-digital-membership-renewal-brief-v4-final.pdf',
        ),
      ],
    },
  };
  const config = preset[s];
  if (!config) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9"
        style={{ background: '#e4ec4b' }}
      >
        <Component
          brief={config.brief}
          files={config.files}
          onClearBrief={() => {}}
          onRemoveFile={() => {}}
        />
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
