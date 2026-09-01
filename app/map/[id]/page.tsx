import { notFound } from 'next/navigation';
import AgentSimulator from '@/app/components/AgentSimulator';
import MapScreen from '@/app/components/MapScreen';
import { WebMcpBridge } from '@/app/components/WebMcpBridge';
import { getBriefCoverage, getMap } from '@/app/lib/mapStore';
import { readSince } from '@/app/lib/exchange';
import { normalizePhase, type Phase } from '@/app/lib/mapKinds';

export const dynamic = 'force-dynamic';

/**
 * The tab strip as a notification.
 *
 * This app is built to sit in half a screen with an agent's window in the
 * other half, which means the map is very often the tab you are NOT looking
 * at. There is no badge, toast or title-count mechanism anywhere in the
 * codebase, and the honest cheapest one is the document title: `(2) Educational
 * game for kids` says there is something waiting without the page needing to be
 * visible at all. It re-derives on every render, and the page is
 * `force-dynamic` with the poll calling `router.refresh()`, so the count tracks
 * the map rather than the moment it was opened.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) return { title: 'Thinking Map' };

  const open = map.nodes.filter((node) => node.status === 'open').length;
  return { title: open > 0 ? `(${open}) ${map.title}` : map.title };
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) notFound();

  // `map` is the fallback as well as the alias target: an unreadable phase on a
  // map that has nodes is far more likely to be a stale name than a map that
  // never started, and `map` is where the working view lives.
  const phase: Phase = normalizePhase(map.phase) ?? 'map';

  // The whole log, so the rail is populated on first paint and the bridge
  // starts holding a cursor it can resume from rather than one it has to go
  // and fetch before it knows anything.
  const { revision, events } = await readSince(map.id);

  // Null unless this map was started from a brief, which is most of them.
  const brief = map.brief
    ? await getBriefCoverage(map.id, map.nodes)
    : null;

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
        nodes={map.nodes}
        mapId={map.id}
        brief={brief ?? undefined}
        seedIdea={map.seedIdea}
      />
      {process.env.NODE_ENV === 'production' ? null : <AgentSimulator />}
    </WebMcpBridge>
  );
}
