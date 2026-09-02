// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WebMcpBridge } from './WebMcpBridge';
import BridgeReadout from '../isolated-components/WebMcpBridge/BridgeReadout';

// What each seeded WebMcpBridge state actually RENDERS.
//
// The rest of this feature's tests assert the logic behind the bridge; nothing
// asserted the output, and a green suite can pass while a surface renders the
// wrong state. That is not hypothetical here: an earlier BridgeReadout read the
// tool list off the published driver, so it rendered "No tools bound" while the
// copy beside it claimed the tools were reachable. Every test below would have
// caught it; only a screenshot did.
//
// The pending states are driven through the real ask_user path — validate,
// forward, then hand the questions to the page — with only the network faked,
// so what is asserted is the state the code actually produces.

// The bridge re-renders the server component when the log moves past what was
// rendered — without that, a question answered in the panel would stay dashed
// on the map. `useRouter` needs an App Router context that a bare jsdom render
// has none of, so it is stubbed here; `refresh` being a no-op is correct for
// these tests, which assert what the bridge renders rather than what Next does.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const TOOL_NAMES = [
  'read_map',
  'add_nodes',
  'update_node',
  'set_phase',
  'post_note',
  'ask_user',
  'await_user_activity',
];

/** Answer the tools route with the pending shape ask_user really returns.
 *
 *  Real `Response` objects rather than `{ ok, json }` stand-ins: the bridge
 *  reads a reply through `readJson`, which consumes the body as text so a
 *  truncated one cannot throw a parse error at a callback. A hand-rolled fake
 *  with only `json` on it does not answer that, and a mock that is missing the
 *  half of the API under test proves nothing about the half it does have. */
function mockAskUser(questions: string[]) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/tools')) {
      return Response.json({
        content: [{ type: 'text', text: 'asked' }],
        structuredContent: {
          status: 'pending',
          questions: questions.map((text, i) => ({ id: `q-${i}`, text })),
        },
      });
    }
    // The exchange route, where an answer is recorded.
    return Response.json({ revision: 15, events: [], deduped: false });
  });
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return fetchMock;
}

function renderBridge(questions?: string[]) {
  return render(
    <WebMcpBridge mapId="map-exchange">
      <BridgeReadout {...(questions ? { questions } : {})} />
    </WebMcpBridge>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WebMcpBridge - NoAgent', () => {
  // WebMcpBridge renders its resting state — the one every preview and capture
  // shows. It must say an agent is absent, with a reason, rather than looking
  // broken or, worse, claiming a connection it does not have.
  it('reports that no agent is attached, with a reason', () => {
    renderBridge();
    expect(screen.getByText('No agent attached')).toBeDefined();
    // A reason, not a bare dash: the revision field also renders "—", so this
    // matches only the em-dash that is followed by explanatory text.
    expect(
      screen.getByText((_, el) => /^—\s+\S/.test(el?.textContent ?? '')),
    ).toBeDefined();
  });

  // The regression this file exists for: WebMcpBridge renders copy promising
  // these tools are reachable, so all seven must actually appear beside it.
  it('renders every catalog tool rather than an empty list', () => {
    renderBridge();
    for (const name of TOOL_NAMES) {
      expect(screen.getByText(name)).toBeDefined();
    }
    expect(screen.queryByText('No tools bound.')).toBeNull();
  });

  // With nothing outstanding, WebMcpBridge shows the trigger rather than the
  // answer block, and displays a zero count.
  it('shows nothing awaiting an answer', () => {
    renderBridge();
    expect(screen.getByText('0')).toBeDefined();
    expect(screen.queryByText('The agent is waiting on you')).toBeNull();
    expect(screen.getByText('Have the agent ask two questions')).toBeDefined();
  });
});

describe('WebMcpBridge - pending states', () => {
  // WebMcpBridge renders the none-to-some boundary: exactly one question
  // outstanding, with its text on screen.
  it('renders a single outstanding question', async () => {
    mockAskUser(['Is this for you alone, or shared?']);
    renderBridge(['Is this for you alone, or shared?']);
    fireEvent.click(screen.getByText('Have the agent ask two questions'));

    await waitFor(() =>
      expect(screen.getByText('Is this for you alone, or shared?')).toBeDefined(),
    );
    expect(screen.getByText('1')).toBeDefined();
  });

  // WebMcpBridge displays both questions and shows the status flipped to
  // working — the agent's turn is paused until the person answers.
  it('renders both questions and marks the agent as working', async () => {
    const questions = [
      'Do you reread your own notes today?',
      'Is this for you alone, or shared?',
    ];
    mockAskUser(questions);
    renderBridge(questions);
    fireEvent.click(screen.getByText('Have the agent ask two questions'));

    await waitFor(() => expect(screen.getByText('Agent working')).toBeDefined());
    for (const q of questions) expect(screen.getByText(q)).toBeDefined();
    expect(screen.getByText('The agent is waiting on you')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  // The many state: WebMcpBridge renders all five full-sentence questions
  // rather than truncating to the first few.
  it('renders every question when an agent asks several at once', async () => {
    const questions = [
      'Who is this for, specifically — you, or someone you have watched struggle with it?',
      'What are they doing today instead, and what does that cost them?',
      'If this existed and worked perfectly, what would change about their week?',
      'What have you already tried and bounced off, and what made you stop?',
      'Is there a version of this that is a habit rather than a product?',
    ];
    mockAskUser(questions);
    renderBridge(questions);
    fireEvent.click(screen.getByText('Have the agent ask two questions'));

    await waitFor(() => expect(screen.getByText('5')).toBeDefined());
    for (const q of questions) expect(screen.getByText(q)).toBeDefined();
  });

  // Answering releases the agent, and WebMcpBridge renders its resting state
  // again. The answer must reach the log too, since an agent that already gave
  // up can only find it there.
  it('clears the questions and records the answer once the person replies', async () => {
    const questions = ['Do you reread your own notes today?'];
    const fetchMock = mockAskUser(questions);
    renderBridge(questions);
    fireEvent.click(screen.getByText('Have the agent ask two questions'));

    await waitFor(() => expect(screen.getByText('The agent is waiting on you')).toBeDefined());
    fireEvent.click(screen.getByText('Answer and release the agent'));

    await waitFor(() =>
      expect(screen.queryByText('The agent is waiting on you')).toBeNull(),
    );
    expect(screen.getByText('Have the agent ask two questions')).toBeDefined();

    const posted = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(posted.some((url) => url.includes('/exchange'))).toBe(true);
  });
});
