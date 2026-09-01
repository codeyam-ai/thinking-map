'use client';

import ContributionBar from './ContributionBar';
import ExchangeRail from './ExchangeRail';
import OpenQuestions from './OpenQuestions';
import { useWebMcpBridge } from './WebMcpBridge';
import type { FlatNode } from '../lib/mapLayout';

/**
 * The page's half of the exchange, in the order it matters.
 *
 * What is being waited on comes first, then the ways to put something in, then
 * the record of what has already happened. That order is the argument: the map
 * is the artifact, and this column is only what the page itself is responsible
 * for — it holds no reconstruction of the agent's conversation, because there
 * is none to hold.
 */
export default function ExchangeColumn({ nodes }: { nodes: FlatNode[] }) {
  const { events } = useWebMcpBridge();

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-4 rounded-[20px] border border-line bg-surface p-5">
      <OpenQuestions nodes={nodes} />
      <ContributionBar />
      <ExchangeRail events={events} />
    </aside>
  );
}
