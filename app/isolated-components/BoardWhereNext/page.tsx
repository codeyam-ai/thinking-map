'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardWhereNext';
import type { SummaryNode } from '../../lib/summaryGroups';
import type { Insight } from '../../lib/insightStream';

// A client harness rather than a server page: taking a direction and asking for
// another round are callbacks, and a function cannot cross the server/client
// boundary as a prop.
//
// The whole far-end column, which is where its ARGUMENT is visible rather than
// its parts. This was a summary — a separate screen that replaced the board and
// opened with "I didn't build the product yet", a declaration about a finish
// line on a tool whose case is that there is not one. Someone arriving there
// had produced a document, not a next move.
//
// So the order is deliberate and it is not a report's order. A report leads
// with findings and ends with recommendations; this leads with the MOVES,
// because someone who opens the far end of their own map is asking "what now",
// and the evidence is what they read to decide between the answers.

const UNDATED = new Date(0);

const node = (
  id: string,
  kind: string,
  label: string,
  order: number,
  over: Partial<SummaryNode> = {},
): SummaryNode => ({ id, kind, label, detail: null, order, ...over });

const insight = (id: string, kind: string, label: string): Insight => ({
  id,
  kind,
  label,
  detail: null,
  themeId: null,
  createdAt: UNDATED,
  updatedAt: UNDATED,
  answersSince: 0,
  stale: false,
  from: [],
});

const WORKED: SummaryNode[] = [
  node('k1', 'known', 'Vocabulary is the strongest fit for ages 6-8.', 0),
  node('k2', 'known', 'Three existing apps miss parent involvement.', 1),
  node('u1', 'unknown', 'Whether teachers would pay for this.', 0),
  node('u2', 'unknown', 'Which age band responds best.', 1),
  node('d1', 'direction', 'Classroom vocabulary game', 0),
  node('d2', 'direction', 'Teacher assessment tool', 1),
  node('d3', 'direction', 'Shared parent-teacher app', 2),
  node('s1', 'slice', 'Ten words on paper cards, one classroom', 0, {
    testsNodeId: 'u2',
  }),
  node('n1', 'next-step', 'Interview 3 teachers', 0),
  node('n2', 'next-step', 'Sketch the classroom vocabulary flow', 1),
];

const scenarios: Record<string, { nodes: SummaryNode[]; insights: Insight[] }> =
  {
    // A map that has been worked: things to try, directions to take, what is
    // being learned and what is still open.
    Default: {
      nodes: WORKED,
      insights: [
        insight(
          'e1',
          'experiment',
          'Lend one tool to one neighbour and write down who has it',
        ),
        insight(
          'f1',
          'finding',
          'Two competitors dropped their parent view last year.',
        ),
        insight(
          'g1',
          'gap',
          'Nobody has said what happens when a teacher leaves.',
        ),
      ],
    },

    // A map that reached the far end thin. Every region names the next action
    // rather than the absence of data — and the ask at the top is the honest
    // answer to a thin column: give the partner more to work with.
    Thin: { nodes: [], insights: [] },

    // The experiments the partner supplied, with no plan nodes yet. They do not
    // disappear because the map reached its last phase — an experiment worth
    // running is worth running most of all at the point someone thinks they are
    // finished.
    ExperimentsOnly: {
      nodes: [],
      insights: [
        insight(
          'e1',
          'experiment',
          'Lend one tool to one neighbour and write down who has it',
        ),
        insight(
          'e2',
          'suggestion',
          'The collapse you describe is a custody problem, not a lending one',
        ),
      ],
    },
  };

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  const [took, setTook] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The column is `absolute`, positioned from the convergence point it hangs
  // off — so the harness supplies the relative box and the board's ground, and
  // enough height for the column to be read rather than clipped at its top.
  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ position: 'relative', width: 480, height: 1180 }}>
        <div style={{ position: 'absolute', left: 40, top: 0 }}>
          <Component
            nodes={scenario.nodes}
            insights={scenario.insights}
            onChoose={setTook}
            onAskMore={() => setAsked(true)}
          />
        </div>
      </div>
      {took || asked ? (
        <div className="text-[12px] text-white/50">
          {asked ? 'asked for another round' : `took: ${took}`}
        </div>
      ) : null}
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
