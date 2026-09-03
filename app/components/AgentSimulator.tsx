'use client';

import { useState } from 'react';
import AgentCallLog, { type AgentCallLine } from './AgentCallLog';
import AgentPanelLauncher from './AgentPanelLauncher';
import AgentToolRunner from './AgentToolRunner';
import {
  DEMO_REFUSAL,
  DEMO_SEQUENCE,
  demoWouldOverwrite,
  resultText,
} from '../lib/agentDemo';

/**
 * A stand-in agent, for development and for captures.
 *
 * This is not a mock. WebMCP is top-level-secure-context only and codeyam
 * renders the app inside a capture iframe, so `navigator.modelContext` is
 * genuinely absent in every preview and every scenario — no real agent can ever
 * be attached in the places this product most needs demonstrating. The panel
 * drives `window.__thinkingMapAgent`, which is the SAME bound catalog a real
 * agent calls, so a scripted give-and-take here exercises the real tool paths
 * rather than a simulation of them.
 *
 * Rendered only where a person has deliberately asked for it — `?agentPanel=1`
 * on the map page, with a production floor underneath. Being a dev build is NOT
 * sufficient, and that is the point: an agent driving the browser in an
 * ordinary `npm run dev` session used to find this panel on every real map and
 * press the most clickable thing on it.
 */
export default function AgentSimulator() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('read_map');
  const [input, setInput] = useState('{}');
  const [lines, setLines] = useState<AgentCallLine[]>([]);
  const [busy, setBusy] = useState(false);

  const driver = () =>
    typeof window === 'undefined' ? undefined : window.__thinkingMapAgent;
  const tools = driver()?.listTools() ?? [];

  const say = (label: string, detail: string, failed = false) =>
    setLines((prev) => [...prev, { label, detail, failed }].slice(-40));

  const run = async (toolName: string, toolInput: unknown) => {
    const agent = driver();
    if (!agent) {
      say(toolName, 'No driver on window — is the bridge mounted?', true);
      return;
    }
    try {
      const result = await agent.callTool(toolName, toolInput);
      say(
        toolName,
        resultText(result),
        Boolean((result as { isError?: boolean }).isError),
      );
    } catch (error) {
      say(toolName, error instanceof Error ? error.message : String(error), true);
    }
  };

  const runOne = async () => {
    if (busy) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(input || '{}');
    } catch {
      say(name, 'Input is not valid JSON.', true);
      return;
    }
    setBusy(true);
    await run(name, parsed);
    setBusy(false);
  };

  // Only the SEQUENCE is guarded. `runOne` is untouched on purpose: a deliberate
  // single call is the panel's other reason to exist, and someone who types a
  // tool name and presses run has said what they want. The sequence is the one
  // that writes seven steps of invented content off one click.
  const runSequence = async () => {
    if (busy) return;
    const agent = driver();
    if (!agent) {
      say('read_map', 'No driver on window — is the bridge mounted?', true);
      return;
    }
    setBusy(true);
    setLines([]);

    // `sinceRevision: 0` asks for the whole log, which is the one shape of this
    // reply carrying structured events rather than prose meant to be read.
    say('read_map', '→ checks there is nothing here worth overwriting');
    let survey: unknown;
    try {
      survey = await agent.callTool('read_map', { sinceRevision: 0 });
      say('read_map', resultText(survey));
    } catch (error) {
      say('read_map', error instanceof Error ? error.message : String(error), true);
      setBusy(false);
      return;
    }

    if (demoWouldOverwrite(survey)) {
      say('run the demo sequence', DEMO_REFUSAL, true);
      setBusy(false);
      return;
    }

    for (const step of DEMO_SEQUENCE) {
      say(step.name, `→ ${step.note}`);
      await run(step.name, step.input);
    }
    setBusy(false);
  };

  if (!open) return <AgentPanelLauncher onOpen={() => setOpen(true)} />;

  return (
    // Bottom-LEFT, above the zoom stack, for the reason written on
    // AgentPanelLauncher: open in the bottom-RIGHT this 340px-wide, 70vh-tall
    // panel covered the conversation outright, and its z-40 against BoardChat's
    // z-30 guaranteed it won. The height is additionally capped against the
    // viewport so that growing upward from the 208px offset cannot push the
    // panel's head off the top of a short screen.
    <aside className="fixed bottom-[208px] left-12 z-40 flex max-h-[min(70vh,calc(100vh-240px))] w-[340px] flex-col rounded-[16px] border border-line bg-surface p-4 shadow-lg">
      <header className="mb-2 flex shrink-0 items-center justify-between">
        <span className="eyebrow">Agent panel · dev</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-muted hover:text-ink"
        >
          Close
        </button>
      </header>

      <p className="mb-2 shrink-0 text-[11px] leading-snug text-muted">
        Drives the same bound tools a real agent calls. No agent can attach
        inside a preview frame, so this is how the exchange is demonstrated.
      </p>

      <button
        type="button"
        onClick={() => void runSequence()}
        disabled={busy}
        className="mb-3 shrink-0 rounded-full bg-ink px-3 py-1.5 text-[11.5px] text-white transition hover:opacity-90 disabled:opacity-40"
      >
        {busy ? 'Running…' : 'Run the demo sequence'}
      </button>

      <div className="mb-2 shrink-0">
        <AgentToolRunner
          tools={tools}
          name={name}
          input={input}
          busy={busy}
          onNameChange={setName}
          onInputChange={setInput}
          onRun={() => void runOne()}
        />
      </div>

      <AgentCallLog lines={lines} />
    </aside>
  );
}
