import BulletCard from './BulletCard';
import DirectionsCard from './DirectionsCard';
import NextStepsTrack from './NextStepsTrack';
import SummaryHeadline from './SummaryHeadline';
import { groupSummaryNodes, type SummaryNode } from '../lib/summaryGroups';

/**
 * The final screen: abstract idea → structured understanding → possible
 * directions → concrete next steps. Composition only; each region is its own
 * component and the sorting lives in groupSummaryNodes.
 */
export default function SummaryView({ nodes }: { nodes: SummaryNode[] }) {
  const { known, unknown, directions, steps } = groupSummaryNodes(nodes);

  return (
    <div className="flex flex-col gap-8 pb-10">
      <SummaryHeadline />
      <div className="grid gap-4 lg:grid-cols-3">
        <BulletCard title="What we know" items={known} />
        <BulletCard title="What we don't know" items={unknown} />
        <DirectionsCard items={directions} />
      </div>
      <NextStepsTrack steps={steps} />
    </div>
  );
}
