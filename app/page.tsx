import AppHeader from './components/AppHeader';
import ErrorScreen from './components/ErrorScreen';
import LandingScreen from './components/LandingScreen';
import { classifyLoadError } from './lib/loadError';
import { listMaps } from './lib/mapStore';

export const dynamic = 'force-dynamic';

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
      <main className="flex min-h-screen flex-col px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <AppHeader phase="idea" />
        <ErrorScreen {...classifyLoadError(error)} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
      <AppHeader phase="idea" />
      <LandingScreen maps={maps} />
    </main>
  );
}
