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
//
// The ROUND ends itself. Answering the last open question is already the whole
// signal — the board says "everything is answered" and then used to sit there
// waiting to be told what it had just finished working out. So the same
// condition arms a short countdown instead, and the countdown does what the
// button did. Two phases run here and they are not the same thing: `roundPhase`
// is this component's idle/waiting, and `mapPhase` is where the whole map is on
// its arc. The arc is what makes the loop terminate — `next-steps` has no next,
// so the rounds carry the map to an end rather than going round forever.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import GalaxyBoard from './GalaxyBoard';
// `RoundControl` is deliberately NOT imported — hidden, like the chat, not
// deleted. Its component and scenarios stand; the bar simply no longer shows a
// button for the one thing the board already does for itself.
import { type RoundPhase } from './RoundControl';
// `BoardChat` is deliberately NOT imported. The panel is HIDDEN, not deleted:
// the component, its parts and its scenarios all stand, and the day a
// transcript earns its place back on this surface it is one import away. What
// it used to carry — saying something, ending a round, ending a phase — moved
// into `BoardNav`, so nothing was lost by unmounting it.
import PhaseAdvance from './PhaseAdvance';
import { useWebMcpBridge } from './WebMcpBridge';
import { useSelfEndingRound } from '@/app/hooks/useSelfEndingRound';
import { boardInsightStream } from '@/app/lib/boardInsights';
import { roundEndNote, roundIsFinished } from '@/app/lib/roundEnd';
import { PHASE_ASK, type Phase } from '@/app/lib/mapKinds';
import type { GalaxyNodeInput, GalaxyTheme } from '@/app/lib/galaxyLayout';
import type { Attachment } from '@/app/lib/attachments';

/** How long the board waits before ending the round on its own.
 *
 *  Long enough to read the sentence and reach the cancel; short enough that it
 *  does not become another thing to wait through. It is not a safety margin —
 *  typing cancels it outright — so it is sized for reading, not for hesitating. */
const AUTO_ROUND_SECONDS = 10;

export default function BoardWorkspace({
  seedIdea,
  mapId,
  mapPhase,
  attachments,
  themes,
  nodes,
}: {
  seedIdea: string;
  mapId: string;
  /** Where the whole map is on its arc. Required rather than defaulted: a
   *  silently-defaulting phase is how `PhaseAdvance` came to offer the wrong
   *  next step from a view nobody was rendering, and a wrong default here would
   *  send the agent a note naming a phase the map is not in. */
  mapPhase: Phase;
  attachments?: Attachment[];
  themes: GalaxyTheme[];
  nodes: GalaxyNodeInput[];
}) {
  const bridge = useWebMcpBridge();
  const router = useRouter();
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('idle');
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
      setRoundPhase('waiting');
      // A choice is a note, not an answer: no question on the map is being
      // closed. It says which way the thinking should go, and the partner
      // picks it up on its next read like everything else the person writes.
      void bridge.contribute('user.note', {
        text: `Take it this way: ${choice}`,
      });
    },
    [bridge],
  );

  const onAskMore = useCallback(() => {
    setRoundPhase('waiting');
    // A note, like every other contribution: WebMCP is pull-only, so the page
    // cannot wake an agent — it writes to the shared log and the partner, which
    // is sitting in `await_user_activity`, wakes because the log moved. Naming
    // what is being asked for matters as much here as it does at a round's end:
    // "more" is not an instruction, "ask me more questions about this" is.
    void bridge.contribute('user.note', {
      text: 'Ask me another round of questions — I have more to give you on this.',
    });
  }, [bridge]);

  const onSay = useCallback(
    (text: string) => {
      // A note, like a choice: nothing on the map is being closed. This is the
      // slot for everything the partner did not think to ask about.
      void bridge.contribute('user.note', { text });
    },
    [bridge],
  );

  const onNext = useCallback(() => {
    setRoundPhase('waiting');
    // One more entry on the log. The agent is blocked in `await_user_activity`
    // and wakes on any movement, so this is the whole mechanism — there is no
    // channel to push down, and inventing one would be a second source of truth
    // beside the log that both sides already agree on.
    //
    // The note NAMES THE FORK rather than just saying "your turn" — see
    // `roundEndNote`, which is where the words and the reasoning live.
    void bridge.contribute('user.note', { text: roundEndNote(mapPhase) });
  }, [bridge, mapPhase]);

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
    if (roundPhase !== 'waiting') return;
    if (waitingFrom.current === null) {
      waitingFrom.current = bridge.revision ?? 0;
      return;
    }
    if ((bridge.revision ?? 0) > waitingFrom.current) {
      // Zeroing the count also re-arms the countdown for the round that just
      // began: it disarms the hook, which is what clears any hold the person
      // put on the round that ended.
      setRoundPhase('idle');
      setAnsweredThisRound(0);
      waitingFrom.current = null;
    }
  }, [roundPhase, bridge.revision]);

  // Computed once, here, and handed down. The stream is the same reading of
  // the same nodes that `read_map` gives the agent, so deriving it inside the
  // board would let the two drift — and this is also where the live refresh
  // already re-runs on every revision bump, so a newly written insight appears
  // in the stack without anything new being wired.
  const stream = useMemo(() => boardInsightStream(nodes), [nodes]);

  const openCount = nodes.filter(
    (n) => n.status === 'open' && n.kind === 'open-question',
  ).length;

  // ── The round ending itself ───────────────────────────────────────────────
  //
  // The trigger is a STATE the board already knows, not the passage of time —
  // `roundIsFinished` is that rule and the reasoning for each of its clauses.
  // The seconds are only how long the person gets to change their mind.
  //
  // It is now the ONLY way a round ends. The button that also did it is gone:
  // it offered a third "next move" in a bar whose whole job is to name one, for
  // something the board already does on its own. `remaining` is therefore no
  // longer rendered anywhere — the countdown runs unseen — and typing is what
  // holds it open, which `onTyping` on the bar's composer still does.
  const { holdOpen: holdRoundOpen } = useSelfEndingRound({
    armed: roundIsFinished({
      open: openCount,
      answeredThisRound,
      waiting: roundPhase === 'waiting',
    }),
    seconds: AUTO_ROUND_SECONDS,
    onExpire: onNext,
  });

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[26px] border border-white/10">
      <GalaxyBoard
        seedIdea={seedIdea}
        mapId={mapId}
        // The board reads the arc for one thing: whether the far end still
        // holds a provisional suggestion or now holds the finished plan.
        mapPhase={mapPhase}
        attachments={attachments}
        themes={themes}
        nodes={nodes}
        insights={stream.insights}
        bridgeStatus={bridge.status}
        onAnswer={onAnswer}
        onChoose={onChoose}
        onSay={onSay}
        // Typing holds the round open. Someone mid-sentence has not finished,
        // whatever the board's counts say — and the seconds after answering the
        // last card are exactly when the general remark that fits on no card
        // arrives. Losing that to a timer would make the automation a thing
        // done TO them rather than for them.
        onTyping={holdRoundOpen}
        // The way back INTO the loop, from the far end. It is the same
        // mechanism as ending a round — one more entry on the shared log, which
        // the partner wakes on — and it exists because the far end had no way
        // to ask for more. Everything there is a reading of what has been said,
        // so a thin column's honest answer is more input, not more staring.
        onAskMore={onAskMore}
        // The way OUT of the loop, and the ONLY thing the bar offers once the
        // board is answered. It stands in the count's place rather than beside
        // it: with a "Next round" button there too, the bar named three
        // different next moves at once and led with a dead end that named none
        // of them. The round still ends itself on its countdown, and typing
        // still holds that open — what went is a button for something the board
        // already does.
        //
        // Gated on the board being ANSWERED, not merely on the phase having a
        // next step: `PHASE_ASK[phase]` is written for the moment the phase's
        // work is done, so offering it beside three open cards would have the
        // page assert something plainly untrue about what is on screen.
        navForward={
          openCount === 0 && PHASE_ASK[mapPhase].action ? (
            <PhaseAdvance
              phase={mapPhase}
              mapId={mapId || undefined}
              contribute={bridge.contribute}
              tone="bar"
            />
          ) : null
        }
      />
    </div>
  );
}
