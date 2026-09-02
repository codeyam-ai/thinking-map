import Wordmark from './Wordmark';
import BoardMenu, { type BoardMenuMap } from './BoardMenu';

/**
 * Wordmark left, agent presence and the board menu right.
 *
 * The phase track that used to live here is gone: it named six stages the
 * board no longer walks through, and the board draws its own progress. See
 * BoardMenu for the longer version.
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
    <header className="flex shrink-0 items-center justify-between gap-8">
      <Wordmark />
      <div className="flex items-center gap-6">
        {status}
        <BoardMenu maps={maps} currentId={currentId} />
      </div>
    </header>
  );
}
