'use client';

import { useEffect, useRef, useState } from 'react';
import AskPresenceNote from './AskPresenceNote';
import NodeQuestionHeader from './NodeQuestionHeader';
import SendButton from './SendButton';
import { useWebMcpBridge } from './WebMcpBridge';
import { askPresence } from '../lib/askPresence';

/**
 * Asking the agent about one specific node.
 *
 * The node is the whole point. A free-text note leaves the agent to work out
 * from prose which of twenty pills you meant — and on a map with two nodes
 * called "Vocabulary" that is a guess. This carries the id, so the question
 * arrives already attached to the thing it is about.
 *
 * The send control states which case you are in, because that is the one thing
 * this feature could genuinely mislead about. WebMCP is pull-only: a
 * contribution wakes an agent that is already parked on `await_user_activity`,
 * and does nothing at all for an agent that is not attached. Implying an answer
 * is coming when nothing is listening would be a lie the UI tells by omission,
 * so the button says which of the two just happened.
 */
export default function NodeQuestionComposer({
  nodeId,
  label,
  onClose,
}: {
  nodeId: string;
  /** The node's own words, shown so the person can see what they are asking
   *  about without looking back at the map behind the composer. */
  label: string;
  onClose: () => void;
}) {
  const bridge = useWebMcpBridge();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  // Focused here rather than with `autoFocus`. The two behave the same in the
  // app, but the attribute makes the browser log "Blocked autofocusing on a
  // <input> element in a cross-origin subframe" inside the capture iframe —
  // a policy notice about the frame, not a fault in this component, which
  // nonetheless fails every scenario capture. Calling focus() asks for the
  // same thing without the console error.
  useEffect(() => {
    field.current?.focus();
  }, []);

  // `working` still means attached — the agent is mid-tool-call and will see
  // this when it comes back round. Only `unavailable` means nobody is there.
  const listening = bridge.status !== 'unavailable';

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      await bridge.contribute('user.question', { nodeId, text: trimmed });
      setText('');
      onClose();
    } catch {
      // Keep what they typed and stay open — a failed send that also loses the
      // question is two losses for one fault.
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="w-[290px] rounded-2xl border border-line bg-surface p-3 shadow-lg"
      // The composer is anchored over the map, which is a drag surface: without
      // this, dragging inside the text field would pan the plane underneath.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <NodeQuestionHeader label={label} onClose={onClose} />

      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={field}
          className="w-full rounded-full border border-line bg-surface py-2 pl-3.5 pr-11 text-[12.5px] text-ink outline-none placeholder:text-muted focus:border-ink"
          placeholder="What do you want to know?"
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
        <SendButton
          label={askPresence(listening).sendLabel}
          disabled={!text.trim() || busy}
        />
      </form>

      <AskPresenceNote listening={listening} />
    </section>
  );
}
