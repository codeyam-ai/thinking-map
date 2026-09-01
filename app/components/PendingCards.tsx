/**
 * The cards the map is reaching for but does not have yet.
 *
 * The geometry deliberately mirrors `MapRow`'s band exactly — same wrap, same
 * gap, same card min/max/height — so the placeholders stand where the real
 * cards will and the row does not jump sideways when they arrive. If MapRow's
 * band ever changes, this has to change with it; that coupling is the point of
 * the placeholder and is why the numbers are repeated rather than approximated.
 *
 * The placeholders themselves are `aria-hidden`: a screen reader announcing
 * three empty cards would be announcing the absence of content as though it
 * were content. But the shimmer IS a message — it is the page saying it is
 * reaching for the next round — and a reader who cannot see it was getting no
 * signal at all. So the message is said in words instead, once, in a live
 * region, rather than being left as something only sighted people are told.
 */
export default function PendingCards({ count = 3 }: { count?: number }) {
  return (
    <div>
      <p className="sr-only" role="status">
        Waiting for the next round.
      </p>

      <div className="flex flex-wrap items-start gap-4" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex min-w-[220px] max-w-[300px] flex-1">
            <div className="card-shimmer min-h-[240px] w-full rounded-[20px] border border-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
