import Component from "../../../app/components/PendingCards";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The placeholder band itself. Its geometry deliberately mirrors MapRow's — same
// wrap, same gap, same card min/max/height — so the cards land where the real
// ones will; these scenarios are what makes a drift between the two visible.
const scenarios: Record<string, Props> = {
  // What a finished round is normally followed by.
  Default: {},

  // A narrower reach. The band wraps rather than scrolling sideways, so the
  // count is free to vary without a breakpoint deciding anything.
  Two: { count: 2 },
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
  // On the map's white surface, which is what the paper-coloured placeholders
  // are designed to contrast against — on the default paper backdrop they
  // vanish, which reads as broken rather than as pending.
  return (
    <div id="codeyam-capture">
      <div
        style={{
          width: "100%",
          maxWidth: 930,
          background: "var(--surface)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <Component {...props} />
      </div>
    </div>
  );
}
