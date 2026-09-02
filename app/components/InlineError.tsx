/**
 * One line of failure, under the thing that failed.
 *
 * Extracted because two call sites had drifted into near-identical markup and a
 * third would have copied whichever it found first. The value is not the four
 * lines saved — it is that `role="alert"` now comes with the styling rather than
 * beside it, so an error line added later is announced to a screen reader
 * whether or not its author thought about it.
 *
 * Renders nothing at all when there is no message, so a caller can hand it state
 * directly instead of guarding at every use.
 */
export default function InlineError({
  message,
  command,
  className = 'mt-3',
}: {
  message: string | null;
  /**
   * A command to run verbatim, when the failure has a one-line fix — the same
   * `command` the error classifier already gates to development, so it is
   * absent in production by construction rather than by a check here.
   *
   * Rendered as a monospace pill for the reason `ErrorScreen` gives: the point
   * of a command is that you copy and run it, and prose in that pill would read
   * as a slab of code.
   */
  command?: string | null;
  /** Top margin only. The two existing call sites sit at different distances
   *  from what they report on, and unifying them would move pixels this change
   *  has no business moving. */
  className?: string;
}) {
  if (!message) return null;

  return (
    <div className={`${className} text-center`}>
      <p role="alert" className="text-[13px] text-risk">
        {message}
      </p>
      {command ? (
        <p className="mt-2 inline-block rounded-full border border-line bg-paper px-3 py-1 font-mono text-[12px] text-ink">
          {command}
        </p>
      ) : null}
    </div>
  );
}
