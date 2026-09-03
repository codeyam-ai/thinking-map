import { notFound } from 'next/navigation';
import AgentSimulator from '@/app/components/AgentSimulator';
import AppHeader from '@/app/components/AppHeader';
import ErrorScreen from '@/app/components/ErrorScreen';
import MapScreen from '@/app/components/MapScreen';
import { WebMcpBridge } from '@/app/components/WebMcpBridge';
import { agentPanelRequested, type QueryParams } from '@/app/lib/agentPanel';
import { readAttachments } from '@/app/lib/attachments';
import { getMap, listMaps } from '@/app/lib/mapStore';
import { readSince } from '@/app/lib/exchange';
import { classifyLoadError } from '@/app/lib/loadError';
import { normalizePhase, type Phase } from '@/app/lib/mapKinds';
import { resolveVisitorId } from '@/app/lib/visitor';

export const dynamic = 'force-dynamic';

/** The browser-tab title. Open questions are counted into it so a backgrounded
 *  board still says how much is waiting. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // A failed read takes the same branch as no map at all. Metadata runs a frame
  // before the body, so a throw here 500s the route before the page has a
  // chance to say what went wrong — the title is not worth that.
  let map: Awaited<ReturnType<typeof getMap>>;
  try {
    map = await getMap(id);
  } catch {
    return { title: 'Thinking Map' };
  }
  if (!map) return { title: 'Thinking Map' };

  const open = map.nodes.filter((node) => node.status === 'open').length;
  return { title: open > 0 ? `(${open}) ${map.title}` : map.title };
}

interface MapPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<QueryParams>;
}

export default async function MapPage({ params, searchParams }: MapPageProps) {
  const { id } = await params;
  const query = await searchParams;

  // The load is caught HERE rather than left to `app/error.tsx`. A Next error
  // boundary is a client component, and in production React replaces
  // `error.message` with a digest — so a boundary structurally cannot say "the
  // database is behind the schema". Catching on the server is what makes the
  // diagnosis possible at all; the boundary stays as the net for everything
  // else.
  let map: Awaited<ReturnType<typeof getMap>>;
  try {
    map = await getMap(id);
  } catch (error) {
    // The terminal keeps the full Prisma output the screen deliberately hides.
    console.error(`Failed to load map ${id}:`, error);
    return (
      <main className="flex min-h-screen flex-col px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <AppHeader />
        <ErrorScreen {...classifyLoadError(error)} />
      </main>
    );
  }
  if (!map) notFound();

  // `map` is the fallback as well as the alias target: an unreadable phase on a
  // map that has nodes is far more likely to be a stale name than a map that
  // never started, and `map` is where the working view lives.
  const phase: Phase = normalizePhase(map.phase) ?? 'map';

  // The whole log, so the rail is populated on first paint and the bridge
  // starts holding a cursor it can resume from rather than one it has to go
  // and fetch before it knows anything.
  const { revision, events } = await readSince(map.id);
  // This browser's boards, for the menu. Cheap next to the map itself and it
  // means the header never has to fetch on the client.
  //
  // Scoped for the same reason the landing strip is: the menu lists an id and a
  // title for every map it is given, so an unscoped one is the same enumeration
  // by another route. Someone who opened this map from a link and owns nothing
  // gets an empty menu — the map itself still renders in full, because the link
  // is the access model and that has not changed.
  const maps = await listMaps(await resolveVisitorId(query));

  // Null unless this map was started from a brief, which is most of them.
  const brief = map.brief ?? null;

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
        attachments={readAttachments(
          map.attachments.map((a) => ({ ...a, hasBytes: a.byteSize > 0 })),
        )}
        themes={map.themes}
        nodes={map.nodes}
        brief={brief}
      />
      {/* Opt-in only. The production floor lives inside `agentPanelRequested`,
          so no NODE_ENV check belongs here: an agent driving the browser on a
          dev session used to find this panel and press "Run the demo sequence",
          writing invented nodes onto a real map. */}
      {agentPanelRequested(query) ? <AgentSimulator /> : null}
    </WebMcpBridge>
  );
}
