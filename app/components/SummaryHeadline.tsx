/**
 * The summary screen opens by admitting what it did NOT do. That honesty is
 * the point of the product: you arrived with an idea and you are leaving with
 * an understanding, not a half-built thing.
 */
export default function SummaryHeadline() {
  return (
    <div>
      <h1 className="text-[clamp(32px,4.4vw,52px)] font-bold uppercase leading-[1.05] tracking-[-0.015em]">
        I didn&rsquo;t build the product yet.
      </h1>
      <p className="eyebrow mt-3">Now I understand what to build, and why.</p>
    </div>
  );
}
