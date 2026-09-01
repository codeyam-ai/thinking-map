import Component from "../../components/ThinkingMapView";
import type { ComponentProps } from "react";
import type { FlatNode } from "../../lib/mapLayout";

type Props = ComponentProps<typeof Component>;

const RESEARCHED: FlatNode[] = [
    { id: "n-idea", parentId: null, kind: "idea", label: "Educational game for kids", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "n-age", parentId: "n-idea", kind: "assumption", label: "Ages 6-8", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "n-prob", parentId: "n-idea", kind: "problem", label: "Vocabulary", detail: null, status: "answered", sourceUrl: null, order: 1 },
    { id: "n-goal", parentId: "n-idea", kind: "goal", label: "Not yet explored", detail: null, status: "open", sourceUrl: null, order: 2 },
    { id: "n-res", parentId: "n-prob", kind: "research", label: "3 existing apps found", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "n-g1", parentId: "n-res", kind: "gap", label: "No parent involvement", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "n-g2", parentId: "n-res", kind: "gap", label: "Fixed difficulty level", detail: null, status: "answered", sourceUrl: null, order: 1 },
  ];

const SEEDED: FlatNode[] = [
    { id: "n-idea", parentId: null, kind: "idea", label: "Educational game for kids", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "q1", parentId: "n-idea", kind: "open-question", label: "Who is it for?", detail: null, status: "open", sourceUrl: null, order: 0 },
    { id: "q2", parentId: "n-idea", kind: "open-question", label: "What's the problem?", detail: null, status: "open", sourceUrl: null, order: 1 },
    { id: "q3", parentId: "n-idea", kind: "open-question", label: "What's the goal?", detail: null, status: "open", sourceUrl: null, order: 2 },
  ];

// Thirteen answered and four open across four levels - past the legibility
// floor, so the panel scrolls instead of shrinking the labels away.
const SPRAWLING: FlatNode[] = [
    { id: "r", parentId: null, kind: "idea", label: "A platform for small clinics", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "who", parentId: "r", kind: "user", label: "Who this is for", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "who0", parentId: "who", kind: "assumption", label: "Rural clinics under 12 staff", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "who1", parentId: "who", kind: "assumption", label: "Practice managers, not clinicians", detail: null, status: "answered", sourceUrl: null, order: 1 },
    { id: "who2", parentId: "who", kind: "open-question", label: "Do patients ever touch it directly?", detail: null, status: "open", sourceUrl: null, order: 2 },
    { id: "prob", parentId: "r", kind: "problem", label: "The actual problem", detail: null, status: "answered", sourceUrl: null, order: 1 },
    { id: "prob0", parentId: "prob", kind: "assumption", label: "Follow-ups fall through at handoff", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "prob1", parentId: "prob", kind: "assumption", label: "No shared view of who called whom", detail: null, status: "answered", sourceUrl: null, order: 1 },
    { id: "prob2", parentId: "prob", kind: "open-question", label: "Is it coordination or is it staffing?", detail: null, status: "open", sourceUrl: null, order: 2 },
    { id: "res", parentId: "r", kind: "research", label: "7 existing tools found", detail: null, status: "answered", sourceUrl: null, order: 2 },
    { id: "res0", parentId: "res", kind: "finding", label: "Every tool assumes an EHR budget", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "res1", parentId: "res", kind: "finding", label: "Two are hospital-scale only", detail: null, status: "answered", sourceUrl: null, order: 1 },
    { id: "res2", parentId: "res", kind: "gap", label: "None handle the phone-call reality", detail: null, status: "answered", sourceUrl: null, order: 2 },
    { id: "appr", parentId: "r", kind: "approach", label: "Possible directions", detail: null, status: "answered", sourceUrl: null, order: 3 },
    { id: "appr0", parentId: "appr", kind: "approach", label: "A shared follow-up queue", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "appr1", parentId: "appr", kind: "approach", label: "A reminder layer over the EHR", detail: null, status: "answered", sourceUrl: null, order: 1 },
    { id: "appr2", parentId: "appr", kind: "approach", label: "Nothing software - a paper protocol", detail: null, status: "answered", sourceUrl: null, order: 2 },
  ];

const scenarios: Record<string, Props> = {
  Default: { nodes: RESEARCHED, caption: "5 answered, 1 still open" },
  // Day one: the panel has to invite the next answer, not show a void.
  Empty: { nodes: [], caption: "one seed, nothing else yet" },
  Seeded: { nodes: SEEDED, caption: "one seed, 3 open questions" },
  Sprawling: { nodes: SPRAWLING, caption: "13 answered, 4 still open" },
  // The caption is optional; without it the header shows only the LIVE MAP
  // eyebrow and must not collapse or leave a gap.
  NoCaption: { nodes: RESEARCHED },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // The map panel is a flex child that fills the workspace; the host gives it
  // a comparable box so the scale-to-fit behaves as it does in the app.
  return (
    <div id="codeyam-capture">
      <div className="flex" style={{ width: "100%", height: 620 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
