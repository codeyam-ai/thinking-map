import Component from "../../components/SliceCard";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: {
    index: 0,
    entry: {
      slice: {
        id: "b1",
        kind: "slice",
        label: "Ten words on paper cards, one classroom",
        detail: "About two days. No app at all - printed cards and a tally sheet.",
        order: 10,
        testsNodeId: "u1",
      },
      proves: { id: "u1", kind: "unknown", label: "Which age band responds best." },
      provesNothing: false,
      danglingId: null,
    },
  },
  ProvesNothing: {
    index: 1,
    entry: {
      slice: {
        id: "b9",
        kind: "slice",
        label: "Build the teacher admin console",
        detail: "About three weeks.",
        order: 11,
        testsNodeId: null,
      },
      proves: null,
      provesNothing: true,
      danglingId: null,
    },
  },
  DanglingLink: {
    index: 2,
    entry: {
      slice: {
        id: "b8",
        kind: "slice",
        label: "Print-at-home word packs",
        detail: "About four days.",
        order: 12,
        testsNodeId: "u-deleted",
      },
      proves: null,
      provesNothing: true,
      danglingId: "u-deleted",
    },
  },
  NoEffortStated: {
    index: 0,
    entry: {
      slice: {
        id: "b7",
        kind: "slice",
        label: "One word, one card, one child",
        detail: null,
        order: 10,
        testsNodeId: "r1",
      },
      proves: { id: "r1", kind: "risk", label: "Six-year-olds lose interest before the second round." },
      provesNothing: false,
      danglingId: null,
    },
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
      <ol className="p-6">
        <Component {...props} />
      </ol>
    </div>
  );
}
