'use client';

import { useState } from 'react';
import AgentCallLog, { type AgentCallLine } from './AgentCallLog';
import AgentPanelLauncher from './AgentPanelLauncher';
import AgentToolRunner from './AgentToolRunner';
import { DEMO_SEQUENCE, resultText } from '../lib/agentDemo';

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
 * Rendered outside production only.
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

  const runSequence = async () => {
    if (busy) return;
    setBusy(true);
    setLines([]);
    for (const step of DEMO_SEQUENCE) {
      say(step.name, `→ ${step.note}`);
      await run(step.name, step.input);
    }
    setBusy(false);
  };

  if (!open) return <AgentPanelLauncher onOpen={() => setOpen(true)} />;

  return (
    <aside className="fixed bottom-4 right-4 z-40 flex max-h-[70vh] w-[340px] flex-col rounded-[16px] border border-line bg-surface p-4 shadow-lg">
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
