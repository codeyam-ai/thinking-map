'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BriefMenu';

// A client component, not a server one: the props below are event handlers, and
// a server component cannot pass a function across the boundary.
//
// The menu positions itself absolutely against the input frame it lives in, so
// the harness stands that frame up: same 76px height, same rounded border, same
// 930px column the landing screen gives it. Without it the button would render
// against the viewport origin and the capture would say nothing about how it
// sits inside the prompt.
//
// The OPEN state is internal to the component and cannot be set through props,
// so it is not a scenario here — it is demonstrated on the landing application
// scenario, where the menu is driven for real.
const scenarios: Record<string, { busy: boolean; attachedName: string | null }> =
  {
    // The resting state, and what almost every arrival sees: a labelled attach
    // control at the left of the prompt, which is the whole brief intake now.
    // The label is what the bare `+` could not do — say what the door takes,
    // which is why drag-and-drop read as missing while it worked all along.
    Default: { busy: false, attachedName: null },
    // A document in hand. The button stops inviting one and names the one it
    // has, which is the state the dashed panel used to make obvious.
    Attached: { busy: false, attachedName: 'northgate-renewal-brief.pdf' },
    // A long filename has to truncate rather than push the input's text out of
    // the frame — the chip is capped at 160px for exactly this.
    LongFilename: {
      busy: false,
      attachedName:
        'northgate-library-digital-membership-renewal-brief-v4-final.pdf',
    },
    // While a file is being read, offering to read another is a way to lose the
    // first one, so the trigger dims and will not open.
    Busy: { busy: true, attachedName: null },
  };

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      {/* An explicit width, not `width: 100%`: the capture wrapper is a
          shrink-to-fit flex item, and this frame has no intrinsic content to
          give it width — 930px is the column the landing screen actually
          gives the prompt. */}
      <div style={{ width: 930, maxWidth: '100%' }}>
        <div className="relative h-[76px] w-full rounded-full border-[1.5px] border-ink bg-surface">
          <Component
            busy={props.busy}
            attachedName={props.attachedName}
            onChooseFile={() => {}}
            onPaste={() => {}}
            onLink={() => {}}
          />
        </div>
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
