import ThreadsHarness from "./ThreadsHarness";
import type { Round } from "../../lib/mapRounds";
import type { FlatNode } from "../../lib/mapLayout";

// `RowThreads` measures the DOM rather than taking geometry as props, so it
// draws nothing on its own — see ThreadsHarness for why these scenarios mount
// it inside a stand-in column of boxes instead of rendering it bare.
const node = (id: string, parentId: string | null, kind: string): FlatNode => ({
  id,
  parentId,
  kind,
  label: id,
  detail: null,
  status: "answered",
  sourceUrl: null,
  order: 0,
});

const round = (index: number, nodes: FlatNode[]): Round => ({
  index,
  nodes,
  phase: null,
});

const root = node("root", null, "idea");

const scenarios: Record<string, { rounds: Round[]; width: number }> = {
  // The fan: several threads leaving one card, spread across its bottom edge
  // in the order of the children they land on, each in the child's own family
  // colour. This is the scenario the whole component exists for.
  Default: {
    rounds: [
      round(1, [root]),
      round(2, [
        node("a", "root", "goal"),
        node("b", "root", "research"),
        node("c", "root", "risk"),
        node("d", "root", "slice"),
      ]),
    ],
    width: 680,
  },
  // One child is not a fan: it leaves from the middle of the card, which is
  // what makes a single thread read as a straight drop.
  SingleThread: {
    rounds: [round(1, [root]), round(2, [node("a", "root", "finding")])],
    width: 680,
  },
  // A card whose parent is two rounds back draws nothing. The rows already
  // record the ancestry, and a line spanning the cards between is a claim no
  // reader could follow.
  ParentTwoRoundsBack: {
    rounds: [
      round(1, [root]),
      round(2, [node("a", "root", "goal")]),
      round(3, [node("far", "root", "approach")]),
    ],
    width: 680,
  },
  // Half the round has a parent above and half does not. The unattached cards
  // draw nothing rather than reaching for something to connect to.
  SomeUnattached: {
    rounds: [
      round(1, [root]),
      round(2, [
        node("a", "root", "goal"),
        node("loose", null, "constraint"),
        node("c", "root", "finding"),
      ]),
    ],
    width: 680,
  },
  // The case the measurement is most likely to get wrong: a narrow band, so
  // the round wraps onto two lines. Threads reach the first line only — there
  // is no honest lane to a wrapped card, and the alternative is a line
  // ploughing straight through the cards above it.
  WrappedRow: {
    rounds: [
      round(1, [root]),
      round(2, [
        node("a", "root", "open-question"),
        node("b", "root", "open-question"),
        node("c", "root", "open-question"),
        node("d", "root", "open-question"),
        node("e", "root", "open-question"),
        node("f", "root", "open-question"),
      ]),
    ],
    width: 420,
  },
  // Nothing to connect: a map of one round. The component renders nothing at
  // all rather than an empty SVG over the column.
  NothingToDraw: {
    rounds: [round(1, [root])],
    width: 680,
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  return (
    <div id="codeyam-capture">
      <ThreadsHarness rounds={props.rounds} width={props.width} />
    </div>
  );
}
