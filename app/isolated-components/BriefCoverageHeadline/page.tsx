import Component from "../../../app/components/BriefCoverageHeadline";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The panel's one sentence. It leads with what is UNTOUCHED rather than what is
// covered, so the interesting range is between "most of the document is unread"
// and the one state where the sentence inverts entirely.
const scenarios: Record<string, Props> = {
  // Mid-deconstruction, the ordinary working state: some read, some not, and
  // the character count doing the work the section count alone cannot.
  PartlyCovered: {
    untouchedCount: 3,
    untouchedCharCount: 669,
    covered: 4,
    total: 7,
  },
  // Day one. A brief just attached, nothing on the map citing any of it — the
  // honest picture rather than an empty component.
  NothingCited: {
    untouchedCount: 8,
    untouchedCharCount: 12690,
    covered: 0,
    total: 8,
  },
  // The state a client is actually being shown before they approve anything.
  // The sentence inverts and the untouched line disappears entirely.
  FullyAccountedFor: {
    untouchedCount: 0,
    untouchedCharCount: 0,
    covered: 8,
    total: 8,
  },
  // One left. Pinning the singular, because "1 sections" is the kind of thing
  // that survives review and then embarrasses you in front of a client.
  OneSectionLeft: {
    untouchedCount: 1,
    untouchedCharCount: 73,
    covered: 7,
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
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 232 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
