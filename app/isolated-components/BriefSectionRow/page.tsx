"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/BriefSectionRow";
import type { SectionCoverage } from "../../lib/briefCoverage";

// The three states a section can be in, which are the whole point of the row:
// accounted for, untouched, or a heading with nothing under it. The weighting
// is deliberately inverted against the obvious reading — untouched carries the
// ink — so these are best read side by side.
//
// A client component, not the scaffold's server default: the row takes an
// `onAsk` callback, and an event handler cannot cross the server boundary as a
// prop. The callback is therefore created here, the way the panel creates it.
const scenarios: Record<
  string,
  { section: SectionCoverage; askable: boolean }
> = {
  // A section the map has dealt with. It recedes: the map beside the panel is
  // already its evidence, so the row's job here is only to be countable.
  Covered: {
    section: {
      id: "s5",
      heading: "Residency verification",
      charCount: 347,
      nodeCount: 2,
      nodes: [],
      isEmpty: false,
    },
    askable: false,
  },
  // The state this feature exists for. Full ink, a dashed count, and the one
  // affordance that turns a noticed absence into something the agent acts on.
  Untouched: {
    section: {
      id: "s4",
      heading: "What we think we need",
      charCount: 323,
      nodeCount: 0,
      nodes: [],
      isEmpty: false,
    },
    askable: true,
  },
  // Already asked about this turn: the panel drops `onAsk`, so the row keeps
  // its ink but offers no second click.
  UntouchedAlreadyAsked: {
    section: {
      id: "s7",
      heading: "What success looks like",
      charCount: 273,
      nodeCount: 0,
      nodes: [],
      isEmpty: false,
    },
    askable: false,
  },
  // A heading with nothing under it — a real part of the document's shape, but
  // nothing to have accounted for. Neither ink nor grey, and no ask button:
  // there is no passage to ask about.
  EmptySection: {
    section: {
      id: "s1",
      heading: "Northgate Library — Digital Membership Renewal",
      charCount: 0,
      nodeCount: 0,
      nodes: [],
      isEmpty: true,
    },
    askable: true,
  },
  // A long heading in a narrow rail, which is why the ask button is labelled by
  // section number rather than by heading.
  LongHeading: {
    section: {
      id: "s12",
      heading: "How we will measure success across all six branches",
      charCount: 1090,
      nodeCount: 0,
      nodes: [],
      isEmpty: false,
    },
    askable: true,
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const fixture = scenarios[s];
  const [asked, setAsked] = useState<string | null>(null);
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  return (
    // 232px is the real content width inside BriefPanel: a 276px rail less its
    // 22px of padding each side. The row is an <li>, so it needs its list.
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 232 }}>
        <ul>
          <Component
            section={fixture.section}
            onAsk={
              fixture.askable
                ? (section) => setAsked(section.id)
                : undefined
            }
          />
        </ul>
        <p className="sr-only">{asked ?? "not asked"}</p>
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
