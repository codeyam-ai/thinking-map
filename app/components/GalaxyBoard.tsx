'use client';

// The board.
//
// One plane holding every card, under a single CSS transform. Zoomed out it is
// the shape of someone's thinking; zoomed in it is the one question in front of
// you. Those are the same surface at two scales rather than two screens, which
// is the whole point — a person should never lose the thread by navigating.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  layOutGalaxy,
  CARD_SIZE,
  CORE_SIZE,
  HUB_SIZE,
  type GalaxyTheme,
  type GalaxyNodeInput,
} from '@/app/lib/galaxyLayout';
import { themeColor } from '@/app/lib/themeHue';
import { fanPath, joinPath, rowJoinsStack } from '@/app/lib/boardConnectors';
import { useBoardCamera } from '@/app/hooks/useBoardCamera';
import { useDelayedAdvance } from '@/app/hooks/useDelayedAdvance';
import {
  conclusionCamera,
  navQuestionsOf,
  nextOpenAfter,
  openQuestionsOf,
  summaryNodesOf,
} from '@/app/lib/boardNav';
import { newSince } from '@/app/lib/whatChanged';
import type { Phase } from '@/app/lib/mapKinds';
import type { AnswerSelection } from '@/app/lib/answerDraft';
import BoardNav from './BoardNav';
import BoardWhereNext from './BoardWhereNext';
import BoardToolkitPanel from './BoardToolkitPanel';
import QuestionCard from './QuestionCard';
import CoreIdeaCard from './CoreIdeaCard';
import ThemeParticles from './ThemeParticles';
import GalaxyBackdrop from './GalaxyBackdrop';
import ThinkingIndicator from './ThinkingIndicator';
import InsightStack from './InsightStack';
import type { BoardInsight } from './InsightCard';
import type { BridgeStatus } from './WebMcpBridge';
import BoardZoomControls from './BoardZoomControls';
import type { Attachment } from '@/app/lib/attachments';

/** Below this scale the hub label grows. Out here the card text has become
 *  texture, so the galaxy's name is the thing you are actually reading.
 *
 *  This threshold hides nothing, and must not start to again. It used to cull
 *  the cards below this scale, on the premise that they "degrade to single
 *  pixels" — which is not true at these dimensions: a card is 300x360 board
 *  units, so even at the MIN_SCALE floor of 0.12 it is a ~36x43px block of
 *  colour, a legible patch of texture. What the cull actually did was empty the
 *  board at exactly the zoom where someone is trying to take in its shape, and
 *  the shape IS the cards — how much thinking each galaxy holds, and how much
 *  of it is still open. Worse, framing a large board whole (`frameAll`, which
 *  also runs on mount) computes a fit below this scale, so the board could open
 *  with nothing on it at all. Cards render at every reachable zoom. */
const HUB_LABEL_EMPHASIS_BELOW = 0.16;

/** How long an answered card holds the screen before the board carries you on.
 *
 *  Long enough to see your own words appear on the card you put them on, short
 *  enough that it is not a wait. It is a beat, not a confirmation window —
 *  touching the board cancels it outright. */
const ANSWER_SETTLE_MS = 1000;

export default function GalaxyBoard({
  seedIdea,
  mapId,
  mapPhase = 'map',
  attachments,
  themes,
  nodes,
  insights = [],
  bridgeStatus = 'unavailable',
  selections,
  onAnswer,
  onChoose,
  onSay,
  onTyping,
  onAskMore,
  navForward,
}: {
  seedIdea: string;
  mapId?: string;
  /** Where the whole map is on its arc. The board reads it for one thing only:
   *  what stands at the far end. Defaulted rather than required so an isolated
   *  fixture that only cares about the cards can mount the board without
   *  declaring a phase, and `map` is the phase most of a map's life is spent
   *  in. */
  mapPhase?: Phase;
  attachments?: Attachment[];
  themes: GalaxyTheme[];
  nodes: GalaxyNodeInput[];
  /** The stack at the far end, newest first, as `insightStream` returns it.
   *  Computed by `BoardWorkspace` from these same nodes rather than derived
   *  here: the agent's `read_map` reads the same function, and a second
   *  selection rule living in the board is how the two came to disagree about
   *  what is on it. */
  insights?: BoardInsight[];
  /** Whether an agent can reach the page. Read only by the stack's empty
   *  state, which is the one place the board may claim something about who is
   *  listening. */
  bridgeStatus?: BridgeStatus;
  /** Takes the whole card, not just its id: the exchange log records what was
   *  asked alongside what was said, so an agent reading it later does not have
   *  to re-resolve a bare id against a map that may have moved on. */
  onAnswer?: (
    card: { id: string; label: string },
    answer: string,
    parts?: AnswerSelection,
  ) => void;
  /** How each recorded answer was assembled, by node id. Passed straight to the
   *  card that owns it, which is what lets the pencil reopen on the options
   *  taken. Optional: an isolated fixture has no log to read one out of. */
  selections?: Map<string, AnswerSelection>;
  /** Picking one of the ways forward the conclusion offers. Distinct from
   *  answering: nothing on the map is being closed, a direction is being
   *  chosen, and what the partner does next depends on which. */
  onChoose?: (choice: string) => void;
  /** Saying something about the whole map, from the bar. Same contribution the
   *  chat panel's composer made — a note, not an answer, because nothing on the
   *  map is being closed. */
  onSay?: (text: string) => void;
  /** Fired on every keystroke in the bar's composer, before anything is sent. */
  onTyping?: () => void;
  /** Asking the partner for another round of questions, from the far end. */
  onAskMore?: () => void;
  /** The way on when nothing is left open. Passed in rather than built here:
   *  which phase the map is due to reach is a fact about the exchange, which
   *  the board deliberately knows nothing about. */
  navForward?: React.ReactNode;
}) {
  const layout = useMemo(() => layOutGalaxy(themes, nodes), [themes, nodes]);
  // Declared above the camera because the camera needs it: the wheel and pinch
  // listeners are attached to this element directly, which is the only way they
  // can stop the browser zooming the page along with the board.
  const shell = useRef<HTMLDivElement>(null);
  const { camera, zoomBy, focusOn, handlers } = useBoardCamera(
    {
      scale: 0.4,
      x: 0,
      y: 0,
    },
    shell,
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);

  /** Frame the whole board.
   *
   *  Derived from the layout's own bounds and the measured viewport rather than
   *  from a tuned constant, because the right zoom is a function of how many
   *  themes exist: a map with two clusters and one with nine cannot share a
   *  magic number, and picking one means the board opens either half-empty or
   *  already overflowing. */
  const frameAll = useCallback(() => {
    const el = shell.current;
    if (!el) return;
    const { minX, minY, maxX, maxY } = layout.bounds;
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    // 0.88 leaves a margin so the outermost cards are not flush against the
    // edge, which would read as the board being cut off rather than framed.
    const fit = Math.min(el.clientWidth / w, el.clientHeight / h) * 0.88;
    setFocusedId(null);
    focusOn((minX + maxX) / 2, (minY + maxY) / 2, fit);
  }, [layout.bounds, focusOn]);

  /** Frame the PLAN, at the top and at reading size.
   *
   *  A finished map is opened to read its conclusion, and "fit everything on
   *  screen" is the wrong answer to that: the plan's nodes carry no theme, so
   *  such a map often lays out as one core card and a column 1500 units away,
   *  and framing both puts the column at a scale where its 13px type renders at
   *  five. It is also long — longer than any viewport at a readable scale — so
   *  what can be framed is its BEGINNING. The rest is one pan away, which is
   *  how everything else on this board is reached. */
  const frameConclusion = useCallback(() => {
    const el = shell.current;
    if (!el) return;
    setFocusedId(null);
    const { x, y, scale } = conclusionCamera({
      convergence: layout.convergence,
      viewportHeight: el.clientHeight,
    });
    focusOn(x, y, scale);
  }, [layout.convergence, focusOn]);

  // Frame once the element has been measured. Depending on the node count
  // means a board that gains its first themes re-frames to include them,
  // instead of leaving them off-screen until someone finds the All button.
  useEffect(() => {
    if (mapPhase === 'next-steps') frameConclusion();
    else frameAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, themes.length, mapPhase]);

  /** Fly to a card and focus it — the one motion, written once.
   *
   *  Clicking a card and pressing the bar's count are the same arrival, so they
   *  have to land at the same zoom on the same point. Two copies of this drifted
   *  the moment either was tuned. */
  const focusCard = useCallback(
    (card: { id: string; x: number; y: number; w: number }) => {
      setFocusedId(card.id);
      focusOn(card.x + card.w / 2, card.y + CARD_SIZE.height / 2, 0.92);
    },
    [focusOn],
  );

  // The three readings the bar needs, all of them rules about the layout
  // rather than about rendering — so they live in `boardNav` where a test can
  // hold them, and this component only decides when to re-derive them.
  const openCards = useMemo(
    () => openQuestionsOf(layout.clusters),
    [layout.clusters],
  );
  const summaryNodes = useMemo(() => summaryNodesOf(nodes), [nodes]);
  const navQuestions = useMemo(() => navQuestionsOf(openCards), [openCards]);

  const goToNext = useCallback(() => {
    const next = nextOpenAfter(openCards, focusedId);
    if (next) focusCard(next);
  }, [openCards, focusedId, focusCard]);

  // ── Going back and forth between the map and what it has produced ─────────
  //
  // The far end is where the partner's thinking lands, and it is a long way
  // from the cards you answer — far enough that reaching it meant panning, and
  // getting back meant panning again or giving up and pressing All. So the two
  // are one control: it takes you there, and then it takes you back.
  //
  // `atFarEnd` is what the BUTTON has done, not where the camera happens to be.
  // Deriving it from the camera would flip the label under someone who nudged
  // the board a little, which is exactly the moment they most need it to say
  // the same thing it said a second ago.
  const [atFarEnd, setAtFarEnd] = useState(false);

  /** What the far end held the last time it was looked at. `null` until it has
   *  been, which is what makes "new" mean "arrived while you were elsewhere"
   *  rather than "exists". */
  const [seenAtFarEnd, setSeenAtFarEnd] = useState<ReadonlySet<string> | null>(
    null,
  );
  const changed = useMemo(
    () => newSince(seenAtFarEnd, insights),
    [seenAtFarEnd, insights],
  );

  const goToFarEnd = useCallback(() => {
    setFocusedId(null);
    setAtFarEnd(true);
    setSeenAtFarEnd(new Set(insights.map((i) => i.id)));
    const el = shell.current;
    const { x, y, scale } = conclusionCamera({
      convergence: layout.convergence,
      viewportHeight: el?.clientHeight ?? 600,
    });
    focusOn(x, y, scale);
  }, [insights, layout.convergence, focusOn]);

  const backToMap = useCallback(() => {
    setAtFarEnd(false);
    frameAll();
  }, [frameAll]);

  /** Answering carries you on to the next question, after a beat.
   *
   *  The beat is not decoration: the card turns over and shows what you just
   *  said, and moving in the same frame would take it away before you had seen
   *  your own words land on it. `useDelayedAdvance` holds the pause and the
   *  cancel; this only decides that there IS somewhere to go — on a board with
   *  one question left, "next" wraps back to the card just answered, and being
   *  returned to what you have finished is worse than staying put. */
  const advance = useDelayedAdvance(() => {
    if (openCards.length > 1) goToNext();
  }, ANSWER_SETTLE_MS);

  const goTo = useCallback(
    (id: string) => {
      const card = openCards.find((c) => c.id === id);
      if (card) focusCard(card);
    },
    [openCards, focusCard],
  );

  const farOut = camera.scale < HUB_LABEL_EMPHASIS_BELOW;
  const plane = `scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`;

  return (
    <div
      ref={shell}
      // isolate + overscroll-contain keep the board's own gestures inside the
      // frame: without them a two-finger scroll that reaches the end of the
      // board carries on into the page behind it, and the frame appears to
      // drift rather than hold still while you zoom.
      className="relative isolate h-full w-full touch-none overflow-hidden overscroll-contain rounded-[26px] bg-[#050505]"
      style={{ cursor: 'grab' }}
      // Pointer handlers only. Wheel and pinch are deliberately NOT in this
      // spread: React registers `wheel` passively, so an `onWheel` prop here
      // could never call preventDefault and the browser would zoom the page
      // along with the board. They live on the element itself, in the camera.
      {...handlers}
    >
      {/* The galaxy, under the same transform as the cards — a backdrop that
          stayed fixed would slide against the map and read as a vignette on the
          viewport rather than as the space the board sits in. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 transition-transform duration-500 ease-out"
        style={{ transform: plane }}
      >
        <GalaxyBackdrop />
      </div>

      {/* The board plane. Anchored at the viewport centre so zoom happens about
          the middle of the screen rather than about the top-left corner. */}
      <div
        className="absolute left-1/2 top-1/2 transition-transform duration-500 ease-out"
        style={{ transform: plane }}
      >
        {/* Connectors, under the cards: one line from the core out to each
            cluster hub. This is the visual claim that every galaxy is fed by
            the same idea. Stroke width is divided by scale so the lines stay
            hairlines instead of thickening as you zoom in. */}
        <svg
          className="pointer-events-none absolute overflow-visible"
          style={{ left: 0, top: 0, width: 1, height: 1 }}
        >
          {layout.clusters.map((c) => {
            const stroke = themeColor(c.theme.hue, { s: 70, l: 62, a: 0.75 });
            const w = 2 / camera.scale;
            const last = c.cards[c.cards.length - 1];
            // The curves are string math, so they live in `boardConnectors`
            // where a test can hold their shape — a wrong control point makes a
            // kinked or backwards line that neither the type checker nor a
            // screenshot of one good board would catch.
            const fan = fanPath(CORE_SIZE.radius, HUB_SIZE.radius, c);
            const join = joinPath(c, layout.convergence.x);
            return (
              <g key={c.theme.id}>
                <path d={fan} fill="none" stroke={stroke} strokeWidth={w} />
                {/* The spine each row's questions sit on. */}
                {last ? (
                  <line
                    x1={c.x + HUB_SIZE.radius}
                    y1={c.y}
                    x2={last.x + last.w}
                    y2={c.y}
                    stroke={stroke}
                    strokeWidth={w}
                  />
                ) : null}
                {/* Drawn when this row has earned its line — see
                    `rowJoinsStack`, which holds both clauses and the reason
                    they are in that order. */}
                {join && rowJoinsStack(c, insights) ? (
                  <path d={join} fill="none" stroke={stroke} strokeWidth={w} />
                ) : null}
              </g>
            );
          })}
        </svg>

        <CoreIdeaCard
          seedIdea={seedIdea}
          mapId={mapId}
          attachments={attachments}
        />

        {/* Nothing has branched yet, so the partner is still reading. Keyed on
            themes rather than on a request being in flight, because the page
            never issues one: under WebMCP an agent arrives on its own schedule,
            and the honest signal is "the board is still empty", not "we are
            waiting for a response we asked for". */}
        {/* Not on a map that has REACHED its plan. A finished map can be
            themeless — the plan's nodes belong to no line of thinking, so a map
            whose working cards were never themed lays out with zero clusters —
            and "still reading your idea" over a finished plan is the page
            asserting something plainly untrue about what it is showing. */}
        {themes.length === 0 && mapPhase !== 'next-steps' ? (
          <ThinkingIndicator x={CORE_SIZE.radius} />
        ) : null}

        {/* The far end. Mounted from the first theme onwards and never gated on
            the rows being finished: a suggestion is a hunch the partner is
            willing to be wrong about in front of you, and withholding it until
            everything is answered is what left this corner of the board a
            dashed ring for most of a session. Each card says how far behind
            the thinking it is, which is what keeps showing one early honest. */}
        {/* The far end holds whatever the map's conclusion currently is: a
            suggestion the partner is willing to be wrong about, until the loop
            runs out — and then the plan, standing on the same point rather than
            on a screen that replaced the board. The stack's job is to be
            provisional, so it steps aside once there is something that is not.

            The two are gated differently ON PURPOSE. A suggestion needs a line
            of thinking to have come out of, so the stack waits for a theme; the
            plan does not, because its nodes belong to no theme at all and a map
            whose working cards were never themed still reaches a conclusion.
            One gate for both left the finished plan invisible. */}
        {mapPhase === 'next-steps' ? (
          <div
            className="absolute"
            style={{ left: layout.convergence.x, top: layout.convergence.y }}
          >
            {/* The partner's own thinking goes WITH it. An experiment worth
                running is worth running most of all at the point someone
                thinks they have finished, and the stack that used to carry
                those is the thing this column replaced. */}
            <BoardWhereNext
              nodes={summaryNodes}
              insights={insights}
              changed={changed}
              onChoose={onChoose}
              onAskMore={onAskMore}
            />
          </div>
        ) : themes.length > 0 ? (
          <div
            className="absolute"
            style={{ left: layout.convergence.x, top: layout.convergence.y }}
          >
            <InsightStack
              insights={insights}
              status={bridgeStatus}
              onChoose={onChoose}
            />
          </div>
        ) : null}

        {layout.clusters.map((cluster) => (
          <div key={cluster.theme.id}>
            {/* The hub: the dot the cards hang off, and the label that names
                the galaxy when you are too far out to read the cards. */}
            {/* The dust, centred on the hub and drawn under it. */}
            <div
              className="pointer-events-none absolute"
              style={{ left: cluster.x, top: cluster.y }}
            >
              <ThemeParticles
                hue={cluster.theme.hue}
                muted={focusedId !== null}
              />
            </div>

            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: cluster.x, top: cluster.y }}
            >
              <div
                className="flex items-center justify-center rounded-full font-semibold text-black transition-all duration-300"
                style={{
                  width: 132,
                  height: 132,
                  background: themeColor(cluster.theme.hue),
                  boxShadow: `0 0 90px ${themeColor(cluster.theme.hue, { a: 0.4 })}`,
                  fontSize: farOut ? 21 : 15,
                  // The hub lands first; its cards follow on the stagger above.
                  animation:
                    'cy-hub-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
                }}
              >
                <span className="px-4 text-center leading-tight">
                  {cluster.theme.label}
                </span>
              </div>
            </div>

            {cluster.cards.map((card, i) => (
              <div
                key={card.id}
                className="absolute"
                style={{
                  left: card.x,
                  top: card.y,
                  width: card.w,
                  height: CARD_SIZE.height,
                  // Staggered so a round lands as a sequence rather than as
                  // one block appearing — the delay is what makes it read as
                  // the partner writing rather than the page re-rendering.
                  animation: `cy-emerge 520ms cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 90}ms both`,
                }}
              >
                <QuestionCard
                  card={card}
                  focused={focusedId === card.id}
                  onFocus={() => {
                    // Taking hold of a card overrules a pending jump: the
                    // person has said where they want to be.
                    advance.cancel();
                    // `focusCard` rather than the inline setFocusedId + focusOn
                    // this replaced. Clicking a card and pressing the bar's
                    // count are the same arrival, so they have to land at the
                    // same zoom on the same point — and two copies of that
                    // drifted the moment either was tuned.
                    focusCard(card);
                  }}
                  selection={selections?.get(card.id) ?? null}
                  onAnswer={(text, parts) => {
                    onAnswer?.(card, text, parts);
                    advance.arm();
                  }}
                  // Not answering is a real answer to give. The question stays
                  // OPEN — the bar keeps counting it and it comes round again
                  // — so skipping moves the eye, not the map.
                  onSkip={goToNext}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Over the plane and pinned to the VIEWPORT, not to the board:
          everything inside the transform shrinks as you zoom out, and a
          navigation aid that got smaller the more lost you were would be
          exactly backwards.

          `pointer-events-none` on the column, re-enabled on each child. The
          column spans the full width to hold its children's alignment, and
          without this it would be an invisible sheet over the top of the board
          that swallowed every drag starting there. */}
      <div className="pointer-events-none absolute inset-x-5 top-5 z-20 flex flex-col items-start gap-3">
        {/* `z-30` against the panel's `z-20` below. Both hang off the same
            column and the question list drops into exactly the space the panel
            occupies, so DOM order alone painted the instruction over the list
            the person had just asked for. The list wins: it is the thing being
            deliberately opened, and covering a standing note for a moment is
            what every dropdown does. */}
        <div className="relative z-30 w-full">
          <BoardNav
            questions={navQuestions}
            insightCount={insights.length}
            onGoTo={goTo}
            onGoToNext={goToNext}
            onSay={(text) => onSay?.(text)}
            onTyping={onTyping}
            forward={navForward}
            // The round trip, and the count that makes it worth taking. The
            // far end is only worth crossing the board for when something is
            // there — so the button says how much arrived while you were
            // answering, and stops saying it the moment you have looked.
            atFarEnd={atFarEnd}
            changedCount={changed.size}
            onGoToFarEnd={goToFarEnd}
            onBackToMap={backToMap}
          />
        </div>
        <div className="relative z-20">
          {/* Also stands down on a finished map. The note says to go round the
              map answering what it asks — and a map that has reached its plan
              is asking nothing, so leaving it up would print an instruction
              that cannot be followed, over the plan the person came to read. */}
          <BoardToolkitPanel
            suppressed={focusedId !== null || mapPhase === 'next-steps'}
          />
        </div>
      </div>

      <BoardZoomControls
        onZoomIn={() => zoomBy(1.35)}
        onZoomOut={() => zoomBy(1 / 1.35)}
        onFrameAll={frameAll}
      />
    </div>
  );
}
