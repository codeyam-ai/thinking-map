import Component from "../../components/MapConnectors";
import type { LaidOutNode } from "../../lib/mapLayout";

const parent: LaidOutNode = {
  id: "p", parentId: null, kind: "idea", label: "Root", detail: null,
  status: "answered", sourceUrl: null, depth: 0, x: 180, y: 24, width: 200, height: 62,
};

const child = (id: string, x: number): LaidOutNode => ({
  id, parentId: "p", kind: "problem", label: id, detail: null,
  status: "answered", sourceUrl: null, depth: 1, x, y: 172, width: 160, height: 56,
});

const scenarios: Record<string, LaidOutNode[]> = {
  // Three siblings sharing one horizontal bus - the arrangement that makes the
  // tree read as a single structure rather than unrelated lines.
  Default: [parent, child("a", 10), child("b", 200), child("c", 390)],
  // A single aligned child gets a straight drop, with no dog-leg.
  SingleChild: [parent, child("only", 200)],
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const nodes = scenarios[s];
  if (!nodes) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div className="relative" style={{ width: 560, height: 250 }}>
        <Component nodes={nodes} width={560} height={250} />
      </div>
    </div>
  );
}
