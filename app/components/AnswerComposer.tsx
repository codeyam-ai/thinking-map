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
  placeholder,
  autoFocus,
  onFieldFocus,
  light,
  accent,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Null when there is nowhere to go back TO — a first answer on a card with
   *  no shortlist has nothing to cancel, and a control that does nothing is
   *  worse than no control. */
  onCancel: (() => void) | null;
  placeholder: string;
  autoFocus: boolean;
  onFieldFocus: () => void;
  /** True on an open card, saturated in the theme colour and taking dark text. */
  light: boolean;
  accent: string;
}) {
  const canSave = Boolean(value.trim());

  return (
    <div className="mt-4 flex flex-1 flex-col">
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
        className="w-full flex-1 resize-none rounded-xl bg-black/25 p-3 text-[15px] outline-none placeholder:opacity-45"
        style={{ color: light ? '#000' : '#fff', minHeight: 92 }}
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
              borderColor: light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.25)',
              color: light ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.72)',
            }}
          >
            Cancel
          </button>
        ) : null}

        <span className="ml-auto text-[11px] opacity-55">Enter to save</span>
      </div>
    </div>
  );
}
