'use client';

// The chat, over the map but out of its way.
//
// It replaced a thin bar at the bottom, and the difference is not cosmetic. A
// bar reads as a control belonging to the board — one more widget beside the
// zoom buttons — and what you typed into it vanished with no trace that anyone
// had heard you. A panel says the true thing: this is the conversation, the map
// is what the conversation has produced so far, and what you say here applies
// to all of it rather than to whichever card is nearest.
//
// It sits in a CORNER rather than across the middle because the map is the
// thing being talked about, and a transcript that grows until it covers the
// subject has stopped being a conversation about anything you can see. Hence
// three states rather than two: open, collapsed to the input row, and closed to
// a single pill — closed still one click from typing, because "the chat is
// always here" is the claim the input row makes.
//
// What is left in this file is the arrangement: which of the three states the
// panel is in, and what that state composes. The reading of the log, the colour
// of a bubble, and the composer's draft each live with the piece that owns
// them.

import { useMemo, useState } from 'react';
import BoardChatComposer from './BoardChatComposer';
import BoardChatHeader from './BoardChatHeader';
import BoardChatPill from './BoardChatPill';
import BoardChatTranscript from './BoardChatTranscript';
import { chatLines, hueByNodeId } from '@/app/lib/chatLines';
import type { ExchangeEvent } from '@/app/lib/exchange';
import type { GalaxyNodeInput, GalaxyTheme } from '@/app/lib/galaxyLayout';

/** open → the transcript; collapsed → the input row only; closed → a pill. */
type View = 'open' | 'collapsed' | 'closed';

export default function BoardChat({
  events,
  onSend,
  trailing,
  themes = [],
  nodes = [],
}: {
  events: ExchangeEvent[];
  onSend: (text: string) => void;
  /** The round control, when there is a round to end. */
  trailing?: React.ReactNode;
  /** The map's themes and nodes, so an answer can be traced back to the card it
   *  answered and wear that card's colour. Both default to empty: a bubble
   *  whose node cannot be resolved is an ordinary bubble, not an error. */
  themes?: GalaxyTheme[];
  nodes?: GalaxyNodeInput[];
}) {
  const [view, setView] = useState<View>('open');

  const lines = useMemo(() => chatLines(events), [events]);
  const hueByNode = useMemo(() => hueByNodeId(themes, nodes), [themes, nodes]);

  const send = (text: string) => {
    onSend(text);
    // Saying something is a reason to see the conversation: a turn that landed
    // behind a collapsed panel is indistinguishable from one that did not land.
    setView('open');
  };

  if (view === 'closed') {
    return (
      <div className="pointer-events-auto absolute bottom-6 right-6 z-30" data-no-pan>
        <BoardChatPill onOpen={() => setView('open')} />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-6 right-6 z-30 w-[min(360px,calc(100%-3rem))]"
      data-no-pan
    >
      <div className="overflow-hidden rounded-[22px] border border-white/12 bg-black/85 backdrop-blur-md">
        <BoardChatHeader
          open={view === 'open'}
          onToggle={() => setView((v) => (v === 'open' ? 'collapsed' : 'open'))}
          onClose={() => setView('closed')}
        />

        {view === 'open' && lines.length > 0 ? (
          <BoardChatTranscript lines={lines} hueByNode={hueByNode} />
        ) : null}

        <BoardChatComposer onSend={send} />

        {/* The round control gets its own row. In a 720px bar it rode beside the
            input; at this width "Next round →" and a text field cannot share a
            line without one of them becoming unusable. */}
        {trailing ? (
          <div className="flex items-center justify-between gap-2 border-t border-white/8 px-4 py-2.5">
            {trailing}
          </div>
        ) : null}
      </div>
    </div>
  );
}
