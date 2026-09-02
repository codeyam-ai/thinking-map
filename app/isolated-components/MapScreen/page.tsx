import Component from "../../components/MapScreen";
import BridgeFixture from "../BridgeFixture";
import type { ExchangeEvent } from "../../lib/exchange";
import type { Phase } from "../../lib/mapKinds";
import type { FlatNode } from "../../lib/mapLayout";
import type { SummaryNode } from "../../lib/summaryGroups";

const at = (
  revision: number,
  kind: ExchangeEvent["kind"],
  origin: ExchangeEvent["origin"],
  payload: unknown,
): ExchangeEvent => ({
  id: `e${revision}`,
  revision,
  kind,
  origin,
  payload,
  createdAt: new Date(0),
});

const node = (
  id: string,
  parentId: string | null,
  kind: string,
  label: string,
  status: string,
  order: number,
  origin: string,
): FlatNode => ({
  id,
  parentId,
  kind,
  label,
  detail: null,
  status,
  sourceUrl: null,
  order,
  origin,
});

const READING_MAP: FlatNode[] = [
  node("xn-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user"),
  node("xn-prob", "xn-idea", "problem", "Abandoned after a week", "answered", 0, "agent"),
  node("xn-goal", "xn-idea", "goal", "Refind a half-remembered idea", "answered", 1, "user"),
  node("xn-find", "xn-prob", "finding", "Logging gives nothing back", "answered", 0, "agent"),
  node("xn-appr", "xn-goal", "approach", "Capture the thought, not the book", "answered", 0, "agent"),
  node("xn-q1", "xn-appr", "open-question", "Do you reread your own notes today?", "open", 0, "agent"),
  node("xn-q2", "xn-appr", "open-question", "Is this for you alone, or shared?", "open", 1, "agent"),
];

const PLAN: SummaryNode[] = [
  { id: "k1", kind: "known", label: "Retrieval is the goal, not record-keeping.", detail: null, order: 0 },
  { id: "k2", kind: "known", label: "Logging without payback is what kills it.", detail: null, order: 1 },
  { id: "u1", kind: "unknown", label: "Whether notes get reread at all.", detail: null, order: 2 },
  { id: "d1", kind: "direction", label: "Capture the thought, not the book", detail: null, order: 3 },
  { id: "d2", kind: "direction", label: "Resurface on a schedule", detail: null, order: 4 },
  { id: "s1", kind: "next-step", label: "Log ten thoughts by hand for a week", detail: null, order: 5 },
  { id: "s2", kind: "next-step", label: "Sketch the one-tap capture", detail: null, order: 6 },
];

const HISTORY: ExchangeEvent[] = [
  at(2, "agent.note", "agent", {
    text: "Treating the abandonment as the real problem rather than the tracking.",
  }),
  at(6, "user.node", "user", { id: "xn-goal", label: "Refind a half-remembered idea" }),
  at(9, "user.note", "user", {
    text: "That is exactly it — I kept feeding it and it never fed me back.",
  }),
  at(13, "question.asked", "agent", {
    questions: [
      { id: "xn-q1", text: "Do you reread your own notes today?" },
      { id: "xn-q2", text: "Is this for you alone, or shared?" },
    ],
  }),
  at(14, "phase.set", "agent", { phase: "explore" }),
];

// The whole map surface, header and all. The two views are the same map at
// different moments — the working tree while the thinking is live, the plan
// once it has run out — which is why choosing between them lives here rather
// than in the route.
/** The idea the board orbits in every scenario. Fixed so a capture is
 *  reproducible and two scenarios differ only in what they mean to show. */
const SEED_IDEA = "I want help building an app to help me plan my trip.";

/** Hues are the ones hueForIndex hands out for themes 0, 1 and 2, written as
 *  literals so a capture pins the palette the layout actually produces rather
 *  than re-deriving it and passing whatever the function returns today. */
const THEMES = [
  { id: "t-context", label: "Context", hue: 318, order: 0 },
  { id: "t-who", label: "Who it is for", hue: 96, order: 1 },
  { id: "t-shape", label: "Shape of the trip", hue: 233, order: 2 },
];

const scenarios: Record<
  string,
  {
    phase: Phase;
    nodes: FlatNode[] & SummaryNode[];
    events: ExchangeEvent[];
    status: "unavailable" | "connected" | "working";
    tools: string[];
    revision: number;
    /** Passing one mounts the handoff band; the working scenarios below leave
     *  it off because an agent has already been on those maps. */
    mapId?: string;
    seedIdea?: string;
  }
> = {
  // The working surface with an agent attached and two questions waiting.
  Working: {
    phase: "explore",
    nodes: READING_MAP as FlatNode[] & SummaryNode[],
    events: HISTORY,
    status: "connected",
    tools: ["read_map", "add_nodes", "update_node", "set_phase", "post_note", "ask_user", "await_user_activity"],
    revision: 14,
  },
  // The state every preview and capture genuinely produces: no agent can bind
  // inside an iframe, and the map has to stay fully usable anyway.
  NoAgent: {
    phase: "explore",
    nodes: READING_MAP as FlatNode[] & SummaryNode[],
    events: HISTORY,
    status: "unavailable",
    tools: [],
    revision: 14,
  },
  // The moment this feature is for: someone typed an idea, pressed return, and
  // arrived at a map nobody is working on. The band leads the page with what to
  // do about that, and the map they just made stays visible underneath it —
  // which is the whole argument for a band over a takeover.
  JustArrived: {
    phase: "idea",
    nodes: [READING_MAP[0]] as FlatNode[] & SummaryNode[],
    events: [],
    status: "unavailable",
    tools: [],
    revision: 1,
    mapId: "cmtixt5tg000wymek3vbmllaj",
    seedIdea: "A tool for tracking what I read",
  },
  // The end of the loop: the plan, with somewhere to keep going underneath it.
  Summary: {
    phase: "next-steps",
    nodes: PLAN as FlatNode[] & SummaryNode[],
    events: HISTORY,
    status: "connected",
    tools: ["read_map", "add_nodes", "update_node", "set_phase", "post_note", "ask_user", "await_user_activity"],
    revision: 24,
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Working" } = await searchParams;
  const fixture = scenarios[s];
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  // A full screen: MapScreen sets its own h-screen, so the capture keeps the
  // whole viewport rather than wrapping it.
  return (
    <div id="codeyam-capture">
      <BridgeFixture
        status={fixture.status}
        reason={fixture.status === "unavailable" ? "running inside an iframe" : null}
        tools={fixture.tools}
        events={fixture.events}
        revision={fixture.revision}
      >
        <Component
          phase={fixture.phase}
          seedIdea={SEED_IDEA}
          themes={THEMES}
          nodes={fixture.nodes}
        />
      </BridgeFixture>
    </div>
  );
}
