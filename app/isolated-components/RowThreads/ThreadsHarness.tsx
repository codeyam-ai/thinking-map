'use client';

import { useRef } from 'react';
import RowThreads from '../../components/RowThreads';
import { familyLineVar } from '../../lib/nodeAppearance';
import type { Round } from '../../lib/mapRounds';

/**
 * A stand-in for the map column, so `RowThreads` can be looked at on its own.
 *
 * The overlay measures the DOM — it asks where the cards ended up after a flex
 * wrap and draws between them — so it renders NOTHING without laid-out cards
 * to measure, and mounting it bare would capture an empty frame. This gives it
 * the two things it needs and nothing else: an element to hold the ref, and
 * boxes carrying `data-node-id` in a wrapping band.
 *
 * The boxes are plain rectangles rather than real `MapCard`s on purpose. What
 * this scenario is for is the THREADS — where they leave, where they land,
 * which ones are drawn at all — and full cards would put 240px of text and
 * answer affordance in front of the thing being looked at.
 */
export default function ThreadsHarness({
  rounds,
  width,
}: {
  rounds: Round[];
  /** The band's width, which is what decides where the rows wrap — and so
   *  which cards end up on a second line with no thread to them. */
  width: number;
}) {
  const columnRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ width }}>
      <div ref={columnRef} className="relative isolate">
        <RowThreads rounds={rounds} containerRef={columnRef} />

        {rounds.map((round) => (
          <div key={round.index} className="mb-14 flex flex-wrap gap-4">
            {round.nodes.map((node) => (
              <div
                key={node.id}
                data-node-id={node.id}
                className="relative z-10 flex h-[120px] min-w-[140px] max-w-[200px] flex-1 items-end rounded-[20px] border bg-surface p-4"
                style={{ borderColor: familyLineVar(node.kind) }}
              >
                {/* The kind, so a reader can tell which box a given thread
                    colour belongs to — and so a scenario where NOTHING is
                    drawn still captures as a real frame rather than as an
                    empty one. */}
                <span className="eyebrow">{node.kind}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
