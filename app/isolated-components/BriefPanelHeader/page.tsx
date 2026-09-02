import Component from "../../../app/components/BriefPanelHeader";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// What document this is, and how much of it the map accounts for. The source
// name is the client's own filename, so the range worth capturing is mostly
// about how a real filename behaves in a 276px rail.
const scenarios: Record<string, Props> = {
  // The ordinary case: a filename that fits, and a partial tally.
  Default: {
    sourceName: "northgate-renewal-brief.pdf",
    covered: 4,
    total: 7,
  },
  // A filename long enough to truncate. Truncated rather than wrapped on
  // purpose — wrapping would push the headline below it down the panel.
  LongSourceName: {
    sourceName: "northgate-library-district-digital-membership-renewal-brief-v4-FINAL.pdf",
    covered: 4,
    total: 7,
  },
  // A brief nothing cites yet, which is what day one actually looks like.
  NothingAccountedFor: {
    sourceName: "pasted brief",
    covered: 0,
    total: 8,
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
  // 232px — the content width inside BriefPanel's 276px rail, less its padding.
  // The truncation in LongSourceName only means anything at the real width.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 232 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
