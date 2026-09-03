import Component from '../../../app/components/BoardChatBubble';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof Component>;

// The hues are the ones `hueForIndex` hands out for themes 0, 1 and 2, written
// as literals so a scenario cannot silently drift if the sequence is ever
// re-anchored — the point of these frames is that the bubble matches the CARD,
// and a fixture that recomputed the hue could never show that failing.
const WHO = 318;
const BROKEN = 96;
const MONEY = 233;

const scenarios: Record<string, Props> = {
  // An answer wearing its card's colour. The ordinary case, and the whole rule.
  Default: {
    who: 'you',
    text: 'A rota of two or three, plus whoever is curious',
    hue: WHO,
  },

  // The same act against a different theme. Read beside Default, these two are
  // the argument for the rule: same shape, same side, different subject.
  SecondTheme: {
    who: 'you',
    text: 'Only if it covers breakage',
    hue: BROKEN,
  },

  // The third hue, because two colours could be a coincidence of palette and
  // three is a sequence.
  ThirdTheme: {
    who: 'you',
    text: 'A shared fund — nobody wants to be the one asking',
    hue: MONEY,
  },

  // Said about the whole map, so it belongs to no theme and must not borrow
  // one. Solid, so it still reads as YOURS — the neutrality is about subject,
  // not about authorship.
  GeneralNote: {
    who: 'you',
    text: 'Change direction — this is really about who shows up, not what breaks',
  },

  // An answer to a card that has since been deleted. It renders exactly like a
  // general note: neutral, not broken, and not in a colour that lies about a
  // theme it no longer belongs to.
  DeletedTheme: {
    who: 'you',
    text: 'Said before that card was taken off the board',
  },

  // The partner's turn. Colour now carries meaning that alignment used to carry
  // alone, so in a narrow panel this still has to read as someone ELSE.
  Partner: {
    who: 'partner',
    text: 'Your goal is retrieval, so I dropped the shelf-management branch entirely.',
  },

  // A real answer with its reasoning attached — the length people actually
  // write. It has to wrap inside the narrow panel rather than overflow it.
  LongAnswer: {
    who: 'you',
    text: 'A rota of two or three, plus whoever turns up curious — but the honest answer is that it has been me every Saturday since March, and that is exactly the fragile bit nobody has said out loud yet.',
    hue: WHO,
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
  // The dark ground and the 360px width are the panel's, not invented: a bubble
  // judged on white is a different object, and its wrapping only means anything
  // at the width it actually has to wrap in.
  return (
    <div
      id="codeyam-capture"
      style={{ background: '#0a0a0b', width: 360, padding: 16 }}
    >
      <Component {...props} />
    </div>
  );
}
