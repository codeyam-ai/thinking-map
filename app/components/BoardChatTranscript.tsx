'use client';

// The transcript: every turn in order, pinned to the newest.
//
// The pinning is not a nicety. A transcript that keeps its scroll position
// while new turns arrive below the fold is a transcript you have to chase, and
// the panel's job is to let someone see the shape of what they have already
// said without working for it.
//
// It is bounded rather than growing: this sits over the map, and a conversation
// that grows until it covers the thing it is about has stopped being a
// conversation about anything you can see.

import { useEffect, useRef } from 'react';
import BoardChatBubble from './BoardChatBubble';
import type { ChatLine } from '@/app/lib/chatLines';

export default function BoardChatTranscript({
  lines,
  hueByNode,
}: {
  lines: ChatLine[];
  /** Node id → its theme's hue. Partial by design: a missing entry is what
   *  makes a bubble neutral, so a deleted card costs its colour, not the
   *  transcript. */
  hueByNode: Map<string, number>;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div ref={scroller} className="max-h-[260px] overflow-y-auto px-4 pb-2">
      {lines.map((l, i) => (
        <BoardChatBubble
          key={i}
          who={l.who}
          text={l.text}
          hue={l.nodeId ? hueByNode.get(l.nodeId) : undefined}
        />
      ))}
    </div>
  );
}
