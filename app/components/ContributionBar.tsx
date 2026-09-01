'use client';

import { useState } from 'react';
import ContributionTabs, { type ContributionMode } from './ContributionTabs';
import NodeKindPicker from './NodeKindPicker';
import SendButton from './SendButton';
import { useWebMcpBridge } from './WebMcpBridge';

/**
 * The two direct ways to put something into the map.
 *
 * Deliberately not a chat box: one line, no history underneath it, and what you
 * send lands in the activity rail rather than in a thread. A note is for the
 * agent to read on its next turn; a node goes straight onto the map. Neither
 * expects a reply here — the agent answers in its own surface, which is where
 * its side of the conversation lives.
 */
export default function ContributionBar() {
  const bridge = useWebMcpBridge();
  const [mode, setMode] = useState<ContributionMode>('note');
  const [kind, setKind] = useState('finding');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    const sent = text;
    setText('');
    try {
      if (mode === 'note') {
        await bridge.contribute('user.note', { text: trimmed });
      } else {
        await bridge.contribute('user.node', { kind, label: trimmed });
      }
    } catch {
      // Put it back rather than losing what they typed.
      setText(sent);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="shrink-0">
      <div className="mb-2">
        <ContributionTabs mode={mode} onChange={setMode} />
      </div>

      {mode === 'node' ? (
        <div className="mb-2">
          <NodeKindPicker kind={kind} onChange={setKind} />
        </div>
      ) : null}

      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          className="w-full rounded-full border border-line bg-surface py-2 pl-3.5 pr-11 text-[12.5px] text-ink outline-none placeholder:text-muted focus:border-ink"
          placeholder={
            mode === 'note' ? 'Leave a note for the agent…' : 'Add to the map…'
          }
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
        <SendButton
          label={mode === 'note' ? 'Leave a note' : 'Add node'}
          disabled={!text.trim() || busy}
        />
      </form>
    </section>
  );
}
