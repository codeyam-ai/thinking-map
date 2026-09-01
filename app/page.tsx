import AppHeader from './components/AppHeader';
import LandingScreen from './components/LandingScreen';
import { listMaps } from './lib/mapStore';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const maps = await listMaps();

  return (
    <main className="flex min-h-screen flex-col px-10 py-8">
      <AppHeader phase="idea" />
      <LandingScreen maps={maps} />
    </main>
  );
}
