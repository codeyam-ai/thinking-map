import Component from '../../components/BoardWhereNextPanel';

// One region of the far-end column: a dark panel with a small-caps heading.
//
// Its whole reason for existing is that the heading is `InsightSectionLabel`
// rather than a sixth hand-copy of the same six utility classes — the board's
// eyebrow, deliberately not the app's paper-palette `eyebrow` class, which is
// near-black and renders invisible on this plane. So the scenario that matters
// is simply: does the heading read at all against the ground it sits on.

const scenarios: Record<string, { title: string; body: string[] }> = {
  Default: {
    title: 'What we&rsquo;re learning',
    body: [
      'Vocabulary is the strongest fit for ages 6-8.',
      'Three existing apps miss parent involvement.',
    ],
  },

  // A heading long enough to be worth checking, since the eyebrow's wide
  // letter-spacing makes a long one much longer than it looks in a string.
  LongHeading: {
    title: 'What we still do not know',
    body: ['Whether teachers would pay for this.'],
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = 'Default' } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ width: 420 }}>
        <Component title={props.title.replace('&rsquo;', '’')}>
          <ul className="flex flex-col gap-2.5">
            {props.body.map((line) => (
              <li
                key={line}
                className="text-[13.5px] leading-snug text-white/80"
              >
                {line}
              </li>
            ))}
          </ul>
        </Component>
      </div>
    </div>
  );
}
