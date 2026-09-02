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
import { useRouter } from 'next/navigation';
import GalaxyBoard from './GalaxyBoard';
import RoundControl, { type RoundPhase } from './RoundControl';
import BoardChat from './BoardChat';
import { useWebMcpBridge } from './WebMcpBridge';
import type { GalaxyNodeInput, GalaxyTheme } from '@/app/lib/galaxyLayout';

export default function BoardWorkspace({
  seedIdea,
  mapId,
  attachments,
  themes,
  nodes,
}: {
  seedIdea: string;
  mapId: string;
  attachments?: { name: string }[];
  themes: GalaxyTheme[];
  nodes: GalaxyNodeInput[];
}) {
  const bridge = useWebMcpBridge();
  const router = useRouter();
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

  const onChoose = useCallback(
    (choice: string) => {
      setPhase('waiting');
      // A choice is a note, not an answer: no question on the map is being
      // closed. It says which way the thinking should go, and the partner
      // picks it up on its next read like everything else the person writes.
      void bridge.contribute('user.note', {
        text: `Take it this way: ${choice}`,
      });
    },
    [bridge],
  );

  const onSay = useCallback(
    (text: string) => {
      // A note, like a choice: nothing on the map is being closed. This is the
      // slot for everything the partner did not think to ask about.
      void bridge.contribute('user.note', { text });
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

  // Pull the board forward whenever the map moves.
  //
  // The nodes are rendered on the server, so without this the board is a
  // photograph: an answer the person just gave, and every question the partner
  // writes, sit in the database while the screen keeps showing the state it was
  // built with. The bridge already polls the log and knows the revision, so the
  // revision is the trigger — `router.refresh()` re-runs the server component
  // and swaps in fresh nodes without losing client state, which is what keeps
  // the camera, the focus and any half-typed draft where they were.
  const lastSeen = useRef<number | null>(null);
  useEffect(() => {
    const rev = bridge.revision;
    if (rev === null || rev === undefined) return;
    if (lastSeen.current === null) {
      lastSeen.current = rev;
      return;
    }
    if (rev > lastSeen.current) {
      lastSeen.current = rev;
      router.refresh();
    }
  }, [bridge.revision, router]);

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
        mapId={mapId}
        attachments={attachments}
        themes={themes}
        nodes={nodes}
        onAnswer={onAnswer}
        onChoose={onChoose}
      />
      {/* The chat is ALWAYS here; the round control rides along inside it
          only once there is a round to end. The first set of questions arrives
          on its own — creating the map is already a contribution — so showing
          "Next round" before anyone has answered anything would put a button in
          front of someone whose only job right now is to read what landed. */}
      <BoardChat
        events={bridge.events}
        onSend={onSay}
        trailing={
          showRound ? (
            <RoundControl
              open={openCount}
              answered={answeredThisRound}
              phase={phase}
              onNext={onNext}
            />
          ) : null
        }
      />
    </div>
  );
}
