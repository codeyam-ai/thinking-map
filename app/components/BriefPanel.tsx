'use client';

import { useState } from 'react';
import BriefCoverageHeadline from './BriefCoverageHeadline';
import BriefDanglingNote from './BriefDanglingNote';
import BriefPanelHeader from './BriefPanelHeader';
import BriefSectionRow from './BriefSectionRow';
import { useWebMcpBridge } from './WebMcpBridge';
import { untouchedNoteText } from '../lib/briefFormat';
import type { BriefCoverage, SectionCoverage } from '../lib/briefCoverage';

/**
 * The client's brief beside the map, marked with what has been accounted for.
 *
 * A client who hands over a twenty-page spec wants evidence you read all of it.
 * The map is the evidence for the sections it cites; this panel exists for the
 * ones it does not — the difference between "the agent read your brief" and
 * "the agent read pages one to four and inferred the rest".
 *
 * Every number here is counted from the nodes that actually cite each section,
 * never asserted by an agent. That is what makes the untouched list worth
 * putting in front of someone: it is not a claim, it is an absence.
 */
export default function BriefPanel({
  sourceName,
  coverage,
}: {
  sourceName: string;
  coverage: BriefCoverage;
}) {
  const [asked, setAsked] = useState<string[]>([]);
  const bridge = useWebMcpBridge();

  // The untouched-section prompt rides the existing user-note path rather than
  // a new channel: it is a person telling the agent what to look at next, which
  // is exactly what that channel already carries — and it wakes a waiting agent
  // with no new mechanism.
  const ask = async (section: SectionCoverage) => {
    if (asked.includes(section.id)) return;
    setAsked((prior) => [...prior, section.id]);
    try {
      await bridge.contribute('user.note', { text: untouchedNoteText(section) });
    } catch {
      // Put it back so the person can try again — a swallowed failure here
      // would leave them believing the agent had been told.
      setAsked((prior) => prior.filter((id) => id !== section.id));
    }
  };

  return (
    <aside className="flex w-[276px] shrink-0 flex-col overflow-hidden rounded-2xl bg-surface px-[22px] py-6">
      <BriefPanelHeader
        sourceName={sourceName}
        covered={coverage.covered}
        total={coverage.total}
      />
      <BriefCoverageHeadline
        untouchedCount={coverage.untouched.length}
        untouchedCharCount={coverage.untouchedCharCount}
        covered={coverage.covered}
        total={coverage.total}
      />
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {coverage.sections.map((section) => (
          <BriefSectionRow
            key={section.id}
            section={section}
            onAsk={asked.includes(section.id) ? undefined : ask}
          />
        ))}
      </ul>
      <BriefDanglingNote dangling={coverage.dangling} />
    </aside>
  );
}
