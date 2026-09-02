import { PHASE_LABELS, isPhase } from '../lib/mapKinds';

export interface SavedMap {
  id: string;
  title: string;
  phase: string;
  _count: { nodes: number };
}

/**
 * One saved thinking map.
 *
 * Deliberately recessive: no fill, a hairline border, dimmed text. This list
 * sits under the card someone came here to type into, and a row with a solid
 * light fill outranks that card visually however far down the page it is —
 * which points a returning user at their old work instead of their next
 * thought. It brightens on hover, so it is quiet without being hidden.
 */
export default function SavedMapRow({ map }: { map: SavedMap }) {
  return (
    <li>
      <a
        href={`/map/${map.id}`}
        suppressHydrationWarning
        className="group flex items-center justify-between gap-6 rounded-[14px] border border-white/[0.07] px-5 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
      >
        <span className="truncate text-[14px] text-white/55 transition-colors group-hover:text-white/90">
          {map.title}
        </span>
        <span className="shrink-0 text-[11px] text-white/25">
          {isPhase(map.phase) ? PHASE_LABELS[map.phase] : map.phase}
          {' · '}
          {map._count.nodes} node{map._count.nodes === 1 ? '' : 's'}
        </span>
      </a>
    </li>
  );
}
