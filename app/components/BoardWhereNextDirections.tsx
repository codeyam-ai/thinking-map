'use client';

/**
 * The strongest directions, as a shortlist you can take.
 *
 * On paper these were lettered list items — A, B, C, inert — which made the
 * end of the map a thing to read. They are buttons here, and pressing one is
 * the same contribution the insight stack's "where next" already makes: a note
 * saying which way to go, not an answer closing a question, because no
 * question on the map is being closed by choosing a direction.
 */
import BoardWhereNextEmpty from './BoardWhereNextEmpty';
import BoardWhereNextPanel from './BoardWhereNextPanel';
import type { SummaryNode } from '../lib/summaryGroups';

export default function BoardWhereNextDirections({
  items,
  onChoose,
}: {
  items: SummaryNode[];
  onChoose?: (choice: string) => void;
}) {
  return (
    <BoardWhereNextPanel title="Take a direction">
      <ol className="flex flex-col gap-2.5">
        {items.map((node, index) => (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onChoose?.(node.label)}
              // Full-width and pill-shaped, so the set reads as a shortlist to
              // pick from rather than as a numbered list to read past.
              className="w-full break-words rounded-[18px] border border-white/25 px-5 py-3 text-left text-[13.5px] font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/8"
            >
              {String.fromCharCode(65 + index)} · {node.label}
            </button>
          </li>
        ))}
        {items.length === 0 ? <BoardWhereNextEmpty /> : null}
      </ol>
    </BoardWhereNextPanel>
  );
}
