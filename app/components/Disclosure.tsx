/**
 * A compact fold: a summary line you press to reveal what is under it.
 *
 * A native `<details>` rather than a hook and a boolean. It is keyboard-operable
 * and announced correctly with nothing wired up, it works before hydration, and
 * open/closed is a reading posture that no other component needs to know about
 * — so there is nothing here worth lifting into state.
 *
 * It exists because the map became the whole surface. The two things in the old
 * exchange column that were not questions — somewhere to volunteer something
 * nobody asked for, and the record of what has already happened — no longer
 * have a column to live in, and neither is what you came to the page to look
 * at. So they sit under the map, closed until you want them.
 */
export default function Disclosure({
  summary,
  children,
}: {
  /** The always-visible line. Short: it is a label, not a description. */
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="shrink-0 rounded-[20px] border border-line bg-surface px-5 py-3">
      {/* `list-none` plus the empty marker removes the default disclosure
          triangle in both engines — Firefox needs `list-none`, WebKit needs the
          `::-webkit-details-marker` rule `marker:content-none` emits. The
          eyebrow is the affordance; a triangle beside it would be a second one
          saying the same thing in a different visual language. */}
      <summary className="eyebrow cursor-pointer list-none marker:content-none">
        {summary}
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
