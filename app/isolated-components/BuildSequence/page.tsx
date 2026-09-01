import Component from "../../components/BuildSequence";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const UNKNOWNS = [
  { id: "u1", kind: "unknown", label: "Which age band responds best.", detail: null, order: 0 },
  { id: "u2", kind: "unknown", label: "Whether teachers would pay for this.", detail: null, order: 1 },
  { id: "u3", kind: "unknown", label: "How much parent involvement really matters.", detail: null, order: 2 },
];

const SLICES = [
  {
    id: "b1",
    kind: "slice",
    label: "Ten words on paper cards, one classroom",
    detail: "About two days. No app at all - printed cards and a tally sheet.",
    order: 10,
    testsNodeId: "u1",
  },
  {
    id: "b2",
    kind: "slice",
    label: "One teacher runs a round and sees the scores",
    detail: "About a week. A single screen, one class, no accounts.",
    order: 11,
    testsNodeId: "u2",
  },
  {
    id: "b3",
    kind: "slice",
    label: "The round goes home for a parent to finish",
    detail: "About two weeks, and only worth starting once the classroom round holds up.",
    order: 12,
    testsNodeId: "u3",
  },
];

const scenarios: Record<string, Props> = {
  Default: { nodes: [...UNKNOWNS, ...SLICES] },
  ProvesNothing: {
    nodes: [
      ...UNKNOWNS,
      SLICES[0],
      {
        id: "b9",
        kind: "slice",
        label: "Build the teacher admin console",
        detail: "About three weeks.",
        order: 11,
        testsNodeId: null,
      },
      SLICES[2],
    ],
  },
  DanglingLink: {
    nodes: [
      ...UNKNOWNS,
      SLICES[0],
      {
        id: "b8",
        kind: "slice",
        label: "Print-at-home word packs",
        detail: "About four days.",
        order: 11,
        testsNodeId: "u-deleted",
      },
    ],
  },
  FirstSliceOnly: { nodes: [UNKNOWNS[0], SLICES[0]] },
  LongSequence: {
    nodes: [
      ...UNKNOWNS,
      { id: "r1", kind: "risk", label: "Six-year-olds lose interest before the second round.", detail: null, order: 3 },
      { id: "q1", kind: "open-question", label: "Does a district buy per-school or per-seat?", detail: null, order: 4 },
      ...SLICES,
      { id: "b4", kind: "slice", label: "Two classes race the same word list", detail: "About a week on top of the single-class round.", order: 13, testsNodeId: "r1" },
      { id: "b5", kind: "slice", label: "A second teacher joins without being set up", detail: "About four days. The invite link is the whole feature.", order: 14, testsNodeId: "q1" },
      { id: "b6", kind: "slice", label: "Rebuild the word list as a shared library", detail: "About two weeks.", order: 15, testsNodeId: null },
    ],
  },
  Empty: {
    nodes: [
      { id: "s1", kind: "next-step", label: "Interview 3 teachers", detail: null, order: 0 },
    ],
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
      <Component {...props} />
    </div>
  );
}
