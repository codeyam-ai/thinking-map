'use client';

/** What a contribution is: something said about the map, or something put on it. */
export type ContributionMode = 'note' | 'node';

const TABS: { value: ContributionMode; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'node', label: 'Add node' },
];

/**
 * Which of the two contributions the bar is composing.
 *
 * Two tabs rather than two inputs stacked: the difference between them is what
 * happens afterwards — a note is read by the agent on its next turn, a node
 * lands on the map — and that is a choice, not two separate controls.
 */
export default function ContributionTabs({
  mode,
  onChange,
}: {
  mode: ContributionMode;
  onChange(mode: ContributionMode): void;
}) {
  return (
    <div className="flex items-center gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          aria-pressed={mode === tab.value}
          className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wide transition ${
            mode === tab.value ? 'bg-ink text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
