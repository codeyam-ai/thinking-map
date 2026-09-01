import { PHASES, PHASE_LABELS, type Phase } from '../lib/mapKinds';

/**
 * The six-phase track. The active phase wears the lime; the rest are muted.
 * Completed phases are deliberately not distinguished from upcoming ones —
 * this is a map of the process, not a progress bar.
 */
export default function PhaseNav({ active }: { active: Phase }) {
  return (
    <nav className="flex items-center gap-1 rounded-full bg-surface p-1.5">
      {PHASES.map((phase) => {
        const isActive = phase === active;
        return (
          <span
            key={phase}
            aria-current={isActive ? 'step' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap ${
              isActive ? 'bg-lime text-ink' : 'text-muted'
            }`}
          >
            {PHASE_LABELS[phase]}
          </span>
        );
      })}
    </nav>
  );
}
