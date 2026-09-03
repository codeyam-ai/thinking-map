/**
 * One region of the far-end column: a dark panel with a small-caps heading.
 *
 * The heading is `InsightSectionLabel` rather than a copy of its six utility
 * classes. That component exists for exactly this reason — it is the board's
 * eyebrow, deliberately not the app's paper-palette `eyebrow` class, which
 * renders near-black on a near-black plane and so is invisible here.
 */
import InsightSectionLabel from './InsightSectionLabel';

export default function BoardWhereNextPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-white/10 bg-black/60 p-5">
      <InsightSectionLabel className="mb-3">{title}</InsightSectionLabel>
      {children}
    </section>
  );
}
