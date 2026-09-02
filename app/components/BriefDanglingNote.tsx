import type { DanglingRef } from '../lib/briefCoverage';

/**
 * Citations pointing at sections this brief does not have.
 *
 * Surfaced rather than swallowed. A dangling reference means the map and the
 * document disagree about what the document contains — usually an agent
 * inventing a plausible id — and a silently dropped citation would let the
 * accounted-for count overstate itself, which is the one failure this whole
 * panel exists to prevent. Renders nothing when there are none, so the
 * ordinary case costs no space.
 */
export default function BriefDanglingNote({
  dangling,
}: {
  dangling: DanglingRef[];
}) {
  if (dangling.length === 0) return null;

  return (
    <p className="mt-3.5 border-t border-line pt-3.5 text-[11.5px] leading-relaxed text-ink-soft">
      {dangling.length === 1
        ? `One node cites ${dangling[0].sourceRef}, which this brief does not have.`
        : `${dangling.length} sections are cited that this brief does not have: ${dangling
            .map((d) => d.sourceRef)
            .join(', ')}.`}
    </p>
  );
}
