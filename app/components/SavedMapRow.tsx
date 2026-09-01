import { PHASE_LABELS, isPhase } from '../lib/mapKinds';

export interface SavedMap {
  id: string;
  title: string;
  phase: string;
  _count: { nodes: number };
}

/** One saved thinking map, with the phase it reached and its size. */
export default function SavedMapRow({ map }: { map: SavedMap }) {
  return (
    <li>
      <a
        href={`/map/${map.id}`}
        suppressHydrationWarning
        className="flex items-center justify-between gap-6 rounded-[18px] border border-line bg-surface px-6 py-4 transition hover:border-ink"
      >
        <span className="truncate text-[15px] font-semibold">{map.title}</span>
        <span className="shrink-0 text-[12px] text-muted">
          {isPhase(map.phase) ? PHASE_LABELS[map.phase] : map.phase}
          {' · '}
          {map._count.nodes} node{map._count.nodes === 1 ? '' : 's'}
        </span>
      </a>
    </li>
  );
}
