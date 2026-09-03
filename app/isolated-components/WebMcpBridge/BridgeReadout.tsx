'use client';

// A readout of what the bridge knows, so the bridge has something to show.
//
// WebMcpBridge renders only a context provider — it has no appearance of its
// own — so an isolated capture of it alone would be a blank frame. This
// consumer makes its state visible: whether an agent is attached, why not when
// it is not, and which tools are reachable through the headless driver
// regardless. It lives beside the isolation route because it exists only to
// give that route something to render.

import { useWebMcpBridge } from '@/app/components/WebMcpBridge';

const STATUS_COPY: Record<string, string> = {
  unavailable: 'No agent attached',
  connected: 'Agent attached',
  working: 'Agent working',
};

const DEFAULT_QUESTIONS = [
  'Do you reread your own notes today?',
  'Is this for you alone, or shared?',
];

export default function BridgeReadout({
  questions = DEFAULT_QUESTIONS,
}: {
  /** What the trigger asks. Parameterised so one scenario can show a couple of
   *  short questions and another the long, many-question state an agent
   *  deconstructing an idea actually produces. */
  questions?: string[];
}) {
  const { status, reason, pending, tools, revision, answer } = useWebMcpBridge();

  // Drives the REAL ask_user path through the headless driver, so the pending
  // state a scenario captures is the one the code actually produces rather than
  // a prop staged to look like it.
  const askThroughDriver = () => {
    void window.__thinkingMapAgent?.callTool('ask_user', {
      questions,
      timeoutSeconds: 600,
    });
  };

  return (
    <section className="w-full max-w-[560px] rounded-[20px] border border-line bg-surface p-6">
      <h2 className="eyebrow mb-4">Agent connection</h2>

      <div className="mb-5 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${
            status === 'unavailable' ? 'bg-ink-soft' : 'bg-lime'
          }`}
        />
        <span className="text-[15px] font-medium text-ink">
          {STATUS_COPY[status] ?? status}
        </span>
        {reason ? (
          <span className="text-[13px] text-muted">— {reason}</span>
        ) : null}
      </div>

      <p className="mb-5 text-[13px] leading-relaxed text-muted">
        The map stays fully readable either way. These tools are reachable
        through the page&rsquo;s driver even with no browser agent present,
        which is how they are exercised in a preview.
      </p>

      <ul className="mb-5 flex flex-wrap gap-2">
        {tools.map((name) => (
          <li
            key={name}
            className="rounded-full border border-line px-3 py-1 font-mono text-[12px] text-ink"
          >
            {name}
          </li>
        ))}
        {tools.length === 0 ? (
          <li className="text-[13px] text-muted">No tools bound.</li>
        ) : null}
      </ul>

      {pending.length > 0 ? (
        <div className="mb-5 rounded-[16px] border border-dashed border-ink-soft p-4">
          <h3 className="eyebrow mb-3">The agent is waiting on you</h3>
          <ul className="mb-4 flex flex-col gap-2">
            {pending.map((question) => (
              <li key={question.id} className="text-[14px] leading-snug text-ink">
                {question.text}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              answer(Object.fromEntries(pending.map((q) => [q.id, 'Almost never'])))
            }
            className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper"
          >
            Answer and release the agent
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={askThroughDriver}
          className="mb-5 rounded-full border border-line px-4 py-1.5 text-[13px] text-ink"
        >
          Have the agent ask two questions
        </button>
      )}

      <dl className="flex gap-8 border-t border-line pt-4 text-[13px]">
        <div>
          <dt className="eyebrow mb-1">Revision</dt>
          <dd className="font-mono text-ink">{revision ?? '—'}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1">Awaiting answer</dt>
          <dd className="font-mono text-ink">{pending.length}</dd>
        </div>
      </dl>
    </section>
  );
}
