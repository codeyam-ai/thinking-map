import AgentHandoff from './AgentHandoff';
import AgentStatus from './AgentStatus';
import AppHeader from './AppHeader';
import BoardWorkspace from './BoardWorkspace';
// `SummaryScreen` is deliberately NOT imported. The plan moved onto the board
// rather than being deleted: the screen, its view and their scenarios all
// stand, and nothing routes to them from here any more.
import { boardNodesOf, type StoredNode } from '../lib/boardNodes';
import type { Phase } from '../lib/mapKinds';
import type { GalaxyTheme } from '../lib/galaxyLayout';
import type { Attachment } from '../lib/attachments';

/**
 * The whole map surface: the header and the board, at every phase.
 *
 * It used to choose between two views — the working board while the thinking
 * was live, a page of paper cards once it had run out. It no longer chooses,
 * because that swap said two things the product does not believe: that the
 * thinking was over, and that the plan is a different object from the map it
 * came out of. The plan now stands at the far end of the board.
 *
 * What is left here is composition and one projection, and the projection
 * lives in `boardNodes` so its degrade-to-null parsers can be tested.
 */

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
  /** The map's nodes as the store hands them over — the drawable fields flat,
   *  the three array-shaped ones still the JSON strings their columns hold.
   *  `boardNodes` owns what each of those degrades to. */
  nodes: StoredNode[];
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
      {/* One surface, at every phase.
          Reaching `next-steps` used to swap this whole workspace for a page of
          paper cards, which said two things the product does not believe: that
          the thinking was over, and that the plan is a different object from
          the map it came out of. The plan now stands at the far end of the
          board, where the rows already converge — so the map, its cards and
          every answer stay reachable while you read the conclusion they
          produced. `SummaryScreen` and `SummaryView` are untouched and still
          have their scenarios; nothing routes to them here any more. */}
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
        // One projection, in `boardNodes`, where its parsers can be tested.
        // The three JSON columns each degrade to null rather than throwing,
        // and that rule — not the field list — is the part worth holding: a
        // card that cannot render its options is still a question worth
        // asking, and an insight whose citations will not parse is still a
        // claim worth showing.
        nodes={boardNodesOf(nodes)}
      />
    </main>
  );
}
