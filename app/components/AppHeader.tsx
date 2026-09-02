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
 * `status` is the map screen's slot for agent presence. Below `lg` it cannot
 * share a line with the wordmark and the menu, so it drops to its own
 * full-width row underneath rather than competing for the same space — the
 * responsive treatment the track used to carry, kept because the constraint it
 * solved did not go away with it.
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
      {status ? (
        <div className="order-last basis-full lg:order-none lg:basis-auto">
          {status}
        </div>
      ) : null}
      {/* `min-w-0` so this side can actually shrink: a flex item defaults to
          `min-width: auto`, the same trap documented on ThinkingMapView. */}
      <div className="flex min-w-0 items-center gap-3 lg:order-last lg:gap-6">
        <BoardMenu maps={maps} currentId={currentId} />
      </div>
    </header>
  );
}
