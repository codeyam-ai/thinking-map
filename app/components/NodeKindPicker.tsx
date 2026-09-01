'use client';

import { KIND_EYEBROW, NODE_KINDS } from '../lib/mapKinds';

/**
 * Which kind of node the person is adding.
 *
 * It reads the same controlled vocabulary the agent's tools are bound to, so a
 * node a person adds is indistinguishable in kind from one the agent added —
 * which is what makes the map genuinely co-authored rather than two overlaid
 * sets of shapes. The labels are the map's own eyebrows, so the picker and the
 * pill agree without a second glossary.
 */
export default function NodeKindPicker({
  kind,
  onChange,
}: {
  kind: string;
  onChange(kind: string): void;
}) {
  return (
    <select
      value={kind}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Node kind"
      className="w-full rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink outline-none focus:border-ink"
    >
      {NODE_KINDS.map((value) => (
        <option key={value} value={value}>
          {KIND_EYEBROW[value]}
        </option>
      ))}
    </select>
  );
}
