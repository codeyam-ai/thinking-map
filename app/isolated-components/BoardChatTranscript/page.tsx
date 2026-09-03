import Component from '../../../app/components/BoardChatTranscript';
import type { ComponentProps } from 'react';
import type { ChatLine } from '../../../app/lib/chatLines';

type Props = ComponentProps<typeof Component>;

// Hues as `hueForIndex` hands them out for themes 0, 1 and 2, written as
// literals so a scenario cannot drift if the sequence is re-anchored.
const HUES = new Map([
  ['n-who', 318],
  ['n-broken', 96],
  ['n-money', 233],
]);

/** Three answers to three differently-themed cards, the partner among them, and
 *  a general note last: three hues and one neutral bubble, which is the whole
 *  rule in one picture.
 *
 *  The lines are deliberately SHORT. The transcript is bounded and pins to the
 *  newest turn, so a fixture with realistic-length answers pushes the first hue
 *  above the fold — and a frame whose whole job is showing three hues at once
 *  cannot afford to show two. Length is exercised by LongAnswer instead, and
 *  overflow by Overflowing. */
const MIXED: ChatLine[] = [
  { who: 'partner', text: 'Who turns up? And who pays?' },
  { who: 'you', text: 'A rota of two or three', nodeId: 'n-who' },
  { who: 'you', text: 'Only if it covers breakage', nodeId: 'n-broken' },
  { who: 'you', text: 'A shared fund', nodeId: 'n-money' },
  { who: 'you', text: 'Change direction — who shows up, not what breaks' },
];

const scenarios: Record<string, Props> = {
  // Three hues and one neutral, with the partner's turns between them. Every
  // rule the panel has, in one frame.
  Default: { lines: MIXED, hueByNode: HUES },

  // An answer whose card has been deleted since. Neutral, not broken — and
  // indistinguishable from the general note beneath it, which is correct: with
  // no theme to name, there is nothing to say about it.
  DeletedTheme: {
    lines: [
      { who: 'you', text: 'A rota of two or three', nodeId: 'n-who' },
      {
        who: 'you',
        text: 'Said before that card came off the board',
        nodeId: 'n-gone',
      },
      { who: 'you', text: 'Change direction — it is about who shows up' },
    ],
    hueByNode: HUES,
  },

  // A map with no themes yet — the ordinary early state. Every answer renders
  // neutral, and that has to look deliberate rather than like colour failing.
  NoThemesYet: {
    lines: [
      {
        who: 'partner',
        text: 'What were you hoping to get out of the record?',
      },
      {
        who: 'you',
        text: 'To find a half-remembered idea again months later',
        nodeId: 'n-q0',
      },
    ],
    hueByNode: new Map(),
  },

  // The length people actually write, at the width it has to wrap in. Long
  // answers were the case that made a 720px bar feel fine and a 360px panel
  // worth checking.
  LongAnswer: {
    lines: [
      {
        who: 'you',
        text: 'A rota of two or three, plus whoever turns up curious — but the honest answer is that it has been me every Saturday since March, and that is exactly the fragile bit nobody has said out loud yet.',
        nodeId: 'n-who',
      },
      {
        who: 'partner',
        text: 'Then the question is not who turns up, it is what happens the first Saturday you cannot.',
      },
    ],
    hueByNode: HUES,
  },

  // Long enough to overflow, which is what the max height and the pin-to-newest
  // exist for: the newest turn must be the one you are looking at.
  Overflowing: {
    lines: [...MIXED, ...MIXED, ...MIXED],
    hueByNode: HUES,
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = 'Default' } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // The panel's own ground and width. On white, or at any other width, the
  // wrapping and the colour contrast are both answering a question nobody asked.
  return (
    <div id="codeyam-capture" style={{ background: '#0a0a0b', width: 360 }}>
      <Component {...props} />
    </div>
  );
}
