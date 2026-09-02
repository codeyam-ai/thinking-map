import AgentStatus from './AgentStatus';
import AppHeader from './AppHeader';
import BoardWorkspace from './BoardWorkspace';
import SummaryScreen from './SummaryScreen';
import type { Phase } from '../lib/mapKinds';
import type { FlatNode } from '../lib/mapLayout';
import type { SummaryNode } from '../lib/summaryGroups';
import type { GalaxyTheme } from '../lib/galaxyLayout';

/**
 * The whole map surface: the header, and whichever view the phase calls for.
 *
 * The two views are the same map at different moments — the working tree while
 * the thinking is live, the plan once it has run out — so choosing between them
 * belongs here rather than in the route, which should only fetch and mount.
 */
/** Read the stored options. Total: anything unparseable becomes null. */
function parseChoices(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed.map((c) => String(c ?? '').trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

export default function MapScreen({
  phase,
  seedIdea,
  themes,
  nodes,
}: {
  phase: Phase;
  seedIdea: string;
  themes: GalaxyTheme[];
  nodes: (FlatNode &
    SummaryNode & { themeId?: string | null; choices?: string | null })[];
}) {
  return (
    // overflow-hidden so the page itself never scrolls. The board is the only
    // thing that moves; a page that could also scroll would make the frame
    // appear to slide while you were zooming inside it.
    <main className="flex h-screen flex-col gap-6 overflow-hidden px-10 py-8">
      <AppHeader phase={phase} status={<AgentStatus />} />
      {phase === 'next-steps' ? (
        <SummaryScreen nodes={nodes} />
      ) : (
        <BoardWorkspace
          seedIdea={seedIdea}
          themes={themes}
          nodes={nodes.map((n) => ({
            id: n.id,
            themeId: n.themeId ?? null,
            kind: n.kind,
            label: n.label,
            detail: n.detail,
            status: n.status,
            // Stored as a JSON string because SQLite has no array column. A
            // malformed value degrades to an open-ended question rather than
            // throwing — a card that cannot render its options is still a
            // question worth asking.
            choices: parseChoices(n.choices),
          }))}
        />
      )}
    </main>
  );
}
