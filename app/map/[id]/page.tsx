import { notFound } from 'next/navigation';
import AppHeader from '@/app/components/AppHeader';
import MapWorkspace from '@/app/components/MapWorkspace';
import SummaryScreen from '@/app/components/SummaryScreen';
import { getMap } from '@/app/lib/mapStore';
import { mapCaption } from '@/app/lib/mapCaption';
import { isPhase, type Phase } from '@/app/lib/mapKinds';

export const dynamic = 'force-dynamic';

export default async function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) notFound();

  const phase: Phase = isPhase(map.phase) ? map.phase : 'deconstruct';

  return (
    <main className="flex h-screen flex-col gap-6 px-10 py-8">
      <AppHeader phase={phase} />
      {phase === 'next-steps' ? (
        <SummaryScreen mapId={map.id} messages={map.messages} nodes={map.nodes} />
      ) : (
        <MapWorkspace
          mapId={map.id}
          messages={map.messages}
          nodes={map.nodes}
          caption={mapCaption(map.nodes)}
        />
      )}
    </main>
  );
}
