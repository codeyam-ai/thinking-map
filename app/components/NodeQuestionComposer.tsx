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
/** The two grounds this composer is mounted on.
 *
 *  `light` is the app's own paper and is the default, so the surfaces that
 *  already mount this — and every capture of them — are unchanged. `dark` is
 *  the board plane, where a white card would be a hole punched in the galaxy.
 *  A tone rather than a second component: the honest-presence rule, the
 *  `user.question` write and the drag guard are the whole substance here, and
 *  a copy of them styled differently is a copy that will drift. */
export type ComposerTone = 'light' | 'dark';

/** Only the classes that carry the ground. Everything structural — the radius,
 *  the padding, the pill field — is the same object on both. */
const TONES: Record<ComposerTone, { shell: string; field: string }> = {
  light: {
    shell: 'border-line bg-surface shadow-lg',
    field:
      'border-line bg-surface text-ink placeholder:text-muted focus:border-ink',
  },
  dark: {
    shell: 'border-white/12 bg-[#141416]',
    field:
      'border-white/15 bg-[#0b0b0c] text-white placeholder:text-white/35 focus:border-white/45',
  },
};

export default function NodeQuestionComposer({
  nodeId,
  label,
  onClose,
  tone = 'light',
  prefill,
}: {
  nodeId: string;
  /** The node's own words, shown so the person can see what they are asking
   *  about without looking back at the map behind the composer. */
  label: string;
  onClose: () => void;
  tone?: ComposerTone;
  /** Text put INTO the field for the person to edit and send — never sent. The
   *  rule `AnswerChips` and `SuggestionChips` already hold: a prompt that
   *  submitted would turn "dig into this" into a menu of approved questions.
   *  Changing it refills the field, which is what makes a second chip replace
   *  the first rather than being ignored. */
  prefill?: string;
}) {
  const bridge = useWebMcpBridge();
  const [text, setText] = useState(prefill ?? '');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const styles = TONES[tone];

  // A new prefill lands in the field. Keyed on the value rather than on an
  // identity, so clicking the same chip twice after typing over it puts the
  // prompt back — which is what someone who has just deleted their draft by
  // accident expects, and costs nothing to anyone who does not.
  useEffect(() => {
    if (prefill === undefined) return;
    setText(prefill);
    field.current?.focus();
  }, [prefill]);

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
      className={`w-[290px] rounded-2xl border p-3 ${styles.shell}`}
      // The composer is anchored over the map, which is a drag surface: without
      // this, dragging inside the text field would pan the plane underneath.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <NodeQuestionHeader label={label} onClose={onClose} tone={tone} />

      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={field}
          className={`w-full rounded-full border py-2 pl-3.5 pr-11 text-[12.5px] outline-none ${styles.field}`}
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

      <AskPresenceNote listening={listening} tone={tone} />
    </section>
  );
}
