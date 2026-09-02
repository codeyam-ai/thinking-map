'use client';

// One turn in the conversation, and the whole colour rule.
//
// Three treatments, and the difference between them is meaning rather than
// decoration:
//   • the partner — translucent, dim, left. Someone else spoke.
//   • an answer   — solid, in the colour of the CARD it answered, right.
//   • a note      — solid neutral, right. Said about the whole map, so it has
//                   no theme to wear and must not borrow one.
//
// That last pair is the point. Answering a specific card and saying something
// general were already two different acts; until the colour arrived they looked
// identical, and the transcript read as one undifferentiated column.
//
// The colour comes from `themeColor` and never from a hex written here. A card,
// its connector, its cluster label and now its answers are four things that
// must not drift apart, so exactly one function decides what a theme looks
// like.

import { themeColor } from '@/app/lib/themeHue';

export default function BoardChatBubble({
  who,
  text,
  hue,
}: {
  who: 'you' | 'partner';
  text: string;
  /** The hue of the theme this answer's card belongs to, or undefined for a
   *  general note and for an answer whose card can no longer be resolved. */
  hue?: number;
}) {
  const style =
    who === 'partner'
      ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.82)' }
      : hue === undefined
        ? { background: 'rgba(255,255,255,0.92)', color: '#000' }
        : { background: themeColor(hue), color: '#000' };

  return (
    <div
      className={`mb-2.5 flex ${who === 'you' ? 'justify-end' : 'justify-start'}`}
    >
      <span
        className="max-w-[85%] rounded-[14px] px-3 py-2 text-[13px] leading-relaxed"
        style={style}
      >
        {text}
      </span>
    </div>
  );
}
