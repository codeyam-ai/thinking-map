/**
 * What the wait turned out to mean.
 *
 * Its own component for the same reason `AskPresenceNote` is: this is the part
 * of the pending row that has to be honest, and a sentence that has to be
 * honest is worth being able to point at. The wording itself lives in
 * `pendingRow`, where a test can pin it.
 */
export default function PendingNote({ note }: { note: string }) {
  return <p className="text-[12.5px] leading-snug text-muted">{note}</p>;
}
