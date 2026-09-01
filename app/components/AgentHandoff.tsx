'use client';

import CopyablePrompt from './CopyablePrompt';
import SeedIdeaQuote from './SeedIdeaQuote';
import { handoffCopy } from '../lib/handoffCopy';
import { useOptionalWebMcpBridge } from './WebMcpBridge';

/**
 * The panel a person meets when they submit an idea and nothing picks it up.
 *
 * This is the ordinary case, not the broken one: WebMCP is pull-only, so a map
 * that nobody is attached to simply sits there. Before this panel existed the
 * only sign of that was "No agent attached" in the header, which states a fact
 * about the page rather than telling the person what to do about it.
 *
 * A renderer only — every string it shows comes from `handoffCopy`, where the
 * tests can pin the wording. What it decides is *whether to appear at all*.
 */
export default function AgentHandoff({
  mapId,
  seedIdea,
  hasBrief,
}: {
  mapId: string;
  seedIdea?: string;
  hasBrief: boolean;
}) {
  const bridge = useOptionalWebMcpBridge();

  // The same predicate `NodeQuestionComposer` uses, deliberately: `working`
  // counts as listening, because a bridge mid-tool-call still sees this map
  // when its turn comes round. Two surfaces on one page disagreeing about
  // whether an agent is attached would be worse than either being wrong alone.
  // No bridge at all — an isolated scenario — is honest absence.
  const listening = bridge !== null && bridge.status !== 'unavailable';

  // A map an agent has already worked is not waiting for one. Someone reopening
  // it in a browser with no agent should see their map, not a handoff pitch.
  const workedByAgent = (bridge?.events ?? []).some((e) => e.origin === 'agent');

  if (listening || workedByAgent) return null;

  const copy = handoffCopy({ mapId, seedIdea, hasBrief });

  return (
    <section className="rounded-[20px] border border-line bg-surface p-6">
      <h2 className="eyebrow mb-3">{copy.eyebrow}</h2>
      <p className="text-[14px] leading-[1.55]">{copy.explanation}</p>
      <SeedIdeaQuote seedIdea={seedIdea} />
      <CopyablePrompt text={copy.startPrompt} label="Copy start prompt" />
      <p className="mt-4 text-[12px] leading-[1.6] text-muted">
        {copy.attachHint}
      </p>
    </section>
  );
}
