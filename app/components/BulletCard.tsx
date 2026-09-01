import EmptyHint from './EmptyHint';
import type { SummaryNode } from '../lib/summaryGroups';

/** A "what we know" / "what we don't know" card. */
export default function BulletCard({
  title,
  items,
}: {
  title: string;
  items: SummaryNode[];
}) {
  return (
    <section className="rounded-[20px] border border-line bg-surface p-6">
      <h2 className="eyebrow mb-4">{title}</h2>
      <ul className="flex flex-col gap-2.5">
        {items.map((node) => (
          <li key={node.id} className="flex gap-2.5 text-[14px] leading-snug">
            <span aria-hidden="true" className="text-ink">
              ◆
            </span>
            <span>{node.label}</span>
          </li>
        ))}
        {items.length === 0 ? <EmptyHint /> : null}
      </ul>
    </section>
  );
}
