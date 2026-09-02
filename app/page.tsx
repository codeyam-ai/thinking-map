import AppHeader from './components/AppHeader';
import ErrorScreen from './components/ErrorScreen';
import FirstCard from './components/FirstCard';
import SavedMapList from './components/SavedMapList';
import { classifyLoadError } from './lib/loadError';
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
  // Same database, same failure mode as the map page — so the same treatment.
  // The header stays either way: a failed load should still look like the app,
  // not like the app is gone.
  let maps: Awaited<ReturnType<typeof listMaps>>;
  try {
    maps = await listMaps();
  } catch (error) {
    console.error('Failed to list maps:', error);
    return (
      <main className="flex min-h-screen flex-col bg-[#050505] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <AppHeader />
        <ErrorScreen {...classifyLoadError(error)} />
      </main>
    );
  }

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
