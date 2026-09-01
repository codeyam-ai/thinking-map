import Component from "../../components/OpenQuestions";
import BridgeFixture from "../BridgeFixture";
import type { FlatNode } from "../../lib/mapLayout";

const node = (
  id: string,
  kind: string,
  label: string,
  status: string,
  order: number,
): FlatNode => ({
  id,
  parentId: "xn-appr",
  kind,
  label,
  detail: null,
  status,
  sourceUrl: null,
  order,
  origin: "agent",
});

// The panel lists `open-question` nodes with `status: "open"` and empties as
// they are answered. It reads the whole map and filters, so the fixtures carry
// answered nodes too — a panel that showed those would be reporting work the
// person has already done as still outstanding.
const scenarios: Record<string, FlatNode[]> = {
  // The none-to-some boundary: exactly one question outstanding.
  One: [
    node("xn-q1", "open-question", "Do you reread your own notes today?", "open", 0),
    node("xn-q2", "open-question", "Is this for you alone, or shared?", "answered", 1),
  ],
  // Two waiting, which is the ordinary shape of a deconstructing turn.
  Two: [
    node("xn-q1", "open-question", "Do you reread your own notes today?", "open", 0),
    node("xn-q2", "open-question", "Is this for you alone, or shared?", "open", 1),
  ],
  // Five at once — the shape an agent deconstructing a vague idea produces,
  // and the case where the panel has to stay legible rather than becoming a
  // wall the person bounces off.
  Many: [
    node("xn-q1", "open-question", "Do you reread your own notes today?", "open", 0),
    node("xn-q2", "open-question", "Is this for you alone, or shared?", "open", 1),
    node("xn-q3", "open-question", "What do you do with a book once you finish it?", "open", 2),
    node("xn-q4", "open-question", "Which app did you keep the longest, and why?", "open", 3),
    node("xn-q5", "open-question", "Is the goal remembering, or finding again?", "open", 4),
  ],
  // Everything answered: the panel renders nothing at all rather than an empty
  // heading, so the column gives its space back to the record.
  None: [
    node("xn-q1", "open-question", "Do you reread your own notes today?", "answered", 0),
    node("xn-appr", "approach", "Capture the thought, not the book", "answered", 1),
  ],
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Two" } = await searchParams;
  const nodes = scenarios[s];
  if (!nodes) return <div>Unknown scenario: {s}</div>;
  // The exchange column is 300px wide with 20px padding each side.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 260 }}>
        <BridgeFixture status="connected" revision={14}>
          <Component nodes={nodes} />
        </BridgeFixture>
      </div>
    </div>
  );
}
