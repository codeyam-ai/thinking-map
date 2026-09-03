// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AgentHandoff from './AgentHandoff';
import BridgeFixture from '../isolated-components/BridgeFixture';
import type { ExchangeEvent } from '../lib/exchange';

// WHEN this panel appears, which is the whole of its logic — the wording it
// shows is pinned in handoffCopy.test.ts.
//
// The two rules it enforces cannot be seen from a screenshot of the good case:
// a bridge mid-tool-call still counts as attached, and a map an agent has
// already worked is not waiting for one. Both are cases where the panel must
// render NOTHING, and nothing is exactly what a passing capture of the other
// state also looks like.
//
// Mounted through BridgeFixture because an isolated render can only ever
// produce `unavailable` on its own — every other bridge state has to be given.

const MAP_ID = 'map-under-test';

const agentEvent = (): ExchangeEvent => ({
  id: 'e1',
  revision: 2,
  kind: 'agent.note',
  origin: 'agent',
  payload: { text: 'I have started on this' },
  createdAt: new Date(),
});

const userEvent = (): ExchangeEvent => ({
  id: 'e0',
  revision: 1,
  kind: 'node.added',
  origin: 'user',
  payload: { label: 'A chore app' },
  createdAt: new Date(),
});

afterEach(cleanup);

describe('AgentHandoff', () => {
  // The reported case: someone submitted an idea, nothing is attached, and the
  // log holds only their own root node.
  it('renders when nothing is attached and no agent has worked the map', () => {
    render(
      <BridgeFixture status="unavailable" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(screen.getByText(/No one is on this yet/i)).toBeTruthy();
  });

  // Attached is not working. WebMCP is pull-only, so a bound agent has the
  // whole catalog and no instruction — and rendering nothing here left the page
  // at its most capable showing nothing to act on, which is the state a person
  // reads as "it connected and then did nothing".
  it('asks the person to start an agent that is attached but idle', () => {
    render(
      <BridgeFixture status="connected" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(screen.getByText(/Your agent can see this map/i)).toBeTruthy();
    expect(screen.getByText(/read_map/)).toBeTruthy();
  });

  // The full attach pitch is still wrong here: the agent is already attached,
  // so two doors and an MCP command are answers to a question this person no
  // longer has.
  it('does not re-pitch attaching to an agent that is already attached', () => {
    render(
      <BridgeFixture status="connected" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(screen.queryByText(/No one is on this yet/i)).toBeNull();
    expect(screen.queryByText(/claude mcp add/i)).toBeNull();
  });

  // The case that would drift. `working` means a tool is mid-flight, and that
  // agent still sees this map when its turn comes round — so it counts as
  // attached, exactly as askPresence treats it. If this and the node-question
  // composer ever disagreed, one page would contradict itself.
  it('renders nothing once the attached agent has actually worked the map', () => {
    const { container } = render(
      <BridgeFixture status="working" events={[agentEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(container.textContent).toBe('');
  });

  // Reopening a map an agent has already contributed to, in a browser with no
  // agent. The full pitch would be wrong — but so is showing nothing: this is
  // exactly the state where someone needs the way back in, and rendering null
  // left them with a header saying "No agent attached" and no route to change
  // that.
  it('still offers a way back in on a map an agent has already worked', () => {
    const { container } = render(
      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(container.textContent).not.toBe('');
    expect(screen.getByText(new RegExp(MAP_ID))).toBeTruthy();
    expect(container.textContent).not.toMatch(/No one is on this yet/i);
  });

  // The demoted band is a SUBTRACTION, and presence-only assertions cannot see
  // a subtraction come undone. The steps and the seed quote are written for a
  // first meeting; putting them back here is the drift this pins.
  it('drops the first-meeting steps and quote from the reattach strip', () => {
    const { container } = render(
      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(container.querySelector('ol')).toBeNull();
    // The QUOTE BLOCK, not the phrase: the seed idea legitimately appears
    // inside the start prompt, so asserting on the bare words would fail on a
    // correct render. SeedIdeaQuote is what wraps it in curly quotes.
    expect(container.textContent).not.toMatch(/“A chore app”/);
  });

  // The MCP command is the half of the reattach strip an AGENT can act on — the
  // start prompt is for the person. Losing it would leave the strip naming a
  // door without opening it, which is the state the whole change is a fix for.
  it('offers the MCP command alongside the prompt when reattaching', () => {
    render(
      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    // The COPY BUTTON, not the command text: `attachHint` names `npm run mcp`
    // in prose too, so matching the text alone would pass on the old band that
    // only ever mentioned the door. A copy button is the thing that makes it
    // actionable, which is the whole distinction being drawn here.
    expect(screen.getByRole('button', { name: /Copy MCP command/i })).toBeTruthy();
  });

  // The finished-plan screen. `MapScreen` is an `h-screen` flex column and this
  // strip is `shrink-0`, so every row it takes comes out of the summary the
  // person came back to read — the dense variant drops the heading line and puts
  // both commands on one row. Both commands must SURVIVE the shrink: dropping
  // one would be a smaller strip that no longer does its job.
  it('drops the heading but keeps both commands when dense', () => {
    const { container } = render(
      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} dense />
      </BridgeFixture>,
    );
    expect(container.textContent).not.toMatch(/Pick this back up/i);
    expect(screen.getByRole('button', { name: /Copy start prompt/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy MCP command/i })).toBeTruthy();
    expect(screen.getByText(new RegExp(MAP_ID))).toBeTruthy();
  });

  // The default is the full strip — a component that silently rendered its
  // compact form everywhere would pass the dense test above and still be wrong
  // on every working map.
  it('keeps the heading on the reattach strip by default', () => {
    render(
      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(screen.getByText(/Pick this back up/i)).toBeTruthy();
  });

  // The full band opens on the route that works for EVERY agent — the bare
  // endpoint — not on one client's command. This is the fact the panel used to
  // get wrong: it offered `claude mcp add` and nothing else, so a reader
  // holding ChatGPT desktop or Cursor was shown a command they cannot run and
  // never shown the address they needed.
  it('opens the full band on the endpoint every agent can use', () => {
    render(<AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />);
    expect(screen.getByRole('button', { name: /Copy MCP URL/i })).toBeTruthy();
    // And only ONE way in is on screen at a time — the reason these are tabs
    // rather than a stack, and the thing a reader loses if someone later
    // "helpfully" renders every panel at once.
    expect(screen.queryByRole('button', { name: /Copy MCP command/i })).toBeNull();
  });

  // The command did not go away, it moved behind the tab that owns it. Driven
  // rather than asserted on a hidden node: a tab that renders its panel but
  // never responds to a click is the failure this catches, and it looks
  // identical to a working one in any static query.
  it('reaches the Claude Code command through its tab', () => {
    render(<AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />);
    fireEvent.click(screen.getByRole('tab', { name: /Claude Code/i }));
    expect(screen.getByRole('button', { name: /Copy MCP command/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Copy MCP URL/i })).toBeNull();
  });

  // The deliberate subtraction. `HandoffReattach` is for someone who has
  // attached before and knows which door they use, so it shows the command
  // flat with no three-way choice around it. A tab strip appearing here would
  // be the full band's onboarding leaking back into the screen that exists to
  // not have it.
  it('gives the reattach strip the command flat, with no tabs', () => {
    render(
      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(screen.getByRole('button', { name: /Copy MCP command/i })).toBeTruthy();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Copy MCP URL/i })).toBeNull();
  });

  // No provider at all — an isolated scenario. useOptionalWebMcpBridge returns
  // null rather than throwing, and absence is honest absence.
  it('renders without a bridge provider at all', () => {
    render(<AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />);
    expect(screen.getByText(/No one is on this yet/i)).toBeTruthy();
  });

  // The prompt is the useful part, and it is useless without the id.
  it('shows a start prompt naming this map', () => {
    render(
      <BridgeFixture status="unavailable" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(screen.getByText(new RegExp(MAP_ID))).toBeTruthy();
  });

  // A brief-started map has no sentence, so the panel must not render empty
  // quote marks where the person's words would go.
  it('shows no quoted idea for a map started from a brief', () => {
    const { container } = render(
      <BridgeFixture status="unavailable" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} hasBrief />
      </BridgeFixture>,
    );
    expect(screen.getByText(/No one is on this yet/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/“”/);
  });

  // The instruction has to be ON the panel at all — it is the sentence the
  // panel existed without, and the one someone arriving actually needs.
  it('renders the instruction and both steps', () => {
    render(<AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />);
    expect(screen.getByText(/Hand this to your agent/i)).toBeTruthy();
    expect(screen.getByText(/Copy the prompt below/i)).toBeTruthy();
    expect(screen.getByText(/Paste it into your agent/i)).toBeTruthy();
  });

  // The ORDER is the change, so asserting only presence would let the old
  // arrangement back in unnoticed — the panel used to open with the
  // explanation and reach the prompt third, which is exactly the layout that
  // still passes a presence-only check.
  it('puts the instruction before the explanation in document order', () => {
    const { container } = render(
      <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />,
    );
    const text = container.textContent ?? '';
    const instruction = text.indexOf('Hand this to your agent');
    const prompt = text.indexOf(MAP_ID);
    const explanation = text.indexOf('Your idea is saved');

    expect(instruction).toBeGreaterThanOrEqual(0);
    expect(prompt).toBeGreaterThan(instruction);
    expect(explanation).toBeGreaterThan(prompt);
  });

  // Steps are numbered because their order is the content. An unordered list
  // renders the same words and loses the only thing making them instructions.
  it('renders the steps as an ordered list', () => {
    const { container } = render(
      <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />,
    );
    const list = container.querySelector('ol');
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll('li')).toHaveLength(2);
  });
});
