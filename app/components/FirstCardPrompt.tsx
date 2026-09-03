'use client';

// The ask: the question, and the space to answer it.
//
// LEFT-ALIGNED, and that is the substance of this component rather than a
// detail of it. This was the one surface in the product whose copy was centred,
// and centring a field you are typing into moves the words you have already
// written on every keystroke — the sentence drifts sideways while you are still
// composing it.
//
// It is also the card that is about to BECOME the core, which has always been
// left-aligned. Making the two agree is not a preference; it is the first card
// agreeing with what it turns into.
//
// The card's own centring on the black screen is untouched. That is position,
// not alignment, and it is deliberately not what changed here.

export default function FirstCardPrompt({
  value,
  busy,
  onChange,
  onSubmit,
  onPasteFiles,
  autoFocus = true,
}: {
  value: string;
  busy: boolean;
  onChange(next: string): void;
  onSubmit(): void;
  /** Images lifted off the clipboard. See the paste handler below. */
  onPasteFiles(files: File[]): void;
  /**
   * Defaults to true, which is the real arrival: this field is the only thing
   * on the screen to do, so the cursor belongs in it before anyone reaches for
   * the mouse.
   *
   * Off only for an isolated capture. A screenshot has no one typing into it,
   * and a browser refuses to autofocus inside a cross-origin frame — which is
   * what the capture harness is — so leaving it on there buys nothing and
   * fails the frame on a console error.
   */
  autoFocus?: boolean;
}) {
  return (
    <>
      <p className="text-[24px] font-semibold leading-[1.2] text-black">
        What are you trying to figure out?
      </p>

      {/* The field sits in the middle of the card rather than under the
          heading: the card is mostly empty on purpose, and the empty space is
          what says "this is yours to fill". */}
      <div className="flex flex-1 items-center">
        <textarea
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          // ⌘V is the whole interface for attaching a screenshot. There is
          // deliberately no "paste an image here" box: the clipboard lands
          // wherever focus is, and focus on this screen is this field.
          //
          // Only an IMAGE is intercepted, and only then is the default
          // prevented — pasting text still types into the card exactly as it
          // always has. Swallowing a pasted sentence to serve a pasted
          // screenshot would break the primary use of this field for the
          // secondary one.
          onPaste={(e) => {
            const images = Array.from(e.clipboardData?.items ?? [])
              .filter(
                (item) => item.kind === 'file' && item.type.startsWith('image/'),
              )
              .flatMap((item) => {
                const file = item.getAsFile();
                return file ? [file] : [];
              });
            if (images.length === 0) return;
            e.preventDefault();
            onPasteFiles(images);
          }}
          rows={3}
          placeholder="Type here…"
          disabled={busy}
          // `text-left` is explicit rather than inherited: a textarea takes its
          // alignment from ancestor CSS, and this field must stay left whatever
          // a future wrapper decides.
          className="w-full resize-none bg-transparent text-left text-[19px] leading-[1.4] text-black outline-none placeholder:text-black/40"
        />
      </div>
    </>
  );
}
