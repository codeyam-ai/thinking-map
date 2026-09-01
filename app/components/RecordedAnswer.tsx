'use client';

/**
 * What the person said, shown back in the card's body.
 *
 * The Edit affordance is deliberately quiet — the eyebrow's weight and colour
 * rather than a button's. An answered question is settled; offering to reopen
 * it should be available without being an invitation.
 */
export default function RecordedAnswer({
  answer,
  onEdit,
}: {
  answer: string;
  onEdit: () => void;
}) {
  return (
    <div>
      <p className="text-[13px] leading-[1.5] text-ink">{answer}</p>
      <button
        type="button"
        onClick={onEdit}
        className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted transition hover:text-ink"
      >
        Edit
      </button>
    </div>
  );
}
