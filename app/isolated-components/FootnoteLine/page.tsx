import Component from "../../../app/components/FootnoteLine";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// One line of the quiet type at the foot of the handoff band.
//
// Worth capturing because "quiet" is the entire claim, and it is a claim about
// SIZE AND WEIGHT relative to everything above it — the one property a unit
// test cannot read. This component exists because that claim used to be three
// copy-pasted class strings; these frames are where it is either still true or
// has drifted.
const scenarios: Record<string, Props> = {
  // The real explanation string, at the length it actually runs to. The `lead`
  // spacing is the larger step down from the action above the group.
  Default: {
    spacing: "lead",
    children:
      "Your idea is saved. Nothing is working on it yet — a map cannot summon a thinking partner, so an agent has to come to it.",
  },
  // The longest line the band ever shows, which is where quiet type is most at
  // risk of turning into a grey slab. If this reads as a wall rather than as a
  // footnote, the wording is too long — not the type too small.
  LongestLine: {
    spacing: "tight",
    children:
      "A browser that implements WebMCP — Chrome 146+, at the top level, over HTTPS or localhost — drives this map directly, with nothing to copy. If you can read this panel, yours does not.",
  },
  // The short case. A one-clause line has to still read as part of the group
  // rather than as a stray fragment, which is the risk at this size.
  Short: {
    spacing: "none",
    children: "Run this once and this map’s tools are available in your session.",
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
  // Full-width surface: this sits at the foot of the band, which spans the
  // whole column between the header and the workspace.
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
