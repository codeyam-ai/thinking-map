import PhaseNav from './PhaseNav';
import Wordmark from './Wordmark';
import type { Phase } from '../lib/mapKinds';

/** Wordmark left, phase track right. Shared by the landing and map screens. */
export default function AppHeader({ phase }: { phase: Phase }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-8">
      <Wordmark />
      <PhaseNav active={phase} />
    </header>
  );
}
