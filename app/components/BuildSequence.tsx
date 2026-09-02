import EmptyHint from './EmptyHint';
import SliceCard from './SliceCard';
import { buildSequence } from '../lib/buildSequence';
import type { SummaryNode } from '../lib/summaryGroups';

/**
 * What to build first, and what building it would prove.
 *
 * A numbered list of next steps is indistinguishable from a plan to build the
 * whole thing in order — which is the failure this product exists to prevent.
 * So the sequence leads with the smallest increment that would settle
 * something, and a slice that settles nothing is marked in place rather than
 * quietly filtered out.
 */
export default function BuildSequence({ nodes }: { nodes: SummaryNode[] }) {
  const sequence = buildSequence(nodes);

  return (
    <section className="rounded-[20px] border border-line bg-surface p-6">
      <h2 className="eyebrow mb-2">Build this first</h2>
      <p className="mb-6 text-[13px] leading-snug text-muted">
        The smallest thing worth building, and what you would know once it is
        built.
      </p>
      <ol className="flex flex-col gap-3">
        {sequence.map((entry, index) => (
          <SliceCard key={entry.slice.id} entry={entry} index={index} />
        ))}
        {sequence.length === 0 ? <EmptyHint /> : null}
      </ol>
    </section>
  );
}
