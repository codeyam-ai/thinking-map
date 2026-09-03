import Component from '../../components/BoardWorkspace';
import BridgeFixture from '../BridgeFixture';
import type { ExchangeEvent } from '../../lib/exchange';
import type { GalaxyNodeInput, GalaxyTheme } from '../../lib/galaxyLayout';
import type { Phase } from '../../lib/mapKinds';

// The board and the conversation together, which is the surface a person
// actually uses — the map is what the conversation has produced so far, and the
// chat sits over all of it rather than beside one card.
//
// It has to be shown through `BridgeFixture`. The real bridge derives its state
// from the browser and an isolated capture renders in an iframe, where WebMCP
// is unreachable by definition — so `unavailable` is the only state it could
// ever produce on its own, and every other one is reachable only by supplying
// it.

const HUES = [318, 96, 233];

const theme = (id: string, label: string, order: number): GalaxyTheme => ({
  id,
  label,
  hue: HUES[order],
  order,
});

const node = (
  id: string,
  themeId: string | null,
  kind: string,
  label: string,
  over: Partial<GalaxyNodeInput> = {},
): GalaxyNodeInput => ({
  id,
  themeId,
  kind,
  label,
  detail: null,
  status: 'open',
  choices: null,
  imageUrl: null,
  imageAlt: null,
  diagram: null,
  ...over,
});

const at = (
  revision: number,
  kind: ExchangeEvent['kind'],
  origin: ExchangeEvent['origin'],
  payload: unknown,
): ExchangeEvent => ({
  id: `e${revision}`,
  revision,
  kind,
  origin,
  payload,
  createdAt: new Date(0),
});

const SEED_IDEA =
  "Our vets lose things between the morning and evening shift — a dog that needed re-checking, an owner who was promised a call back. Everyone blames the whiteboard but I don't think the whiteboard is the problem.";

const THEMES: GalaxyTheme[] = [
  theme('th-context', 'What actually gets lost', 0),
  theme('th-people', 'Who is holding it', 1),
  theme('th-shape', 'What it could be', 2),
];

const NODES: GalaxyNodeInput[] = [
  node('g-idea', null, 'idea', 'Handover between shifts', {
    status: 'answered',
  }),
  node(
    'g-ctx-1',
    'th-context',
    'open-question',
    'Which item goes missing most often?',
    {
      detail: 'Owner call-backs.',
      status: 'answered',
      choices: ['Owner call-backs', 'Re-checks', 'Lab results to chase'],
    },
  ),
  node(
    'g-ctx-2',
    'th-context',
    'open-question',
    'At what moment does it get dropped?',
    {
      choices: [
        'During the verbal handover',
        'After it, before the task is done',
      ],
    },
  ),
  node(
    'g-ppl-1',
    'th-people',
    'open-question',
    'Who owns a call-back once the shift ends?',
  ),
  node(
    'g-ppl-2',
    'th-people',
    'assumption',
    'The receptionist is the informal system',
    {
      detail: 'She remembers what the board does not.',
      status: 'answered',
    },
  ),
  node(
    'g-shape-1',
    'th-shape',
    'approach',
    'A list that survives the shift boundary',
    {
      status: 'answered',
      diagram: {
        steps: [
          'A call-back is promised',
          'It joins the list with a name on it',
          'Closing it needs a person',
        ],
        note: 'The wipe is what deletes the state today.',
      },
    },
  ),
  node('g-shape-2', 'th-shape', 'risk', 'A second screen nobody looks at', {
    detail: "The whiteboard's one virtue is that it is in the room.",
    status: 'answered',
  }),
];

const EXCHANGE: ExchangeEvent[] = [
  at(1, 'user.note', 'user', {
    text: "Everyone blames the whiteboard but I don't think it is the problem.",
  }),
  at(2, 'theme.added', 'agent', {
    id: 'th-context',
    label: 'What actually gets lost',
  }),
  at(3, 'agent.note', 'agent', {
    text: 'Three things worth pulling apart: what falls through, who is carrying it when it falls, and only then what a fix looks like.',
  }),
  at(4, 'question.asked', 'agent', {
    questions: [{ id: 'g-ctx-1', text: 'Which item goes missing most often?' }],
  }),
  at(5, 'user.answer', 'user', {
    answers: [{ id: 'g-ctx-1', answer: 'Owner call-backs.' }],
  }),
];

// The same board with nothing left open. Every scenario above it has two
// questions still waiting, which is the ordinary state and deliberately the
// default — the round only ends itself when the board runs out of questions, so
// a fixture that is always full could never show it happening.
const ANSWERED_NODES: GalaxyNodeInput[] = NODES.map((n) =>
  n.id === 'g-ctx-2'
    ? {
        ...n,
        status: 'answered',
        detail: 'After the verbal handover, before the task is done.',
      }
    : n.id === 'g-ppl-1'
      ? { ...n, status: 'answered', detail: 'Nobody. That is the actual gap.' }
      : n,
);

const scenarios: Record<
  string,
  {
    themes: GalaxyTheme[];
    nodes: GalaxyNodeInput[];
    events: ExchangeEvent[];
    status: 'unavailable' | 'connected' | 'working';
    revision: number;
    attachments?: { name: string }[];
    /** Where the map is on its arc. Drives both the note the round's end sends
     *  and which step the phase action offers, so it is per-scenario rather
     *  than fixed — `map` and `explore` are genuinely different screens. */
    phase?: Phase;
  }
> = {
  // The whole surface with an agent attached: the board underneath, the
  // conversation over it, and a round in progress.
  Working: {
    themes: THEMES,
    nodes: NODES,
    events: EXCHANGE,
    status: 'connected',
    revision: 5,
    attachments: [{ name: 'shift-handover-notes.pdf' }],
  },

  // The state every preview and capture genuinely produces: no agent can bind
  // inside a frame, and the surface stays fully usable anyway. This is the one
  // a person actually meets most often.
  NoAgent: {
    themes: THEMES,
    nodes: NODES,
    events: EXCHANGE,
    status: 'unavailable',
    revision: 5,
  },

  // A tool in flight — the partner's turn, and the board says so rather than
  // going quiet.
  Working_Agent: {
    themes: THEMES,
    nodes: NODES,
    events: EXCHANGE,
    status: 'working',
    revision: 5,
  },

  // The moment after someone types an idea: a core and an empty conversation.
  // Both halves have to read as not-yet rather than as failed to load.
  JustArrived: {
    themes: [],
    nodes: [
      node('g-idea', null, 'idea', 'Handover between shifts', {
        status: 'answered',
      }),
    ],
    events: [],
    status: 'unavailable',
    revision: 0,
  },

  // Nothing open, and nothing answered in THIS sitting — a board someone has
  // come back to rather than one they have just finished. It must sit still:
  // the trigger is having finished a round, not arriving at a finished one, and
  // a countdown here would end a round on behalf of someone who has not
  // touched anything yet. Answering is what starts the clock, and the pencil on
  // an answered card is a real way to do that with no question left open.
  AllAnswered: {
    themes: THEMES,
    nodes: ANSWERED_NODES,
    events: EXCHANGE,
    status: 'connected',
    revision: 5,
  },

  // Further along the arc, where the step on offer is the last one before the
  // plan. Same board, different fork: the phase action reads "Draw up the plan"
  // rather than "Ready to research", and the note the round sends names the
  // phase it is due to reach.
  EndOfExplore: {
    themes: THEMES,
    nodes: ANSWERED_NODES,
    events: EXCHANGE,
    status: 'connected',
    revision: 5,
    phase: 'explore',
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = 'Working' } = await searchParams;
  const fixture = scenarios[s];
  if (!fixture) return <div>Unknown scenario: {s}</div>;

  // The workspace's root is `flex-1 min-h-0` — it is a flex CHILD that expects
  // a column parent with a real height, which is what `MapScreen` gives it. A
  // plain block wrapper makes `flex-1` inert and `min-h-0` collapse it to
  // nothing, so the frame comes back blank with no error to explain it. The
  // harness reproduces the parent it actually has, padding included.
  return (
    <div
      id="codeyam-capture"
      className="flex flex-col"
      style={{ height: '100vh', width: '100%', padding: '2rem 2.5rem' }}
    >
      <BridgeFixture
        status={fixture.status}
        reason={
          fixture.status === 'unavailable' ? 'running inside an iframe' : null
        }
        events={fixture.events}
        revision={fixture.revision}
      >
        <Component
          seedIdea={SEED_IDEA}
          mapId="map-galaxy"
          mapPhase={fixture.phase ?? 'map'}
          attachments={fixture.attachments}
          themes={fixture.themes}
          nodes={fixture.nodes}
        />
      </BridgeFixture>
    </div>
  );
}
