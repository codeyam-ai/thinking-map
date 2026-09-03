import Component from '../../components/CoreIdeaBadge';

// The badge positions itself absolutely with negative margins, so it needs the
// corner it is parked on to exist. The harness supplies one: a fragment of the
// core card's top-left, at the card's real 36px corner radius and paper fill.
//
// Without that corner the badge would float alone in the middle of a capture
// and the frame would say nothing — the whole point of this component is WHERE
// it sits relative to an edge, not what it looks like on its own.

const scenarios = {
  // The only state it has. It takes no props: it is a fixed marker, and after
  // this change it no longer moves either — the orbit it used to travel was a
  // circle of the old disc's radius, which on a card taller than it is wide
  // would cut straight through the card's own edges.
  Default: {},
} as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = 'Default' } = await searchParams;
  if (!(s in scenarios)) {
    return <div>Unknown scenario: {s}</div>;
  }

  // The black is the board, and it is not decoration: paper on paper is
  // invisible, so without it the card's corner disappears into the page and the
  // frame shows a badge floating in space — the exact uninformative capture the
  // note above says this harness exists to prevent.
  return (
    <div id="codeyam-capture">
      <div style={{ background: '#000000', padding: 80 }}>
        <div
          className="relative rounded-[36px]"
          style={{
            width: 320,
            height: 220,
            background: 'var(--paper)',
          }}
        >
          <Component />
        </div>
      </div>
    </div>
  );
}
