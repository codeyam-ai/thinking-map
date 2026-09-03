import Wordmark from './Wordmark';
import BoardMenu, { type BoardMenuMap } from './BoardMenu';

/**
 * Wordmark left, agent presence and the board menu right.
 *
 * The phase track that used to live here is gone. It named stages the board no
 * longer walks through, and the board draws its own progress — the lines of
 * thinking are named by what they are about, and the arc from idea to
 * conclusion is the drawing itself. A stage indicator over a board that already
 * shows its own progress is a second, less accurate answer to the same
 * question. See BoardMenu.
 *
 * `status` is the map screen's slot for agent presence, and it stays on this
 * one line at every width. It used to drop to a full-width row below `lg`,
 * which was right while it spelled its reason out inline; now that the reason
 * lives behind a click it fits, and on a narrow viewport — a phone, a split
 * window, an agent browser's sidebar — that reclaimed row goes to the map.
 */
export default function AppHeader({
  status,
  maps = [],
  currentId,
}: {
  status?: React.ReactNode;
  maps?: BoardMenuMap[];
  currentId?: string;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 lg:gap-8">
      <Wordmark />
      {/* One line at every width.
          This used to drop to its own full-width row below `lg`, because the
          status carried its reason inline — "No agent attached — no browser
          agent (needs Chrome 146+)" genuinely could not share a line with the
          wordmark and the menu. It is now a dot and two words, with the detail
          behind a click, so the row it was costing goes back to the map.
          `min-w-0` so it truncates rather than pushing the menu off the edge. */}
      {status ? <div className="min-w-0">{status}</div> : null}
      {/* `min-w-0` so this side can actually shrink: a flex item defaults to
          `min-width: auto`, the same trap documented on ThinkingMapView. */}
      <div className="flex min-w-0 items-center gap-3 lg:order-last lg:gap-6">
        <BoardMenu maps={maps} currentId={currentId} />
      </div>
    </header>
  );
}
