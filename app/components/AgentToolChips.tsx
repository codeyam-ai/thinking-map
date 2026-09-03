// The tools the browser actually accepted, named.
//
// This row is the visible proof of the bug this whole surface was built around:
// the page used to say "9 tools" while the browser had taken none of them, and
// nothing anywhere printed which ones got through. These are the names an agent
// can really call — not the catalog's ambitions.
//
// Renders nothing at zero rather than an empty heading, because "0 tools
// available" under a line that already says no agent is attached is the same
// fact twice.

export default function AgentToolChips({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="eyebrow">{names.length} tools available</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {names.map((name) => (
          <span
            key={name}
            className="rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
