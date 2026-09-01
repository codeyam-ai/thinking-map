'use client';

import ContributionBar from './ContributionBar';
import ExchangeRail from './ExchangeRail';
import { useWebMcpBridge } from './WebMcpBridge';

/**
 * Somewhere to put the next thought, under the finished plan.
 *
 * The summary is the end of the loop and deliberately not a dead end — the plan
 * is a starting point, so the map has to stay writable here. There are no open
 * questions on this screen by definition (the loop has run out), so this is the
 * contribution bar and the record, without the waiting-on-you panel.
 */
export default function KeepThinkingPanel() {
  const { events } = useWebMcpBridge();

  return (
    <section className="mx-auto flex max-w-[560px] flex-col gap-4 pb-4">
      <h2 className="eyebrow text-center">Keep thinking</h2>
      <ContributionBar />
      <div className="max-h-[320px]">
        <ExchangeRail events={events} />
      </div>
    </section>
  );
}
