"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/AskAboutSectionButton";

// The affordance on an unaccounted-for section. Its visible label is the
// section MARK while its accessible name keeps the heading, so the pair worth
// capturing is a short heading against one long enough to have forced that
// split in the first place.
//
// A client component, not the scaffold's server default: the button takes an
// `onClick`, and an event handler cannot cross the server boundary as a prop.
const scenarios: Record<string, { sectionId: string; heading: string }> = {
  // A single-digit section, the common case.
  Default: { sectionId: "s4", heading: "What we think we need" },
  // The heading that caused the label to be the mark rather than the words:
  // spelled out, this button wrapped to three lines in a 276px rail.
  LongHeading: {
    sectionId: "s1",
    heading: "Northgate Library — Digital Membership Renewal",
  },
  // Past nine, where the label has to stay legible with a wider mark.
  DoubleDigitSection: {
    sectionId: "s12",
    heading: "How we will measure success",
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const fixture = scenarios[s];
  const [clicked, setClicked] = useState(false);
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  return (
    // 232px — the content width inside BriefPanel's 276px rail, less its
    // padding. The button's width only means anything against the rail it has
    // to fit into.
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 232 }}>
        <Component
          sectionId={fixture.sectionId}
          heading={fixture.heading}
          onClick={() => setClicked(true)}
        />
        <p className="sr-only">{clicked ? "asked" : "not asked"}</p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <Harness />
    </Suspense>
  );
}
