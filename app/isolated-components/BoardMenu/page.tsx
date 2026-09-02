import Component from "../../components/BoardMenu";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The way back to your other boards.
//
// It lives in the header and stays collapsed, because the boards you are not
// looking at should cost no space on the one you are. What varies here is how
// many there are to return to — and the day-one case, where there are none.

const MAPS = [
  { id: "map-galaxy", title: "Handover between shifts at a small vet practice" },
  { id: "map-lending", title: "A tool library for the street" },
  { id: "map-reaching", title: "A repair cafe in the church hall" },
  { id: "map-game", title: "An educational game for kids" },
  { id: "map-brief", title: "Northgate Library — digital membership renewal" },
];

const scenarios: Record<string, Props> = {
  // The ordinary case: a handful of boards, the current one among them.
  Default: { maps: MAPS, currentId: "map-galaxy" },

  // Day one. There is nowhere else to go yet, and the menu has to say so
  // rather than open onto an empty list.
  NoOtherBoards: { maps: [], currentId: undefined },

  // Exactly one other board — the boundary where a list becomes a list.
  OneOther: { maps: MAPS.slice(0, 2), currentId: "map-galaxy" },

  // Enough boards that the list has to hold its shape, with titles long enough
  // to need truncating rather than wrapping the header open.
  Many: {
    maps: [
      ...MAPS,
      { id: "m6", title: "Somewhere to put half-finished thoughts before they go" },
      { id: "m7", title: "A tool for tracking what I read and why it mattered" },
      { id: "m8", title: "Coordinating follow-up care across small clinics" },
    ],
    currentId: "m7",
  },

  // Viewing a board that is not in the list — reachable by direct link, and the
  // menu must not mark anything as current when nothing is.
  NoneCurrent: { maps: MAPS, currentId: "not-in-the-list" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // It sits at the right of the app header on the page's own pale ground, so
  // the harness reproduces that rather than the board's dark canvas.
  return (
    <div id="codeyam-capture">
      <div style={{ width: 560, display: "flex", justifyContent: "flex-end" }}>
        <Component {...props} />
      </div>
    </div>
  );
}
