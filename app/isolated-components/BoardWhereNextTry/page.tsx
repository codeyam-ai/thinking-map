'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardWhereNextTry';
import { KIND_EYEBROW } from '../../lib/mapKinds';
import type { SequencedSlice } from '../../lib/buildSequence';
import type { Insight } from '../../lib/insightStream';

// A client harness rather than a server page: `eyebrowFor` is a function prop,
// and a function cannot cross the server/client boundary.
//
// This is the region that turned the far end from a report into a next move, so
// what the scenarios have to show is the two SOURCES it draws from and the one
// judgement it makes. The map's `slice` nodes are the small builds, each naming
// an assumption it would settle; the partner's `experiment` and `suggestion`
// insights are things worth running that nobody has to build. Both answer "what
// could I do that would tell me something", so they belong in one list.
//
// The judgement is `provesNothing`: a slice that settles nothing is MARKED
// rather than dropped, because an increment that tests no assumption is not a
// validating slice — it is work scheduled early, and a list that rendered those
// alongside the real ones would be a plan with rounded corners.

const UNDATED = new Date(0);

const insight = (
  id: string,
  kind: string,
  label: string,
  over: Partial<Insight> = {},
): Insight => ({
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
  ...over,
});

const slice = (
  id: string,
  label: string,
  proves: { id: string; kind: string; label: string } | null,
  over: Partial<SequencedSlice> = {},
): SequencedSlice => ({
  slice: { id, kind: 'slice', label, detail: null, order: 0 },
  proves,
  provesNothing: proves === null,
  danglingId: null,
  ...over,
});

const AGE_BAND = {
  id: 'u1',
  kind: 'unknown',
  label: 'Which age band responds best.',
};

const scenarios: Record<
  string,
  { experiments: Insight[]; sequence: SequencedSlice[]; changed?: string[] }
> = {
  // Both sources at once, which is the ordinary state of a worked map.
  Default: {
    experiments: [
      insight(
        'e1',
        'experiment',
        'Lend one tool to one neighbour this week and write down who has it',
        {
          detail:
            'Costs nothing and settles the custody question in seven days.',
        },
      ),
      insight(
        'e2',
        'suggestion',
        'The collapse you are describing is a custody problem, not a lending one',
      ),
    ],
    sequence: [
      slice('s1', 'Ten words on paper cards, one classroom', AGE_BAND),
      slice('s2', 'One teacher runs a round and sees the scores', {
        id: 'u2',
        kind: 'unknown',
        label: 'Whether teachers would pay for this.',
      }),
    ],
  },

  // The judgement, on screen. A slice that settles nothing wears a dashed edge
  // — the board's own word for unsettled, and the same treatment an unanswered
  // card wears — in the client's own reading order rather than filtered out.
  SettlesNothing: {
    experiments: [],
    sequence: [
      slice('s1', 'Ten words on paper cards, one classroom', AGE_BAND),
      slice('s2', 'Build the parent app', null),
    ],
  },

  // A slice whose reason was deleted out from under it. Distinct from naming
  // nothing: it DID name something, and that something is gone.
  DanglingReason: {
    experiments: [],
    sequence: [
      slice('s1', 'Build the shared board', null, { danglingId: 'gone-node' }),
    ],
  },

  // The partner wrote at the far end while the person was answering elsewhere.
  // Marked in place rather than sorted to the top: the mark is worth having
  // because it can be read AGAINST what was already there, and a list that
  // reorders itself between visits is one nobody can keep their place in.
  SomethingNew: {
    experiments: [
      insight(
        'e1',
        'experiment',
        'Lend one tool to one neighbour this week and write down who has it',
      ),
      insight(
        'e2',
        'suggestion',
        'The collapse you are describing is a custody problem, not a lending one',
      ),
    ],
    sequence: [
      slice('s1', 'Ten words on paper cards, one classroom', AGE_BAND),
    ],
    changed: ['e2'],
  },

  // Nothing to try yet, which is most of a session. The region names the next
  // action rather than reporting the absence of data.
  Empty: { experiments: [], sequence: [] },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ width: 420 }}>
        <Component
          experiments={scenario.experiments}
          sequence={scenario.sequence}
          changed={scenario.changed ? new Set(scenario.changed) : undefined}
          eyebrowFor={(kind) =>
            KIND_EYEBROW[kind as keyof typeof KIND_EYEBROW] ?? kind
          }
        />
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
