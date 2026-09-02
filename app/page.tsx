import FirstCard from './components/FirstCard';
import SavedMapList from './components/SavedMapList';
import { listMaps } from './lib/mapStore';

export const dynamic = 'force-dynamic';

/**
 * The way in.
 *
 * Dark, like the board, and holding one card. The landing used to be a light
 * marketing-shaped screen that handed you off to a black canvas — two products
 * bolted together. Starting on the same surface you are about to work on means
 * the first card you fill in is already part of the map.
 */
export default async function Home() {
  const maps = await listMaps();

  return (
    <main className="flex min-h-screen flex-col bg-[#050505] px-10 py-8">
      <FirstCard />
      {/* Returning users only. A first-time visitor sees the card and nothing
          else, which is the whole point of the screen. */}
      {maps.length > 0 ? (
        <div className="pb-6">
          <SavedMapList maps={maps} />
        </div>
      ) : null}
    </main>
  );
}
