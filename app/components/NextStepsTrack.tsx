import EmptyHint from './EmptyHint';
import type { SummaryNode } from '../lib/summaryGroups';

/**
 * The five concrete next steps, arrowed left to right. The first step is
 * unboxed — it is where you start tomorrow, not one option among five.
 */
export default function NextStepsTrack({ steps }: { steps: SummaryNode[] }) {
  return (
    <section className="rounded-[20px] border border-line bg-surface p-6">
      <h2 className="eyebrow mb-6">Your next {steps.length || ''} steps</h2>
      <ol className="flex flex-wrap items-stretch gap-3">
        {steps.map((node, index) => (
          <li key={node.id} className="flex items-center gap-3">
            {index > 0 ? (
              <span aria-hidden="true" className="text-[18px] text-ink">
                →
              </span>
            ) : null}
            <div
              className={`flex min-h-[92px] w-[210px] flex-col justify-center gap-1.5 rounded-[16px] px-5 py-4 ${
                index === 0 ? '' : 'border border-ink'
              }`}
            >
              <span className="eyebrow">Step {index + 1}</span>
              <span className="text-[14px] font-semibold leading-snug">
                {node.label}
              </span>
            </div>
          </li>
        ))}
        {steps.length === 0 ? <EmptyHint /> : null}
      </ol>
    </section>
  );
}
