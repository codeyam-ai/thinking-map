import SavedMapRow, { type SavedMap } from './SavedMapRow';

/**
 * Maps persist, so returning is a first-class arrival — this is what someone
 * coming back on day three sees above the fold.
 */
export default function SavedMapList({ maps }: { maps: SavedMap[] }) {
  if (maps.length === 0) return null;

  return (
    // mx-auto, not just max-w. A max-width with no centring anchors the block
    // to the left edge of whatever contains it, so the rows drifted away from
    // the card they belong under while the heading — which centres its own text
    // — stayed put. Narrower than it was, too: this list sits beneath a 440px
    // card, and a row three times that width reads as a different section of
    // the page rather than as an afterthought under the thing you came for.
    <section className="mx-auto mt-16 w-full max-w-[620px]">
      <h2 className="eyebrow mb-4 text-center">Pick up where you left off</h2>
      <ul className="flex flex-col gap-2.5">
        {maps.map((map) => (
          <SavedMapRow key={map.id} map={map} />
        ))}
      </ul>
    </section>
  );
}
