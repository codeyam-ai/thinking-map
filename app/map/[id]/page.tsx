import { notFound } from 'next/navigation';
import AgentSimulator from '@/app/components/AgentSimulator';
import MapScreen from '@/app/components/MapScreen';
import { WebMcpBridge } from '@/app/components/WebMcpBridge';
import { getMap, listMaps } from '@/app/lib/mapStore';
import { readSince } from '@/app/lib/exchange';
import { isPhase, type Phase } from '@/app/lib/mapKinds';

export const dynamic = 'force-dynamic';

/** Names only, and anything unreadable becomes an empty list — a board that
 *  cannot parse its own attachment list should still open. */
function parseAttachments(raw: string | null): { name: string }[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((a) => String((a as { name?: unknown })?.name ?? '').trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  } catch {
    return [];
  }
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) notFound();

  const phase: Phase = isPhase(map.phase) ? map.phase : 'deconstruct';

  // The whole log, so the rail is populated on first paint and the bridge
  // starts holding a cursor it can resume from rather than one it has to go
  // and fetch before it knows anything.
  const { revision, events } = await readSince(map.id);
  // Every board, for the menu. Cheap next to the map itself and it means the
  // header never has to fetch on the client.
  const maps = await listMaps();

  return (
    // The bridge wraps the whole surface rather than one panel: the map is the
    // shared artifact, so an agent's tools stay bound for as long as the page
    // is open, whichever view of it is showing.
    <WebMcpBridge
      mapId={map.id}
      initialEvents={events}
      initialRevision={revision}
    >
      <MapScreen
        phase={phase}
        seedIdea={map.seedIdea}
        maps={maps.map((m) => ({ id: m.id, title: m.title }))}
        currentId={map.id}
        attachments={parseAttachments(map.attachments)}
        themes={map.themes}
        nodes={map.nodes}
      />
      {process.env.NODE_ENV === 'production' ? null : <AgentSimulator />}
    </WebMcpBridge>
  );
}
