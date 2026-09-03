import AgentHandoff from './AgentHandoff';
import AgentStatus from './AgentStatus';
import AppHeader from './AppHeader';
import BoardWorkspace from './BoardWorkspace';
import SummaryScreen from './SummaryScreen';
import type { Phase } from '../lib/mapKinds';
import type { FlatNode } from '../lib/mapLayout';
import type { SummaryNode } from '../lib/summaryGroups';
import type { GalaxyTheme } from '../lib/galaxyLayout';
import type { Attachment } from '../lib/attachments';

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

/** Read the ids an insight cites. Same total, degrade-to-null contract as
 *  parseChoices, and it matters more here: a malformed value must yield no
 *  citations rather than throwing away the insight that carries it. An insight
 *  whose sources cannot be read is still a claim worth showing — one that took
 *  the board down with it would not be. */
function parseFromNodeIds(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
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
  brief,
}: {
  phase: Phase;
  seedIdea: string;
  /** Every board, for the menu. */
  maps?: { id: string; title: string }[];
  currentId?: string;
  attachments?: Attachment[];
  /** Main's brief: the document a map was derived from, when there is one.
   *  Only its PRESENCE is read, for `hasBrief` — the text has exactly one
   *  reader and it is not this screen. Typed by what is asked of it rather
   *  than by the store's current selection, so narrowing that select does not
   *  break a screen that never looks inside. Optional so an isolated scenario
   *  can mount the screen without inventing one. */
  brief?: Record<string, unknown> | null;
  themes: GalaxyTheme[];
  nodes: (FlatNode &
    SummaryNode & {
      themeId?: string | null;
      choices?: string | null;
      imageUrl?: string | null;
      imageAlt?: string | null;
      diagram?: string | null;
      /** The JSON array of cited node ids, as the column stores it. Optional
       *  for the same reason `choices` is: most nodes are not insights, and a
       *  fixture mounting this screen has no reason to invent one. */
      fromNodeIds?: string | null;
      /** When the node was written and when it last moved. Optional so an
       *  isolated fixture can mount the screen without dating every node; an
       *  undated map is one cohort in which nothing is behind anything, which
       *  is the right reading of a fixture. */
      createdAt?: Date | string;
      updatedAt?: Date | string;
    })[];
}) {
  return (
    // overflow-hidden so the page itself never scrolls. The board is the only
    // thing that moves; a page that could also scroll would make the frame
    // appear to slide while you were zooming inside it.
    <main className="flex h-screen flex-col gap-6 overflow-hidden px-10 py-8">
      <AppHeader status={<AgentStatus />} maps={maps} currentId={currentId} />
      {/* Deliberately NOT wrapped in a sizing div. This main is a flex column
          with a gap, and AgentHandoff hides itself by returning null — a
          wrapper would stay in the DOM as a zero-height flex item and collect
          a gap on either side, pushing the board down on every map an agent has
          already worked. The band carries its own `shrink-0` instead. */}
      {currentId ? (
        <AgentHandoff
          mapId={currentId}
          seedIdea={seedIdea}
          hasBrief={Boolean(brief)}
          // The summary is what someone opens a finished map FOR, and this
          // column is `h-screen`, so a full-height reattach strip here is taken
          // straight out of the plan they came back to read. One row keeps the
          // way back without charging the summary a quarter of the screen.
          dense={phase === 'next-steps'}
        />
      ) : null}
      {phase === 'next-steps' ? (
        <SummaryScreen nodes={nodes} />
      ) : (
        <BoardWorkspace
          seedIdea={seedIdea}
          mapId={currentId ?? ''}
          // The board needs the arc, not just the cards on it: which phase this
          // is decides what "move on" means and what the round's closing note
          // tells the partner is due. This screen has held the phase all along
          // and only ever used it for its own layout.
          mapPhase={phase}
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
            // What the insight stack reads: when a claim was written, when the
            // questions around it were answered, and which of them it came out
            // of. Carried on the same nodes the board already lays out rather
            // than fetched again — the stream is a reading of these nodes, not
            // a second collection.
            origin: n.origin ?? null,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            fromNodeIds: parseFromNodeIds(n.fromNodeIds),
          }))}
        />
      )}
    </main>
  );
}
