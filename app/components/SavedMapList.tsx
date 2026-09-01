import SavedMapRow, { type SavedMap } from './SavedMapRow';

/**
 * Maps persist, so returning is a first-class arrival — this is what someone
 * coming back on day three sees above the fold.
 */
export default function SavedMapList({ maps }: { maps: SavedMap[] }) {
  if (maps.length === 0) return null;

  return (
    <section className="mt-16 w-full max-w-[930px]">
      <h2 className="eyebrow mb-4 text-center">Pick up where you left off</h2>
      <ul className="flex flex-col gap-2.5">
        {maps.map((map) => (
          <SavedMapRow key={map.id} map={map} />
        ))}
      </ul>
    </section>
  );
}
