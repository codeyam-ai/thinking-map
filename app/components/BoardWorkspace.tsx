'use client';

// The board, wired to the exchange.
//
// A thin client shell: the geometry lives in GalaxyBoard and the durable record
// lives in the bridge, so what belongs here is turning what a person does into
// contributions the agent will read on its next pass.
//
// Answering is a WRITE BY THE PERSON, recorded as `user.answer` on the shared
// log. That is what makes this two-way rather than a form: the agent is not
// told the answer directly — it finds it, attributed, the next time it reads
// the map, exactly as the person finds the agent's questions here.

import { useCallback, useEffect, useRef, useState } from 'react';
import GalaxyBoard from './GalaxyBoard';
import RoundControl, { type RoundPhase } from './RoundControl';
import { useWebMcpBridge } from './WebMcpBridge';
import type { GalaxyNodeInput, GalaxyTheme } from '@/app/lib/galaxyLayout';

export default function BoardWorkspace({
  seedIdea,
  themes,
  nodes,
}: {
  seedIdea: string;
  themes: GalaxyTheme[];
  nodes: GalaxyNodeInput[];
}) {
  const bridge = useWebMcpBridge();
  const [phase, setPhase] = useState<RoundPhase>('idle');
  const [answeredThisRound, setAnsweredThisRound] = useState(0);

  const onAnswer = useCallback(
    (card: { id: string; label: string }, answer: string) => {
      // The question is passed explicitly rather than left to the bridge's
      // pending list. `answer()` defaults to whatever an agent is currently
      // blocked on, and answering a card on the board is usually not that —
      // nothing is pending, and the contribution would be recorded as empty.
      //
      // Fire-and-forget: the card has already cleared its draft, and making
      // someone wait on a round trip to see their own words land would make the
      // board feel slower than the typing that produced them.
      void bridge.answer({ [card.id]: answer }, [
        { id: card.id, text: card.label },
      ]);
      setAnsweredThisRound((n) => n + 1);
    },
    [bridge],
  );

  const onNext = useCallback(() => {
    setPhase('waiting');
    // One more entry on the log. The agent is blocked in `await_user_activity`
    // and wakes on any movement, so this is the whole mechanism — there is no
    // channel to push down, and inventing one would be a second source of truth
    // beside the log that both sides already agree on.
    void bridge.contribute('user.note', {
      text: 'Ready for the next round — bring what you have made of this.',
    });
  }, [bridge]);

  // The wait ends when the map actually moves, not on a timer: the agent has
  // written something when the revision rises past where it stood at the ask.
  const waitingFrom = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'waiting') return;
    if (waitingFrom.current === null) {
      waitingFrom.current = bridge.revision ?? 0;
      return;
    }
    if ((bridge.revision ?? 0) > waitingFrom.current) {
      setPhase('idle');
      setAnsweredThisRound(0);
      waitingFrom.current = null;
    }
  }, [phase, bridge.revision]);

  const openCount = nodes.filter(
    (n) => n.status === 'open' && n.kind === 'open-question',
  ).length;

  // Something to advance FROM: either the person has answered a card this
  // session, or the board is carrying answers from an earlier one. Waiting is
  // its own reason to show it, so the spinner has somewhere to live.
  const showRound =
    phase === 'waiting' ||
    answeredThisRound > 0 ||
    nodes.some((n) => n.kind === 'open-question' && n.status === 'answered');

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[26px] border border-white/10">
      <GalaxyBoard
        seedIdea={seedIdea}
        themes={themes}
        nodes={nodes}
        onAnswer={onAnswer}
      />
      {/* The control only appears once there is a round to end.
          The FIRST set of questions arrives on its own — creating the map is
          already a contribution, so an agent waiting on the log wakes and
          answers it without being asked to. Showing "Next round" before anyone
          has answered anything would put a button in front of someone whose
          only job right now is to read what just landed. */}
      {showRound ? (
        <RoundControl
          open={openCount}
          answered={answeredThisRound}
          phase={phase}
          onNext={onNext}
        />
      ) : null}
    </div>
  );
}
