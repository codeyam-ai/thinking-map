import EmptyHint from './EmptyHint';
import type { SummaryNode } from '../lib/summaryGroups';

/** The strongest directions, lettered A / B / C. */
export default function DirectionsCard({ items }: { items: SummaryNode[] }) {
  return (
    <section className="rounded-[20px] border border-line bg-surface p-6">
      <h2 className="eyebrow mb-4">Strongest directions</h2>
      <ol className="flex flex-col gap-2.5">
        {items.map((node, index) => (
          <li
            key={node.id}
            className="rounded-full border border-ink px-5 py-3 text-[14px] font-semibold"
          >
            {String.fromCharCode(65 + index)} · {node.label}
          </li>
        ))}
        {items.length === 0 ? <EmptyHint /> : null}
      </ol>
    </section>
  );
}
