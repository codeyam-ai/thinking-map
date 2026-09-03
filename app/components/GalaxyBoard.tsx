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

/** Below this scale the cards give way to the cluster labels alone.
 *
 *  Set low on purpose. The obvious threshold is "when the text stops being
 *  readable", but hiding the cards there empties the board at exactly the zoom
 *  where someone is trying to take in its shape — and the shape IS the cards.
 *  Unreadable cards still carry the two things that matter from far away: how
 *  much thinking each galaxy holds, and how much of it is still open. Only when
 *  they degrade to single pixels is the label the more useful thing to draw. */
const LABEL_ONLY_BELOW = 0.16;

export default function GalaxyBoard({
  seedIdea,
  mapId,
  attachments,
  themes,
  nodes,
  insights = [],
  bridgeStatus = 'unavailable',
  onAnswer,
  onChoose,
}: {
  seedIdea: string;
  mapId?: string;
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
  onAnswer?: (card: { id: string; label: string }, answer: string) => void;
  /** Picking one of the ways forward the conclusion offers. Distinct from
   *  answering: nothing on the map is being closed, a direction is being
   *  chosen, and what the partner does next depends on which. */
  onChoose?: (choice: string) => void;
}) {
  const layout = useMemo(() => layOutGalaxy(themes, nodes), [themes, nodes]);
  const { camera, zoomBy, focusOn, handlers } = useBoardCamera({
    scale: 0.4,
    x: 0,
    y: 0,
  });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const shell = useRef<HTMLDivElement>(null);

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

  // Frame once the element has been measured. Depending on the node count
  // means a board that gains its first themes re-frames to include them,
  // instead of leaving them off-screen until someone finds the All button.
  useEffect(() => {
    frameAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, themes.length]);

  const far = camera.scale < LABEL_ONLY_BELOW;
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
        {themes.length === 0 ? (
          <ThinkingIndicator x={CORE_SIZE.radius} />
        ) : null}

        {/* The far end. Mounted from the first theme onwards and never gated on
            the rows being finished: a suggestion is a hunch the partner is
            willing to be wrong about in front of you, and withholding it until
            everything is answered is what left this corner of the board a
            dashed ring for most of a session. Each card says how far behind
            the thinking it is, which is what keeps showing one early honest. */}
        {themes.length > 0 ? (
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
              <ThemeParticles hue={cluster.theme.hue} muted={focusedId !== null} />
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
                  fontSize: far ? 21 : 15,
                  // The hub lands first; its cards follow on the stagger above.
                  animation: 'cy-hub-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
                }}
              >
                <span className="px-4 text-center leading-tight">
                  {cluster.theme.label}
                </span>
              </div>
            </div>

            {!far &&
              cluster.cards.map((card, i) => (
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
                      setFocusedId(card.id);
                      focusOn(
                        card.x + card.w / 2,
                        card.y + CARD_SIZE.height / 2,
                        0.92,
                      );
                    }}
                    onAnswer={(text) => onAnswer?.(card, text)}
                  />
                </div>
              ))}
          </div>
        ))}
      </div>

      <BoardZoomControls
        onZoomIn={() => zoomBy(1.35)}
        onZoomOut={() => zoomBy(1 / 1.35)}
        onFrameAll={frameAll}
      />
    </div>
  );
}
