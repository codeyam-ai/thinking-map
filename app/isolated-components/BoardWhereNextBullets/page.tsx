import Component from '../../components/BoardWhereNextBullets';

// A list of short claims in the far-end column.
//
// It takes strings rather than nodes, because both regions that use it are
// MIXTURES — what is being learned is the map's own `known` nodes plus the
// partner's `finding`s, and what is still open is its `unknown`s plus the
// `gap`s. Where a line came from is not something the reader has to sort out,
// so the scenarios do not distinguish either.

const scenarios: Record<string, { items: string[] }> = {
  // What a map knows a few rounds in.
  Default: {
    items: [
      'Vocabulary is the strongest fit for ages 6-8.',
      'Three existing apps miss parent involvement.',
      'Teachers are a viable second audience.',
    ],
  },

  // One claim is a legitimate list, and an early map has exactly this.
  Single: { items: ['Vocabulary is the strongest fit for ages 6-8.'] },

  // A claim long enough to wrap, which is the shape a real finding has. It
  // wraps rather than truncating: half a claim cannot be weighed.
  LongClaim: {
    items: [
      'The whiteboard is wiped before the evening shift has read it, so anything promised after four in the afternoon survives only in whoever happened to hear it.',
      'Teachers are a viable second audience.',
    ],
  },

  // Nothing yet, which is most of a session. The region says what to do about
  // that rather than reporting the absence.
  Empty: { items: [] },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = 'Default' } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // In the panel it really sits in, at the far-end column's width: the diamond
  // and the hanging indent only read against a real bound.
  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ width: 420 }}>
        <section className="rounded-[20px] border border-white/10 bg-black/60 p-5">
          <span className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            What we&rsquo;re learning
          </span>
          <Component items={props.items} />
        </section>
      </div>
    </div>
  );
}
