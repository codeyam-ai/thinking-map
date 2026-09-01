export interface AgentCallLine {
  /** The tool name, or the step's own heading. */
  label: string;
  /** What came back — the tool's text, or the error that stopped it. */
  detail: string;
  failed: boolean;
}

/**
 * One call and what it returned.
 *
 * Monospace on the name and prose on the result, because the two are different
 * kinds of thing: the name is an identifier, the reply is written for an agent
 * to read and is worth reading. A failure takes the risk colour so a broken
 * call cannot be mistaken for a quiet one.
 */
export default function AgentCallLogRow({ line }: { line: AgentCallLine }) {
  return (
    <li>
      <p
        className={`font-mono text-[10.5px] ${
          line.failed ? 'text-risk' : 'text-ink'
        }`}
      >
        {line.label}
      </p>
      <p className="whitespace-pre-wrap text-[11px] leading-snug text-muted">
        {line.detail}
      </p>
    </li>
  );
}
