'use client';

import { useEffect, useState } from 'react';
import AgentStartCue from './AgentStartCue';
import CopyablePrompt from './CopyablePrompt';
import HandoffFootnote from './HandoffFootnote';
import HandoffInstruction from './HandoffInstruction';
import HandoffReattach from './HandoffReattach';
import SeedIdeaQuote from './SeedIdeaQuote';
import { attachedStartCopy, handoffCopy } from '../lib/handoffCopy';
import { useOptionalWebMcpBridge } from './WebMcpBridge';

/**
 * The panel a person meets when they submit an idea and nothing picks it up.
 *
 * This is the ordinary case, not the broken one: WebMCP is pull-only, so a map
 * that nobody is attached to simply sits there. Before this panel existed the
 * only sign of that was "No agent attached" in the header, which states a fact
 * about the page rather than telling the person what to do about it.
 *
 * It leads with the instruction and follows with the explanation, in that
 * order, because someone who just pressed return wants to know what to DO. The
 * honest paragraph about why nobody is attached is still here — it has simply
 * stopped being the first thing they read on the way to the prompt.
 *
 * A renderer only — every string it shows comes from `handoffCopy`, where the
 * tests can pin the wording. What it decides is *whether to appear at all*.
 */
export default function AgentHandoff({
  mapId,
  seedIdea,
  hasBrief,
  dense = false,
}: {
  mapId: string;
  seedIdea?: string;
  hasBrief: boolean;
  /**
   * Render the reattach strip as one row. Passed by `MapScreen` on the
   * finished-plan view, where the summary is what the person came back for and
   * this main is an `h-screen` flex column — so every row this takes is a row
   * the summary loses. Affects only the demoted strip; the full band already
   * only appears on maps that have nothing else competing for the space.
   */
  dense?: boolean;
}) {
  const bridge = useOptionalWebMcpBridge();

  // Read after mount rather than during render: this component server-renders,
  // and `window` is not there yet. Starting undefined means the first paint
  // shows the `npm run mcp` fallback — correct, if less useful — and the HTTP
  // form replaces it once the browser's own address is knowable.
  const [origin, setOrigin] = useState<string>();
  useEffect(() => setOrigin(window.location.origin), []);

  // The same predicate `NodeQuestionComposer` uses, deliberately: `working`
  // counts as listening, because a bridge mid-tool-call still sees this map
  // when its turn comes round. Two surfaces on one page disagreeing about
  // whether an agent is attached would be worse than either being wrong alone.
  // No bridge at all — an isolated scenario — is honest absence.
  const listening = bridge !== null && bridge.status !== 'unavailable';

  // A map an agent has already worked is not waiting for one. Someone reopening
  // it in a browser with no agent should see their map, not a handoff pitch.
  const workedByAgent = (bridge?.events ?? []).some((e) => e.origin === 'agent');

  // Attached is not the same as working.
  //
  // Returning null here unconditionally was the bug: WebMCP is pull-only, so
  // binding the tools makes the map REACHABLE and nothing more. The page hit
  // its most capable state and rendered nothing to act on, while an agent sat
  // beside it with the whole catalog and no instruction. An agent that has
  // already written to this map plainly has its instruction, and that is the
  // only case where showing nothing is right.
  if (listening) {
    if (workedByAgent) return null;
    const cue = attachedStartCopy({ hasBrief });
    return (
      <AgentStartCue
        eyebrow={cue.eyebrow}
        instruction={cue.instruction}
        note={cue.note}
        prompt={cue.prompt}
        dense={dense}
      />
    );
  }

  const copy = handoffCopy({
    mapId,
    seedIdea,
    hasBrief,
    worked: workedByAgent,
    resumeRevision: bridge?.revision,
    origin,
  });

  // Demoted, not deleted.
  //
  // Hiding this outright was the right instinct applied one step too far: the
  // full lime pitch IS wrong on a map with an agent's work already on it. But
  // "an agent worked here and has since detached" is precisely the state where
  // someone needs a route back in, and rendering nothing left them with a
  // header that says "No agent attached" and no way to change that.
  if (workedByAgent) {
    return (
      <HandoffReattach
        eyebrow={copy.eyebrow}
        instruction={copy.instruction}
        startPrompt={copy.startPrompt}
        mcpCommand={copy.mcpCommand}
        dense={dense}
      />
    );
  }

  return (
    // Lime, and a heavier border than the surrounding cards: on this screen it
    // is the one thing asking to be acted on, and it has to win that comparison
    // against a whole map underneath it.
    //
    // `shrink-0` lives here rather than on a wrapper in MapScreen: that main is
    // an `h-screen` flex column, so without it the band would be squeezed on a
    // short viewport — and a wrapper div would remain a zero-height flex item
    // collecting gaps on the maps where this returns null.
    <section className="shrink-0 rounded-[20px] border-2 border-lime-deep bg-surface p-6">
      <HandoffInstruction
        eyebrow={copy.eyebrow}
        instruction={copy.instruction}
        steps={copy.steps}
      />
      <CopyablePrompt
        text={copy.startPrompt}
        label="Copy start prompt"
        tone="primary"
      />
      <SeedIdeaQuote seedIdea={seedIdea} />
      <HandoffFootnote
        explanation={copy.explanation}
        attachHint={copy.attachHint}
        attachTabs={copy.attachTabs}
      />
    </section>
  );
}
