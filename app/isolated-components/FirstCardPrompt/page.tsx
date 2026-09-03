'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/FirstCardPrompt';

// A client component, not a server one: the props below include event handlers,
// and a server component cannot pass a function across the boundary.
//
// The harness stands up the lime card this section fills the top of. Every
// frame here is an ALIGNMENT question, and alignment is only legible against
// the card's real width — a sentence that wraps at 440px is the whole point,
// and at any other width it would wrap somewhere else and prove nothing.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, { value: string; busy: boolean }> = {
    // The empty card, as someone arriving meets it. The question sits at the
    // top left and "Type here…" sits under it on the same left edge — the
    // frame that says the centring is gone.
    Default: { value: '', busy: false },
    // One line, the shortest real thing anyone types. Nothing wraps yet, so
    // this is the frame where left and centred would look nearly the same —
    // which is exactly why it is not the only one here.
    ShortIdea: { value: 'Handover between shifts at a small vet practice', busy: false },
    // The frame this whole change exists for: a sentence long enough to wrap.
    // Every line starts at the same x, and it is a FIXED x — the card used to
    // recentre the text on every keystroke, so the words already typed slid
    // sideways while you were still writing the next ones.
    // Sized to fill the field's three rows exactly. The field does not grow —
    // it is `rows={3}` and `resize-none` — so a longer value would be cut
    // mid-phrase here and the frame would read as a bug rather than as the
    // alignment demonstration it is.
    WrappedIdea: {
      value:
        'Our vets lose things between the morning and evening shift, and every handover drops something that mattered.',
      busy: false,
    },
    // Mid-submit. The field locks so a second return cannot start a second
    // board, and the text must stay readable while it is disabled rather than
    // greying out into the yellow.
    Busy: {
      value: 'Handover between shifts at a small vet practice',
      busy: true,
    },
  };
  const config = preset[s];
  if (!config) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9"
        style={{ background: '#e4ec4b', minHeight: 520 }}
      >
        <Component
          value={config.value}
          busy={config.busy}
          onChange={() => {}}
          onSubmit={() => {}}
          onPasteFiles={() => {}}
          // Off here only. A browser refuses to autofocus inside a cross-origin
          // frame, which is what the capture harness is, and the refusal is a
          // console error that fails the frame. Nobody types into a screenshot.
          autoFocus={false}
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
