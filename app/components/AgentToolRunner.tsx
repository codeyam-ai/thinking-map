'use client';

/**
 * Call one tool by hand.
 *
 * The tool list comes from the published driver rather than from a hardcoded
 * array, so what this offers is exactly what is bound — if a tool fails to
 * register, it is missing here too, which is the point.
 */
export default function AgentToolRunner({
  tools,
  name,
  input,
  busy,
  onNameChange,
  onInputChange,
  onRun,
}: {
  tools: { name: string }[];
  name: string;
  input: string;
  busy: boolean;
  onNameChange(name: string): void;
  onInputChange(input: string): void;
  onRun(): void;
}) {
  return (
    <div className="space-y-1.5">
      <select
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        aria-label="Tool"
        className="w-full rounded-full border border-line bg-paper px-3 py-1.5 text-[11.5px] text-ink outline-none focus:border-ink"
      >
        {(tools.length > 0 ? tools : [{ name }]).map((tool) => (
          <option key={tool.name} value={tool.name}>
            {tool.name}
          </option>
        ))}
      </select>

      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          aria-label="Tool input JSON"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-full border border-line bg-paper px-3 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className="shrink-0 rounded-full border border-ink px-3 text-[11.5px] text-ink transition hover:bg-ink hover:text-white disabled:opacity-40"
        >
          Run
        </button>
      </div>
    </div>
  );
}
