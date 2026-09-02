import type { LoadErrorInfo } from '../lib/loadError';

/**
 * The one screen every failure renders through.
 *
 * Four callers — the map page, the landing page, the client error boundary and
 * not-found — so the treatment cannot drift into four different apologies. It
 * is a card on the paper, sized and spaced like `MapEmptyState`'s restraint
 * rather than like an alert: a failure here is a setup problem, not an alarm.
 *
 * Presentational and server-renderable. No state, no `use client` — the client
 * boundary that needs interactivity passes its button in through `action`.
 */
export default function ErrorScreen({
  title,
  message,
  command,
  hint,
  detail,
  action,
}: LoadErrorInfo & {
  /** A button or link, when there is a next move worth offering. */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface px-6 py-6 sm:px-8 sm:py-8">
        <h1 className="text-[17px] font-semibold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          {message}
        </p>
        {/* A pill, because the whole point of a command is that you copy and
            run it. Only a command gets this treatment: a sentence set in a
            monospace pill spans the card and reads as a slab of code, which is
            why prose guidance goes through `hint` below instead. */}
        {command ? (
          <p className="mt-4 inline-block rounded-full border border-line bg-paper px-3 py-1 font-mono text-[12px] text-ink">
            {command}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
            {hint}
          </p>
        ) : null}
        {detail ? (
          <p className="mt-4 break-words font-mono text-[11px] leading-relaxed text-muted">
            {detail}
          </p>
        ) : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
