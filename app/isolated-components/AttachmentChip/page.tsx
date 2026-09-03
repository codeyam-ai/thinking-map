'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/AttachmentChip';

// One thing brought along, as it sits on the board.
//
// A client component, not a server one: the chip takes an `onRemove` handler,
// and a function cannot cross the server boundary — the same reason the other
// chip harnesses here are client components.
//
// The frames separate the two states this chip is FOR: a thumbnail means there
// is a file the partner can open, a paperclip means there is a recorded name
// and nothing behind it. Both are legitimate — the second is what every
// attachment made before this board could hold files looks like — and telling
// them apart at a glance is the chip's whole job.
//
// The ids below are rows in this scenario's own seed, so the picture is served
// by the real byte route rather than mocked. An id not in the seed would render
// a broken image, which is the honest outcome and the reason these ids are the
// seed's own.

const WHITEBOARD = {
  id: 'att-whiteboard',
  name: 'whiteboard-photo.png',
  mediaType: 'image/png',
  byteSize: 1563,
  hasBytes: true,
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';

  const presets: Record<
    string,
    { attachment: typeof WHITEBOARD; busy: boolean }
  > = {
    // The state the whole feature exists to produce: a picture on the board,
    // not a filename standing in for one.
    Default: { attachment: WHITEBOARD, busy: false },

    // No file behind the name. It has to read as an ordinary part of the
    // thinking rather than as an image that failed to load — there is no
    // picture because none was ever stored. Note also what is absent: a row
    // with no bytes states no size, because "0KB" would be a claim about a
    // file that does not exist.
    LegacyNameOnly: {
      attachment: {
        id: 'att-handover-notes',
        name: 'shift-handover-notes.pdf',
        mediaType: 'application/octet-stream',
        byteSize: 0,
        hasBytes: false,
      },
      busy: false,
    },

    // The middle case, and the one that fixes the meaning of the paperclip: a
    // document that DOES have bytes. It carries a size where the legacy row
    // carries none, so the icon reads as nothing-to-look-at rather than as
    // no-file-here.
    Document: {
      attachment: {
        id: 'att-notes',
        name: 'call-back-log.txt',
        mediaType: 'text/plain',
        byteSize: 3_400,
        hasBytes: true,
      },
      busy: false,
    },

    // The name that will not fit. A truncated name still has to be
    // identifiable enough to remove the right one, which is the only reason
    // the chip truncates rather than growing and pushing its neighbours along.
    LongName: {
      attachment: {
        ...WHITEBOARD,
        id: 'att-long',
        name: 'practice-management-system-evaluation-2024-final-v3.png',
      },
      busy: false,
    },

    // Mid-save. The remove control is disabled so a second click cannot race
    // the first — the list is being written to the database as this renders.
    Busy: { attachment: WHITEBOARD, busy: true },
  };

  const preset = presets[s];
  if (!preset) return <div>Unknown scenario: {s}</div>;

  // The chip is an <li>, and it lives on the board's near-black canvas — on a
  // default background its white-on-transparent border and text are invisible
  // and the capture would prove nothing.
  return (
    <div id="codeyam-capture" style={{ background: '#000', padding: 28 }}>
      <ul
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          margin: 0,
          padding: 0,
        }}
      >
        <Component
          mapId="map-galaxy"
          attachment={preset.attachment}
          busy={preset.busy}
          onRemove={() => {}}
        />
      </ul>
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
