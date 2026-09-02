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

/** Read the stored diagram. Same contract as parseChoices: anything that will
 *  not draw becomes null, so a card degrades to its text rather than throwing. */
function parseDiagram(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { steps?: unknown; note?: unknown };
    const steps = Array.isArray(d.steps)
      ? d.steps.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [];
    if (steps.length < 2) return null;
    return typeof d.note === 'string' && d.note.trim()
      ? { steps, note: d.note.trim() }
      : { steps };
  } catch {
    return null;
  }
}

export default function MapScreen({
  phase,
  seedIdea,
  maps,
  currentId,
  attachments,
  themes,
  nodes,
}: {
  phase: Phase;
  seedIdea: string;
  /** Every board, for the menu. */
  maps?: { id: string; title: string }[];
  currentId?: string;
  attachments?: { name: string }[];
  themes: GalaxyTheme[];
  nodes: (FlatNode &
    SummaryNode & {
      themeId?: string | null;
      choices?: string | null;
      imageUrl?: string | null;
      imageAlt?: string | null;
      diagram?: string | null;
    })[];
}) {
  return (
    // overflow-hidden so the page itself never scrolls. The board is the only
    // thing that moves; a page that could also scroll would make the frame
    // appear to slide while you were zooming inside it.
    <main className="flex h-screen flex-col gap-6 overflow-hidden px-10 py-8">
      <AppHeader status={<AgentStatus />} maps={maps} currentId={currentId} />
      {phase === 'next-steps' ? (
        <SummaryScreen nodes={nodes} />
      ) : (
        <BoardWorkspace
          seedIdea={seedIdea}
          mapId={currentId ?? ''}
          attachments={attachments}
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
            diagram: parseDiagram(n.diagram),
            imageUrl: n.imageUrl ?? null,
            imageAlt: n.imageAlt ?? null,
          }))}
        />
      )}
    </main>
  );
}
