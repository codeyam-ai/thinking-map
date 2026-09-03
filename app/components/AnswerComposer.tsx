'use client';

// Writing an answer in your own words.
//
// It is a full-height box with explicit controls rather than a two-row field
// with a keyboard hint, and that is the whole of the difference: a hint alone
// left no visible way to commit an answer or to change your mind, which is
// exactly what someone is deciding at this moment.

export default function AnswerComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  onSkip,
  placeholder,
  autoFocus,
  onFieldFocus,
  light,
  accent,
  canSubmit,
  compact = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Null when there is nowhere to go back TO — a first answer on a card with
   *  no shortlist has nothing to cancel, and a control that does nothing is
   *  worse than no control. */
  onCancel: (() => void) | null;
  /** Move on without answering. "I don't know yet" and "not this one" are real
   *  positions, and a board that only lets you proceed by answering turns them
   *  into a made-up answer — which is worse than a gap, because the partner
   *  cannot tell it from a real one. The question stays OPEN, so the bar keeps
   *  counting it and you can come back. Null where there is nowhere to skip
   *  to. */
  onSkip: (() => void) | null;
  placeholder: string;
  autoFocus: boolean;
  onFieldFocus: () => void;
  /** True on an open card, saturated in the theme colour and taking dark text. */
  light: boolean;
  accent: string;
  /** Whether there is anything to record. Passed in when the answer is not
   *  only what is in this box — a card with a shortlist can have options taken
   *  and nothing typed, and a Save disabled on an empty field would refuse the
   *  answer the person has plainly given. Defaults to the field's own content. */
  canSubmit?: boolean;
  /** Sitting under a shortlist rather than alone on the card. The field gives
   *  up its height to the options above it — two of these both claiming the
   *  card's spare room is what overflowed the card when they were first put
   *  together. */
  compact?: boolean;
}) {
  const canSave = canSubmit ?? Boolean(value.trim());

  return (
    <div
      className={`flex flex-col ${compact ? 'mt-2.5 shrink-0' : 'mt-4 flex-1'}`}
    >
      <textarea
        autoFocus={autoFocus}
        value={value}
        onFocus={onFieldFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends; shift+enter is a newline. A question here is usually
          // one sentence, so sending is the common case.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === 'Escape' && onCancel) onCancel();
        }}
        placeholder={placeholder}
        // Fills whatever the card has left rather than a fixed two rows. With
        // the shortlist stood down there is real room here, and a long answer is
        // exactly what someone reaching past the options is likely writing.
        className={`w-full resize-none overflow-y-auto overflow-x-hidden break-words rounded-xl bg-black/25 p-3 outline-none placeholder:opacity-45 ${
          compact ? 'text-[13.5px]' : 'flex-1 text-[15px]'
        }`}
        style={{ color: light ? '#000' : '#fff', minHeight: compact ? 52 : 92 }}
      />

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSave}
          className="rounded-full px-4 py-2 text-[13.5px] font-semibold transition-opacity disabled:opacity-35"
          style={{
            background: light ? '#000' : accent,
            color: light ? '#fff' : '#000',
          }}
        >
          Save
        </button>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-opacity hover:opacity-100"
            style={{
              borderColor: light
                ? 'rgba(0,0,0,0.28)'
                : 'rgba(255,255,255,0.25)',
              color: light ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.72)',
            }}
          >
            Cancel
          </button>
        ) : null}

        {/* Quiet, and last. Skipping is a legitimate answer to give — "I don't
            know yet" is a real position — but it is not the one being offered,
            so it reads as a way out rather than as a second Save. */}
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-[12.5px] font-semibold underline-offset-2 transition-opacity hover:underline"
            style={{
              color: light ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.5)',
            }}
          >
            Skip
          </button>
        ) : null}

        <span className="ml-auto shrink-0 text-[11px] opacity-55">
          Enter to save
        </span>
      </div>
    </div>
  );
}
