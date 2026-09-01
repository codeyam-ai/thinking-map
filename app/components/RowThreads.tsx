'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cardThreads, type CardThread } from '../lib/cardThreads';
import { familyLineVar } from '../lib/nodeAppearance';
import { curve, fanOrigins } from '../lib/threadGeometry';
import type { Round } from '../lib/mapRounds';

/**
 * The threads between the rows: one short curve per card, rising from the card
 * above that prompted it.
 *
 * Drawn as ONE overlay across the whole column rather than a separate layer in
 * each row gap. The plan proposed per-gap layers and this is the one place it
 * departs from it, for a reason worth writing down: the rows are a CSS flex
 * wrap, so there are no computed coordinates to read anywhere, and every thread
 * has to be measured off the DOM either way. A single overlay measures every
 * card into ONE coordinate space with one observer; per-gap layers would need a
 * container, an observer and an origin per gap, all of which have to agree, to
 * draw exactly the same picture. Less machinery for the same curve.
 *
 * Purely decorative and `aria-hidden`: a thread restates a relationship that
 * the rows and the eyebrows already carry in text, so nothing here is the only
 * way to learn anything.
 *
 * What is left here is MEASUREMENT and rendering. The SHAPE of a thread — how
 * deep it bends, how wide the fan of one parent's threads opens — lives in
 * `threadGeometry`, because that part has rules worth pinning with tests and
 * this part can only ever be checked by looking at it.
 */

interface Line {
  key: string;
  d: string;
  stroke: string;
  /** Where the curve lands, for the endpoint dot. */
  x: number;
  y: number;
}

export default function RowThreads({
  rounds,
  /** The element the cards are laid out in. Every measurement is taken
   *  relative to its box, which is also the box this SVG is stretched over. */
  containerRef,
}: {
  rounds: Round[];
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // The threads themselves are pure and cheap; only their GEOMETRY needs the
  // DOM. Keeping the derivation out of the effect means a re-measure on resize
  // never re-derives who connects to whom.
  const threadsRef = useRef<CardThread[]>([]);
  threadsRef.current = cardThreads(rounds);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const origin = container.getBoundingClientRect();
    const box = (id: string) => {
      const el = container.querySelector<HTMLElement>(
        `[data-node-id="${CSS.escape(id)}"]`,
      );
      return el?.getBoundingClientRect() ?? null;
    };

    // Grouped by parent, because the departure points of one parent's threads
    // are decided together — see `fanOrigins`.
    const byParent = new Map<string, CardThread[]>();
    for (const thread of threadsRef.current) {
      const siblings = byParent.get(thread.parentId);
      if (siblings) siblings.push(thread);
      else byParent.set(thread.parentId, [thread]);
    }

    // The top edge of a round's FIRST line, for each round a thread lands in.
    // A row is a flex wrap, so "which line is this card on" exists nowhere but
    // in the laid-out geometry — and it is the fact that decides whether a
    // thread can be drawn to a card at all.
    const firstLineTop = new Map<string, number>();
    for (const thread of threadsRef.current) {
      const key = thread.roundIds.join('|');
      if (firstLineTop.has(key)) continue;
      const tops = thread.roundIds
        .map((id) => box(id)?.top)
        .filter((top): top is number => top !== undefined);
      if (tops.length > 0) firstLineTop.set(key, Math.min(...tops));
    }

    const next: Line[] = [];
    for (const [parentId, threads] of byParent) {
      const parent = box(parentId);
      if (!parent) continue;

      const landings = threads
        .map((thread) => ({ thread, child: box(thread.childId) }))
        .filter(
          (entry): entry is { thread: CardThread; child: DOMRect } =>
            entry.child !== null,
        )
        // Only cards on the row's first line. A card that wrapped onto a second
        // line sits a full card-height further down, and the only lane to it
        // runs straight through the cards above — which is what the threads
        // did before this filter, and it looked like the map had sprung a
        // leak. There is no honest curve to a wrapped card, so it gets none,
        // exactly as a card with no parent in the previous round gets none.
        .filter(({ thread, child }) => {
          const top = firstLineTop.get(thread.roundIds.join('|'));
          return top === undefined || child.top <= top + 8;
        })
        // Left to right, so the fan's departures and its landings are in the
        // same order and no two of this parent's threads cross each other.
        .sort((a, b) => a.child.left - b.child.left);

      const origins = fanOrigins(parent.left, parent.width, landings.length);

      landings.forEach(({ thread, child }, i) => {
        // In the container's own coordinates. `scrollTop` is not added: the SVG
        // scrolls WITH the content because it is inside the same scroll
        // container.
        const x1 = origins[i]! - origin.left;
        const y1 = parent.bottom - origin.top;
        const x2 = child.left + child.width / 2 - origin.left;
        const y2 = child.top - origin.top;

        // A child that is not actually below its parent means the row wrapped
        // between them and the two cards are side by side. A curve there would
        // travel backwards through the cards rather than between them, so draw
        // nothing — the same honest silence as a card with no parent.
        if (y2 - y1 < 4) return;

        next.push({
          key: `${thread.parentId}->${thread.childId}`,
          d: curve(x1, y1, x2, y2),
          stroke: familyLineVar(thread.childKind),
          x: x2,
          y: y2,
        });
      });
    }

    setLines(next);
    setSize({ w: container.scrollWidth, h: container.scrollHeight });
  }, [containerRef]);

  useEffect(() => {
    measure();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    // The row is a flex wrap, so a width change can re-flow every card without
    // any of them changing size — observing the container catches that, and
    // observing each card catches a card growing when its answer lands.
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    for (const card of container.querySelectorAll('[data-node-id]')) {
      observer.observe(card);
    }
    return () => observer.disconnect();
    // `rounds` is in the deps because a new round means new cards to observe.
  }, [measure, containerRef, rounds]);

  if (lines.length === 0) return null;

  return (
    <svg
      // `z-0` rather than a negative z: the layer has to clear the research
      // band's ground (ordinary in-flow content, which any positioned element
      // beats) while still sitting under the cards, which claim `z-10` for
      // exactly this. A negative z would put it under the band and, worse,
      // under the panel's own background.
      className="pointer-events-none absolute left-0 top-0 z-0"
      width={size.w}
      height={size.h}
      aria-hidden="true"
    >
      {lines.map((line) => (
        <g key={line.key} stroke={line.stroke} opacity="0.55">
          <path d={line.d} fill="none" strokeWidth="1.75" />
          {/* The endpoint dot: it says the thread ARRIVED at this card rather
              than passing behind it, which matters most in a wide row where a
              curve crosses under other cards on its way. */}
          <circle cx={line.x} cy={line.y} r="2.6" fill={line.stroke} />
        </g>
      ))}
    </svg>
  );
}
