/**
 * What extraction wanted the person to know, in the risk colour.
 *
 * Its own component because this line is the safety net of the whole intake:
 * it is where someone who uploaded a photograph of a document finds out that
 * no words came out of it. It reads as a warning rather than an error because
 * nothing has failed — their file is simply not what they thought it was, and
 * they can still paste.
 */
export default function BriefWarning({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-2xl border border-risk px-4 py-3 text-[13px] leading-[1.55] text-risk"
    >
      {text}
    </p>
  );
}
